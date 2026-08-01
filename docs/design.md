# Design system

Point & Shoot's visual language lives in
[`.claude-design/point-and-shoot/`](../.claude-design/point-and-shoot/). That directory is the
**single source of truth** for colors, type, spacing, effects, iconography, and component shape.
This page explains what is in it, how the extension consumes it, and the rules that keep the two in
sync.

## The bundle is upstream — never hand-edit it

`.claude-design/` is an **exported artifact**, not source code. It is produced by the design tool
and committed verbatim so every agent working an item builds against the same tokens.

- Do not edit, reformat, or "fix" any file under `.claude-design/`. Changes there are overwritten on
  the next export, silently reverting whatever was patched.
- Need a token or component changed? Change it upstream and re-export the whole bundle in one
  commit.
- `deno fmt` and `deno lint` exclude the directory (see `deno.json`) precisely so formatting drift
  cannot manufacture a diff in an upstream artifact.
- Tokens are **generated, never hand-copied.** No hex value, font stack, radius, or spacing step
  from this bundle may be retyped into extension CSS or a JS constant. Import the token and use the
  custom property. A hardcoded `#4f7cff` is a bug even when it currently matches.
- A non-blocking `deno task lint:design` runs the bundle's own `_adherence.oxlintrc.json` ruleset
  over our components to flag drift. It reports; it does not gate CI.

## Export identity of the committed bundle

`_ds_manifest.json` carries no version field, so the bundle's identity is its `namespace` key plus a
content hash of every tracked file under it.

| Field         | Value                                      |
| ------------- | ------------------------------------------ |
| Namespace     | `PointShootDesignSystem_5498d1`            |
| Content hash  | `2ed2f2a9a1d9f5a67189eb42cdef0c16192474f4` |
| Tracked files | 88                                         |

Recompute the hash with:

```bash
git -C "$(git rev-parse --show-toplevel)" ls-files -s .claude-design | git hash-object --stdin
```

The `-C "$(git rev-parse --show-toplevel)"` is load-bearing: run from any subdirectory,
`git ls-files .claude-design` matches nothing and the pipeline silently returns the hash of an empty
blob, which looks exactly like a real answer.

**A re-export gets its own commit.** That commit updates the two values above, regenerates the
tokens under `src/shared/design/`, and refreshes the visual baselines — all in the same commit,
because all three move at the same instant. Without this record, the `tokens-drift` check cannot
tell a hand edit (which the rule above exists to catch) from a legitimate re-export with stale
generated files, and an agent hits a red check on an unrelated PR with no way to know which it is.

## What is in the bundle

| Path                        | Contents                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `styles.css`                | Root entry — `@import`s every file under `tokens/` in order                                                                                                                                                        |
| `tokens/colors.css`         | Palette: `--bg-canvas`, surface ramp, cool-gray neutrals, `--accent`, semantic status colors                                                                                                                       |
| `tokens/typography.css`     | Size scale (`--text-2xs` …), weights, line heights, `--tracking-*`                                                                                                                                                 |
| `tokens/spacing.css`        | 4px base unit, `--space-1` (4px) through `--space-24` (96px), radii                                                                                                                                                |
| `tokens/effects.css`        | Shadows, `--shadow-focus`, `--glow-accent`, `--blur-panel`, `--duration-*`, `--ease-*`                                                                                                                             |
| `tokens/fonts.css`          | Font family stacks + the upstream Google Fonts `@import` (substituted — see below)                                                                                                                                 |
| `tokens/base.css`           | Element resets                                                                                                                                                                                                     |
| `guidelines/*.card.html`    | 13 specimen cards (color, type, spacing, radii, shadows, icons, brand) — reference renderings, not shipped code                                                                                                    |
| `components/**/*.jsx`       | 15 components in 14 files: `Badge` and `Tag` (both from `core/Badge.jsx`), `Button`, `Card`, `Icon`, `IconButton`, `Dialog`, `Toast`, `Tooltip`, `Checkbox`, `Input`, `Select`, `Switch`, `Tabs`, `CaptureMinimap` |
| `components/**/*.d.ts`      | Prop types for each component                                                                                                                                                                                      |
| `components/**/*.prompt.md` | Per-component intent — read this before reimplementing one                                                                                                                                                         |
| `ui_kits/*/index.html`      | 6 assembled surfaces: `toolbar-overlay`, `extension-popup`, `notes-panel`, `plan-view`, `options`, `marketing`                                                                                                     |
| `assets/icon.svg`           | Original viewfinder mark (corner brackets + center dot). Placeholder — no official logo exists                                                                                                                     |
| `_adherence.oxlintrc.json`  | Lint rules encoding the system's own conventions                                                                                                                                                                   |
| `_ds_manifest.json`         | Machine-readable index of components and guideline cards                                                                                                                                                           |
| `readme.md`, `SKILL.md`     | The design system's own narrative and agent-facing skill                                                                                                                                                           |

`CaptureMinimap` is the product-specific one: every note carries a screenshot, so note lists and
generated plans always render a captured region rather than a generic image placeholder.

## Three substitutions the extension must make

The bundle's preview harness loads code from CDNs. **MV3's content security policy forbids remote
code**, so each of these is replaced with a local equivalent during the build. These are the only
sanctioned divergences from the bundle.

| # | Bundle uses                                                                                                  | Extension must use                                                                | Why                                                                                                          |
| - | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1 | `@import url('https://fonts.googleapis.com/…')` in `tokens/fonts.css` — Space Grotesk, Inter, JetBrains Mono | Vendored WOFF2 files + local `@font-face`, exposed via `web_accessible_resources` | Remote stylesheet/font fetch is blocked, and a network font means the UI flashes unstyled on every injection |
| 2 | Lucide UMD from `unpkg.com/lucide@latest`                                                                    | A build-time SVG sprite containing only the icons actually referenced             | Remote script is blocked outright; `@latest` is also an unpinned dependency                                  |
| 3 | React 18.3.1 + `react-dom` + `@babel/standalone` from `unpkg.com` for in-page JSX                            | Preact, precompiled at build time — no in-browser transform                       | In-browser Babel is remote code _and_ runtime compilation; both are prohibited                               |

Substitutions 1 and 2 are verified in the Firefox smoke check because `moz-extension://` and
`web_accessible_resources` resolve differently from Chrome's and that is the most likely place the
builds silently diverge.

## Vendored fonts across the shadow boundary

The injected UI keeps token and component rules inside its closed shadow root, but
[`src/content/host.ts`](../src/content/host.ts) installs the generated `@font-face` blocks in a
document-scoped constructable stylesheet. Each WOFF2 URL is resolved individually through the shared
browser shim, which preserves Chrome's session-scoped resource URL and Firefox's random
`moz-extension://` origin.

This arrangement is empirical rather than assumed.
[`tests/e2e/load.spec.ts`](../tests/e2e/load.spec.ts) loads the built Chrome extension, creates the
closed host, and waits for vendored Inter through `document.fonts`. Firefox's real-browser check in
[`scripts/boot-firefox.ts`](../scripts/boot-firefox.ts) fetches the WOFF2, declares the face at
document scope, applies it to content in a closed root, and requires `document.fonts` to report the
face ready. Both engines applied the font with this arrangement. The checks do not claim that a
shadow-root-only `@font-face` works; production deliberately uses the cross-engine path the checks
exercise.

## Applying the system

The production Preact components live in `src/ui/components/`. Run `deno task gallery` to serve the
same components in a local review gallery with both forced themes, representative content, the
required interaction states, and a behavior harness. The server chooses an available loopback port
and prints its URL; it does not write a build artifact or make external requests.

- **Sentence case everywhere** — buttons, headings, labels. No title case. No ALL CAPS except tiny
  eyebrow labels at `--text-2xs` with `--tracking-wider`.
- **No emoji in product UI, ever.** Status is carried by color and icon.
- **One accent per screen.** `--accent` marks the single active/interactive thing — the highlight
  box, the primary button, the focused input ring. Everything else stays neutral. Semantic colors
  are for status only, never decoration.
- **Borders, not shadows, define edges.** Hairline
  `--border-subtle`/`--border-default`/`--border-strong` separate surfaces; shadow is reserved for
  floating and overlay elements.
- **Hover lightens, press deepens, nothing scales.** Darkening on hover reads as "disabled" against
  a near-black canvas, and a precision tool must not feel squishy.
- **Focus rings are non-negotiable.** Every interactive element gets `--shadow-focus`. This is a
  tool for selecting exact elements; keyboard visibility is a correctness requirement covered by the
  accessibility suite.
- **Blur and transparency only in the injected overlay.** `--bg-overlay` + `--blur-panel` tell the
  user the toolbar is extension chrome floating above their page. The popup, options, and marketing
  surfaces are opaque.
- **Motion is functional only** — fades and 4–8px slides on `--ease-out` at
  `--duration-fast/base/slow`. The picker outline pulses opacity, never scale.
  `prefers-reduced-motion` disables all of it.
- **Technical strings in mono, truncated with ellipsis**, always with a way to see the full value.
  URLs, XPaths, and element tags are shown as real values, never paraphrased.

Voice: precise, slightly warm, "senior engineer's internal tool." Second person. Errors state what
happened and what to do next, never blaming the user.

## Both themes are load-bearing

The system is dark-first, but the extension injects into arbitrary third-party pages, so light hosts
are a first-class case (`tokens/colors.css` carries a light theme;
`guidelines/colors-light-theme.card.html` is its specimen). Per ADR 0010, every visual assertion
**forces a theme** rather than inheriting one, and contrast is asserted against both the `dark.html`
and `light.html` fixtures.

## Related

- [`specs/extension-runtime.md`](specs/extension-runtime.md) — current extension surfaces and
  capture contracts
- [`specs/website-and-published-docs.md`](specs/website-and-published-docs.md) — token and font
  reuse on the public site
- [`adr/`](adr/README.md) — the architecture decisions this page assumes
