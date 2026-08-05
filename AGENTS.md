# Agent instructions

Conventions for anyone — human or agent — writing code in this repository. This file is
authoritative. Where it disagrees with a memory, a habit, or a plausible-looking pattern elsewhere
in the tree, this file wins.

The original v1 delivery plans have been retired now that the product is implemented. The active
browser-store rollout lives under [`docs/plans/publish/`](docs/plans/publish/README.md) and must be
retired after the first automated store release is verified. Read
[`docs/specs/`](docs/specs/README.md) for current behavior, [`docs/adr/`](docs/adr/README.md) for
architectural rationale, and [`docs/design.md`](docs/design.md) before changing UI. Active proposed
work may have a temporary plan under [`docs/plans/`](docs/plans/README.md); do not infer current
requirements from retired wave IDs, pull requests, or commit messages.

## What this project is

`point-and-shoot` is a cross-browser Manifest V3 browser extension for reporting UI and UX bugs in
place. The user activates it from the browser toolbar or a keyboard shortcut and a small floating
toolbar appears on the current page. They point at a broken element — or drag a box around a region
— and write a note about what is wrong, repeating across as many pages as they like. On export the
extension emits a structured bundle (region screenshot, page URL, element selector bundle,
computed-style digest, surrounding metadata, and the note) that a local coding agent consumes as a
fix prompt.

There are six product surfaces: the injected toolbar overlay, the extension popup, the notes side
panel, the plan view, the options page, and the marketing site.

## Toolchain

Deno is the repository-wide standard. It owns source, dependencies, lint, formatting, type-checking,
unit tests, extension builds, and the Astro site.

- **`mise` manages tools; `deno task` manages commands.** `mise.toml` has no `[tasks]` section on
  purpose: `deno.json` is the single task registry, so the two cannot drift apart. Tool versions
  live in `mise.toml` and nowhere else.
- **`deno task` is the single entry point.** Never document or script a raw `deno fmt`/`deno lint`
  invocation as the project's interface — add or use a task.
- **Node-ecosystem tools arrive through exact `npm:` specifiers managed by Deno** (Astro,
  Playwright, esbuild, web-ext, Lighthouse, and the font subsetter). There is no `package.json` or
  npm lockfile anywhere in the repository. Deno may generate a gitignored `node_modules/`
  compatibility tree for packages that require Node-style resolution; this does not require or
  authorize a standalone Node toolchain.

### Tasks

A stub task that silently passes is worse than a missing one, because it turns an unimplemented gate
into a green check.

| Task                           | What it does                                                            |
| ------------------------------ | ----------------------------------------------------------------------- |
| `deno task fmt`                | Formats the tree                                                        |
| `deno task fmt:check`          | Fails on any unformatted file                                           |
| `deno task lint`               | Runs `recommended` rules plus `no-slow-types`                           |
| `deno task check`              | Type-checks the project                                                 |
| `deno task test`               | Runs Deno unit and browser-backed module tests                          |
| `deno task ci`                 | Runs formatting, lint, type, store-drift, and test gates                |
| `deno task fixture`            | Serves the browser fixture app, printing both origins                   |
| `deno task shots`              | Captures fixture screenshots into `docs/assets/`                        |
| `deno task shots:wave3`        | Captures every shipped extension surface in both forced themes          |
| `deno task playwright:install` | Installs requested Playwright browsers and optional system dependencies |
| `deno task tokens`             | Regenerates `src/shared/design/tokens.{css,ts}` from the design bundle  |
| `deno task tokens:check`       | Regenerates into a temp dir and diffs against the committed output      |
| `deno task lint:design`        | Lints `src/` against the design bundle's own oxlint config              |
| `deno task build`              | Builds development packages in `dist/chrome/` and `dist/firefox/`       |
| `deno task build:release`      | Builds minified, sourcemap-free `dist/<target>.zip` packages            |
| `deno task release:current`    | Prints the version packaged into both browser manifests                 |
| `deno task release:next`       | Computes the next UTC `YYYY.MMDD.N` release version                     |
| `deno task release:validate`   | Validates both release zips and an optional matching tag                |
| `deno task store:check`        | Validates listing state, copy, privacy, permissions, and public links   |
| `deno task store:sync`         | Projects store publication state into the marked README install block   |
| `deno task store:assets`       | Captures and generates release-build store artwork and vendor badges    |
| `deno task store:assets:check` | Rejects missing, malformed, modified, or source-stale store artwork     |
| `deno task lint:firefox`       | Runs `web-ext lint` against `dist/firefox/`                             |
| `deno task boot:firefox`       | Loads `dist/firefox/` with `web-ext` and asserts it boots               |
| `deno task smoke:firefox`      | Drives one Firefox capture through Marionette and validates its note    |
| `deno task a11y`               | Runs axe, keyboard, focus, contrast, and reduced-motion browser checks  |
| `deno task visual`             | Compares every surface and forced theme with its Linux baseline         |
| `deno task visual:update`      | Replaces visual baselines intentionally on the CI platform              |
| `deno task site:dev`           | Starts the Astro development server                                     |
| `deno task site:check`         | Runs Astro diagnostics for the site                                     |
| `deno task site:lint`          | Checks Deno formatting and lint rules under `site/`                     |
| `deno task site:test`          | Runs Deno tests for site tooling                                        |
| `deno task site:build`         | Builds the static site into `site/dist/`                                |
| `deno task site:links`         | Checks built output, published scope, and external links                |
| `deno task site:a11y`          | Runs axe against the built marketing and documentation surfaces         |
| `deno task site:lighthouse`    | Runs Lighthouse budgets against both built surfaces                     |
| `deno task site:ci`            | Runs every non-browser site gate in sequence                            |

`deno task ci` is the one command that both GitHub Actions and the lefthook `pre-push` hook call, so
local and remote cannot diverge. The path-filtered `Site` workflow uses the same `site:*` tasks for
Astro, link, axe, and Lighthouse checks rather than maintaining another command registry.

Before handing off any change that can affect the shipped extension, run
`mise exec -- deno task build` after every other command that may write `dist/`. The final local
state must leave `dist/chrome/` and `dist/firefox/` matching the branch tip so the unpacked
extension can be reloaded and validated immediately. A prior CI run is not a substitute for this
final development build because build tests may leave different artifacts in `dist/`.

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
deno task playwright:install chromium
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

## Store publication invariants

[`store-listing.json`](store-listing.json) is the canonical source for browser-store state,
identities, links, listing copy, support details, and privacy disclosures. The generated manifests
remain canonical for permissions and Firefox's stable extension ID. `deno task store:check` joins
those sources and is part of the authoritative CI gate.

- Unknown vendor-assigned identities and listing URLs are JSON `null`. A public store URL may appear
  only when that store's state is `published` and the checker accepts the vendor host and identity.
- A shipped user-visible capability change must make an intentional decision about
  `listing.currentVersionSummary`, `listing.fullDescription`, README/docs copy, the inventory of up
  to five listing screenshots, and release notes in the same PR. Update every affected artifact;
  record unchanged items in the PR test plan rather than manufacturing copy churn.
- Store screenshots, promo tiles, vendor badges, and `docs/assets/store/manifest.json` are generated
  outputs. Do not edit them by hand. Run `deno task store:assets` whenever a visible feature,
  permission, setting, export behavior, listing-copy field, or current-version summary changes, then
  visually inspect all seven listing images at their original size. The source digest makes an
  unchanged summary or screenshot set an explicit regeneration decision instead of silent drift.
- The marked README install block is generated with `deno task store:sync`. Unpublished or submitted
  stores never render a badge or link; changing a store to `published` and syncing is the only way
  its canonical listing becomes an install action.
- A permission or data-handling change updates the generated manifests, permission explanations,
  data disclosures, privacy page, durable specs or ADRs, and drift tests in the same PR. The privacy
  guarantee remains local-only and `activeTab`-only unless ADR-0002 is superseded.
- Do not hand-maintain a second website copy of store metadata. Astro reads the disposable
  `site/.generated/store-listing.json` projection created from the root contract.
- Store credentials and API tokens never enter the contract, repository, generated artifacts, logs,
  pull request bodies, or release notes. They live only in protected GitHub environments or secrets.

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
- **Runtime limits live in one spec.**
  [`docs/specs/runtime-limits.md`](docs/specs/runtime-limits.md) is the normative table for
  style-digest, element-collection, screenshot, and legacy export values. Each value also has one
  owning exported constant; consumers import it instead of repeating it.
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

- **One logical change per commit.** Never batch unrelated behavior.
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

| Tool                               | Version   | Pinned in                                                              |
| ---------------------------------- | --------- | ---------------------------------------------------------------------- |
| deno                               | `2.9.4`   | `mise.toml`                                                            |
| lefthook                           | `2.1.10`  | `mise.toml`                                                            |
| astro                              | `7.1.6`   | `deno.json` imports; marketing and documentation site                  |
| `@astrojs/check`                   | `0.9.10`  | `deno.json` imports; Astro diagnostics                                 |
| `@astrojs/markdown-remark`         | `7.2.2`   | `deno.json` imports; Markdown pipeline                                 |
| `@axe-core/playwright`             | `4.12.1`  | `deno.json` imports; site accessibility scans                          |
| playwright                         | `1.62.0`  | `deno.json` imports                                                    |
| axe-core                           | `4.12.1`  | `deno.json` imports; automated accessibility scans                     |
| beautiful-mermaid                  | `1.1.3`   | `deno.json` imports; static site diagrams                              |
| chrome-launcher                    | `1.2.1`   | `deno.json` imports; Lighthouse browser process                        |
| lighthouse                         | `13.4.1`  | `deno.json` imports; site quality budgets                              |
| parse5                             | `8.0.1`   | `deno.json` imports; built-site integrity checks                       |
| rehype-autolink-headings           | `7.1.0`   | `deno.json` imports; documentation headings                            |
| rehype-slug                        | `6.0.0`   | `deno.json` imports; documentation anchors                             |
| typescript                         | `6.0.3`   | `deno.json` imports; Astro checker peer                                |
| unist-util-visit                   | `5.1.0`   | `deno.json` imports; Markdown transforms                               |
| `@std/assert`                      | `1.0.14`  | `deno.json` imports                                                    |
| `@std/path`                        | `1.1.6`   | `deno.json` imports                                                    |
| `@types/pngjs`                     | `6.0.5`   | `deno.json` imports; visual comparison type declarations               |
| pixelmatch                         | `7.2.0`   | `deno.json` imports; visual pixel comparison                           |
| pngjs                              | `7.0.0`   | `deno.json` imports; visual PNG decoding and diff artifacts            |
| preact                             | `10.29.7` | `deno.json` imports                                                    |
| react                              | `18.3.1`  | `deno.json` imports; development/production probe fixture only         |
| react-dom                          | `18.3.1`  | `deno.json` imports; development/production probe fixture only         |
| scheduler                          | `0.23.2`  | `deno.json` imports; React fixture dependency resolver                 |
| loose-envify                       | `1.4.0`   | `deno.json` imports; React fixture dependency resolver                 |
| vue                                | `3.5.40`  | `deno.json` imports; development probe fixture only                    |
| esbuild                            | `0.28.1`  | inline `npm:` specifier in `build/build.ts`                            |
| web-ext                            | `10.5.0`  | inline `npm:` specifier used by Firefox lint, boot, and smoke tasks    |
| `actions/checkout`                 | `v7`      | CI workflows                                                           |
| `actions/upload-artifact`          | `v7`      | CI and release workflows                                               |
| `actions/github-script`            | `v9`      | release pull request artifact comment, `.github/workflows/release.yml` |
| `googleapis/release-please-action` | `v5`      | release automation, `.github/workflows/release.yml`                    |
| `jdx/mise-action`                  | `v4`      | CI workflows                                                           |
| runner image                       | `24.04`   | CI workflows (`runs-on: ubuntu-24.04`)                                 |

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
availability). The esbuild `target` derives from the same `SUPPORTED` constant exported by
`build/manifest.ts` — never a separate literal. See
[`docs/specs/extension-runtime.md`](docs/specs/extension-runtime.md).

## Docs layout

Five folders under [`docs/`](docs/README.md), and no new top-level directories:

| Folder            | Holds                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `docs/specs/`     | Settled behavior specs — what the code must do                      |
| `docs/plans/`     | Active implementation plans — temporary sequencing and evidence     |
| `docs/adr/`       | Architecture decision records, numbered and immutable once accepted |
| `docs/tutorials/` | Task-oriented guides for a reader using the extension               |
| `docs/assets/`    | Committed images referenced by docs and PR bodies                   |

Plus [`docs/README.md`](docs/README.md) (the published index and the documentation conventions every
item inherits) and [`docs/design.md`](docs/design.md) (the design-bundle map).

**Everything under `docs/` is public in the repository.** The website renders the product-facing
index, design guide, specs, and tutorials to HTML themed with the product's own tokens. Plans and
ADRs stay repository-only. Keep only active work under `docs/plans/`; retire a completed plan after
its current guarantees and lasting decisions move into specs and ADRs. Write every doc for a reader
who has never seen the repo, keep links relative, and put nothing there you would not make public.
