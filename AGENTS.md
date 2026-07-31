# Agent instructions

Conventions for anyone — human or agent — writing code in this repository. This file is
authoritative. Where it disagrees with a memory, a habit, or a plausible-looking pattern elsewhere
in the tree, this file wins.

The delivery plan lives in [`docs/plans/`](docs/plans/README.md). If you were handed an item id such
as _"work on W2.6"_, read [`docs/plans/README.md`](docs/plans/README.md) and that item's wave file
first; they carry the sequencing, the settled numbers, and the working rules. This file carries the
conventions those items are written against.

## What this project is

`point-and-shoot` is a cross-browser Manifest V3 browser extension for reporting UI and UX bugs in
place. The user activates it from the browser toolbar or a keyboard shortcut and a small floating
toolbar appears on the current page. They point at a broken element — or drag a box around a region
— and write a note about what is wrong, repeating across as many pages as they like. On export the
extension emits a structured bundle (region screenshot, page URL, element selector bundle,
computed-style digest, surrounding metadata, and the note) that a local coding agent consumes as a
fix prompt.

There are six product surfaces: the injected toolbar overlay, the extension popup, the notes side
panel, the plan view, the options page, and the marketing site (wave 5, deferred).

## Toolchain

Deno-first. Deno owns source, lint, formatting, type-checking, and unit tests.

- **`mise` manages tools; `deno task` manages commands.** `mise.toml` has no `[tasks]` section on
  purpose: `deno.json` is the single task registry, so the two cannot drift apart. Tool versions
  live in `mise.toml` and nowhere else.
- **`deno task` is the single entry point.** Never document or script a raw `deno fmt`/`deno lint`
  invocation as the project's interface — add or use a task.
- **Node-ecosystem tools arrive via `npm:` specifiers** under `deno run -A` (Playwright, esbuild,
  web-ext, the font subsetter). There is no `package.json` and no committed `node_modules/`.
  _Exception:_ wave 5's Astro marketing site is isolated in `site/` with its own Node toolchain, and
  never ships inside the extension.

### Tasks

Tasks land with the item that implements them. A stub task that silently passes is worse than a
missing one, because it turns an unimplemented gate into a green check.

| Task                      | What it does                                                           | Landed in |
| ------------------------- | ---------------------------------------------------------------------- | --------- |
| `deno task fmt`           | Formats the tree                                                       | W1.2      |
| `deno task fmt:check`     | Fails on any unformatted file                                          | W1.2      |
| `deno task lint`          | `recommended` rules plus `no-slow-types`                               | W1.2      |
| `deno task check`         | Type-checks the project                                                | W1.2      |
| `deno task test`          | Deno unit tests                                                        | W1.2      |
| `deno task ci`            | `fmt:check` → `lint` → `check` → `test`, in sequence                   | W1.2      |
| `deno task fixture`       | Serves the browser fixture app, printing both origins                  | W1.8      |
| `deno task shots`         | Captures fixture screenshots into `docs/assets/`                       | W1.9      |
| `deno task shots:wave3`   | Captures every shipped extension surface in both forced themes         | W3.12     |
| `deno task tokens`        | Regenerates `src/shared/design/tokens.{css,ts}` from the design bundle | W2.4      |
| `deno task tokens:check`  | Regenerates into a temp dir and diffs against the committed output     | W2.4      |
| `deno task lint:design`   | Lints `src/` against the design bundle's own oxlint config             | W2.4      |
| `deno task build`         | esbuild dev build → `dist/chrome/`, `dist/firefox/`                    | W2.3      |
| `deno task build:release` | Minified, sourcemap-free build, zipped to `dist/<target>.zip`          | W2.3      |
| `deno task lint:firefox`  | Runs `web-ext lint` against `dist/firefox/`                            | W2.3      |
| `deno task boot:firefox`  | Loads `dist/firefox/` into Firefox via `web-ext run`; asserts it boots | W2.12     |
| `deno task smoke:firefox` | Drives one Firefox capture through Marionette and validates its note   | W4.3      |
| `deno task a11y`          | Runs axe, keyboard, focus, contrast, and reduced-motion browser checks | W4.4      |
| `deno task visual`        | Compares every surface and forced theme with its Linux baseline        | W4.2      |
| `deno task visual:update` | Replaces visual baselines intentionally on the CI platform             | W4.2      |

`deno task ci` is the one command that both GitHub Actions and the lefthook `pre-push` hook call, so
local and remote cannot diverge. Extend `ci` rather than adding a parallel gate.

`lint:design` is deliberately **not** part of `ci`: it checks _adherence to the design bundle's own
conventions_ (`.claude-design/point-and-shoot/_adherence.oxlintrc.json`), a design-system concern,
not a correctness one. `tokens:check` already makes token drift a hard CI failure; adding
`lint:design` to the same gate would block merges on a linter tuned for the upstream design tool,
not for this repo. Run it manually when touching `src/shared/design/`.

The fixture app binds **OS-assigned ports**, not fixed ones, and prints both. Tests read the two
base URLs from `startFixtureServer()`'s return value — never a hardcoded number. It serves two
origins because a genuinely cross-origin iframe needs a second one, and it makes no external
requests: same host, different port, fully offline.

### One-time setup

```bash
mise install
deno run -A npm:playwright@1.62.0 install chromium
```

The second command downloads the Chromium build Playwright drives; it is not covered by
`mise install`. Run commands through `mise exec --` in any non-interactive shell, including when
invoking `git` — the git hooks call `deno`, and a subprocess that has not activated mise will not
find it.

## Cross-browser invariants

Chrome and Firefox are both first-class. Safari is compatible-by-construction with no v1 pipeline
(see [ADR-0005](docs/adr/0005-safari-deferred.md)).

- **Never use `chrome.offscreen`.** Firefox has no equivalent, so reaching for it forks the
  codebase. Image cropping and encoding use `createImageBitmap` plus
  `OffscreenCanvas.convertToBlob`, which work in both background contexts. See
  [ADR-0001](docs/adr/0001-offscreencanvas-over-chrome-offscreen.md).
- **All extension APIs go through the promise-based `browser.*` shim**, never bare `chrome.*`
  callbacks.
- **Permissions are minimal and `activeTab`-only: no `<all_urls>`, ever.** The permission set is
  `activeTab`, `storage`, `scripting`, `downloads`, `clipboardWrite`, plus `sidePanel` (Chrome) /
  `sidebar_action` (Firefox). `activeTab` is granted only on an explicit user gesture, so the
  extension cannot read a page the user did not point it at. This is a **user-facing privacy
  guarantee**, not a convenience — a feature that needs broader host permissions is a decision to
  revisit [ADR-0002](docs/adr/0002-activetab-only-permission-model.md), not a config change.
- Browser-API divergence is covered by unit tests against fakes at the shim seam, not by a second
  end-to-end stack.

## UI conventions

- **Preact** is the UI layer for all five extension surfaces, with JSX transformed by esbuild.
- **Injected UI mounts in a closed shadow root**, so host-page CSS cannot reach it and its styles
  cannot leak onto the page under inspection. Design tokens cross that boundary deliberately.
- **Design tokens are generated** from `.claude-design/` into `src/shared/design/` — never
  hand-copied. A hand-copied token drifts silently and CI cannot tell.
- **No remote assets, ever.** MV3 forbids remote code, and a remote font request from an injected
  overlay would disclose to a third party that the user is annotating their page. Fonts are subset
  to WOFF2 and vendored; Lucide icons are vendored as an inline SVG sprite at build time.
- Theme auto-adapts to the page backdrop by sampling luminance behind the toolbar, with an options
  override that force-pins dark or light. **Tests always force a theme** — auto-adapt would
  otherwise make every visual assertion non-deterministic.

`.claude-design/` is the design source of truth and an **upstream artifact**: never edit, reformat,
or "fix" a file under it. Changes go upstream and come back as a whole re-export in one commit. It
is excluded from `deno fmt` and `deno lint` for exactly this reason. Read
[`docs/design.md`](docs/design.md) before touching any UI item.

## Brand rules

These come from `.claude-design/point-and-shoot/readme.md` and are **binding and review-blocking**,
not suggestions. A PR that breaks one is not merged.

- Sentence case everywhere.
- No emoji anywhere in product surfaces.
- Mono type for every technical value: URLs, XPaths, tag names, keyboard shortcuts.
- Accent blue marks exactly **one** interactive thing on screen.
- Semantic colors are for status only.
- Hover **lightens**, never darkens.
- No scale or springy press states.
- Borders, rather than background shifts, define most edges.
- Animation is functional only — 120–280ms fades and 4–8px slides. Nothing decorative.

## TypeScript conventions

- Strict mode, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `noImplicitOverride`. Do not relax these per-file.
- **TSDoc on every exported symbol**, with `@param` and `@returns`, and a usage example where the
  call site is non-obvious.
- **No `any` without a comment justifying it.** `unknown` plus a narrowing check is almost always
  the right answer.
- **Discriminated unions over optional-field soup.** A type where three fields are only ever present
  together is three types.
- Formatting is settled and enforced: 2-space indent, 100-column width, **double quotes**.
  `.editorconfig` agrees with `deno fmt`; keep them in sync if either changes.
- **DOM types in a shared module.** Deno's default `lib` has no DOM, and `deno.json`'s
  `compilerOptions` stays that way — most of `src/shared/` is meant to run outside a page context. A
  module that genuinely needs DOM types (e.g. `src/shared/selectors.ts`) adds
  `/// <reference lib="dom" />` as its own first line rather than widening the global `lib`.
- **Selector bundle emission order** (`src/shared/selectors.ts`): test ids (`data-testid`,
  `data-test`, `data-cy`, `id`) first, then ARIA role plus accessible name, then the structural
  `cssPath`/`xpath` as the last resort. This is trust order for a consumer chaining fallbacks — a
  test-authored identifier is the least likely to drift, a structural path the most likely to break
  the moment the DOM around the element changes shape.
- **Settled runtime budgets live in one table.** `docs/plans/README.md`'s settled-numbers table is
  the single source for caps multiple wave-2/3 items share (style-digest property/sibling/subtree
  caps, element-collection and export-size limits). An item that needs one of these numbers reads it
  from that table and exports it from its own module — never re-derives or hand-picks its own value.
- **Never trust a stored record's shape.** `src/shared/schema.ts`'s `validateSession` re-validates
  every record read from IndexedDB against the current `Session` shape rather than casting — a
  record can predate a schema bump or be corrupted, and the type system's static guarantees say
  nothing about what is actually on disk. `src/shared/store.ts`'s `MIGRATIONS` array follows the
  same rule for the database shape itself: append an entry keyed to the version it bumps _to_, never
  edit an existing entry once it has shipped.

## Testing

Three tiers, each responsible for something the others cannot cover:

1. **Deno unit tests** (`deno task test`) — pure logic, and browser-API divergence against fakes at
   the `browser.*` shim seam.
2. **Playwright end-to-end, Chromium only** — the real extension loaded into a real browser, driven
   against the fixture app in `tests/fixtures/app/`.
3. **`web-ext` smoke check for Firefox** — proves the extension boots and completes one
   representative capture under Gecko.

**Playwright cannot load extensions in Firefox.** There is no `--load-extension` equivalent, which
is why tier 3 exists and why tier 1 carries the divergence coverage. Never describe this suite as
giving Firefox end-to-end parity; it does not.

Every change covers the happy path, the sad path (invalid input, missing data, failure), and the
edge cases (boundaries, empty collections, concurrency).

## Commit and PR discipline

- **One logical change per commit.** One plan item is one commit; never batch two items.
- **Tests green per commit** — every commit passes `deno task ci` on its own, not just the branch
  tip.
- **Docs land with the code they describe**, in the same commit — never as a follow-up.
- **PRs carry screenshots of visible work.** GitHub does not render relative image paths in PR
  bodies; use the raw blob form
  `https://github.com/whizzzkid/point-and-shoot/blob/<branch>/docs/assets/<path>?raw=1`.
- Every claim in a PR body maps to a command actually run. If something could not be verified, say
  so and why.
- Commits are signed. Conventional-commit subjects; no `commit-msg` hook enforces this, so it is on
  you.

## Version pinning

**Exact versions everywhere.** No `latest`, no `stable`, no floating tags, no `^`, no `~`. GitHub
Actions pin to the official action's semver major, which is this project's one deliberate exception.

| Tool               | Version   | Pinned in                                                                                      |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------- |
| deno               | `2.9.4`   | `mise.toml`                                                                                    |
| node               | `26.5.0`  | `mise.toml` (Playwright browser install, font subset)                                          |
| lefthook           | `2.1.10`  | `mise.toml`                                                                                    |
| playwright         | `1.62.0`  | `deno.json` imports                                                                            |
| axe-core           | `4.12.1`  | `deno.json` imports; automated accessibility scans (W4.4)                                      |
| `@std/assert`      | `1.0.14`  | `deno.json` imports                                                                            |
| `@std/path`        | `1.1.6`   | `deno.json` imports                                                                            |
| `@types/pngjs`     | `6.0.5`   | `deno.json` imports; visual comparison type declarations (W4.2)                                |
| pixelmatch         | `7.2.0`   | `deno.json` imports; visual pixel comparison (W4.2)                                            |
| pngjs              | `7.0.0`   | `deno.json` imports; visual PNG decoding and diff artifacts (W4.2)                             |
| preact             | `10.29.7` | `deno.json` imports                                                                            |
| react              | `18.3.1`  | `deno.json` imports; W3.11 development/production probe fixture only                           |
| react-dom          | `18.3.1`  | `deno.json` imports; W3.11 development/production probe fixture only                           |
| scheduler          | `0.23.2`  | `deno.json` imports; React fixture dependency resolver                                         |
| loose-envify       | `1.4.0`   | `deno.json` imports; React fixture dependency resolver                                         |
| vue                | `3.5.40`  | `deno.json` imports; W3.11 development probe fixture only                                      |
| esbuild            | `0.28.1`  | inline `npm:` specifier, `build/build.ts` (W2.3)                                               |
| web-ext            | `10.5.0`  | inline `npm:` specifier, `deno.json`'s `lint:firefox` task (W2.3); W2.12/W4.3 add further uses |
| `actions/checkout` | `v7`      | CI workflows                                                                                   |
| `jdx/mise-action`  | `v4`      | CI workflows                                                                                   |
| runner image       | `24.04`   | CI workflows (`runs-on: ubuntu-24.04`)                                                         |

A resolved-but-unimported version is recorded here so the number is decided once, and is written
into `deno.json` by the item that first needs it. Claiming a pin already lives somewhere it does not
is worse than an empty row: the next reader greps `deno.json`, finds nothing, and re-picks a
version.

One pin is only advisory in practice: the git hook `lefthook install` generates prefers a bare
`lefthook` on `PATH` and only falls back to the mise install path, and `mise exec --` appends its
tool directories rather than prepending them. A system-wide lefthook — Homebrew's, typically —
therefore shadows the pinned one. It runs the same `lefthook.yml`, and the authoritative gate is
`deno task ci`, which is version-independent, so the drift is not a correctness risk. Force the
pinned binary when you need to:

```bash
LEFTHOOK_BIN="$(mise which lefthook)" mise exec -- git commit
```

Browser minimums are resolved from each vendor's own MV3 support baseline, not guessed:
`minimum_chrome_version` is `116` (the first Chrome version whose `chrome.sidePanel.open()` ships —
`sidePanel` itself landed in Chrome 114, but the shim calls `open()`), and
`browser_specific_settings.gecko.strict_min_version` is `109.0` (Firefox's Manifest V3 general
availability). The esbuild `target` derives from the same `SUPPORTED` constant W2.2 exports in
`build/manifest.ts` — never a separate literal. See the table in
[`docs/plans/README.md`](docs/plans/README.md).

## Docs layout

Five folders under [`docs/`](docs/README.md), and no new top-level directories:

| Folder            | Holds                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `docs/specs/`     | Settled behavior specs — what the code must do                      |
| `docs/plans/`     | The five wave files and the plan index — the delivery plan          |
| `docs/adr/`       | Architecture decision records, numbered and immutable once accepted |
| `docs/tutorials/` | Task-oriented guides for a reader using the extension               |
| `docs/assets/`    | Committed images referenced by docs and PR bodies                   |

Plus [`docs/README.md`](docs/README.md) (the published index and the documentation conventions every
item inherits) and [`docs/design.md`](docs/design.md) (the design-bundle map).

**Everything under `docs/` is published** — wave 5 renders it to HTML themed with the product's own
tokens. Write every doc for a reader who has never seen the repo, keep links relative, and put
nothing there you would not publish.
