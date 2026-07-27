# Wave 1 — Foundations

**Read [`README.md`](README.md) in this folder first** — it holds the project context, settled
decisions, resolved versions, and working rules that every item below assumes.

- **Status:** in progress — W1.1 through W1.8 have landed. What remains is the GitHub-facing tail:
  W1.9's fixture screenshots, W1.10's labels, W1.11's branch protection and tracking issue, and
  W1.12's PR. W1.7's workflow is still unverified because nothing has been pushed yet — its first
  real run happens on that PR.
- **Branch:** `feat/wave-1-plan` (all of wave 1 lands here as one PR). This supersedes the
  `feat/inital-impl` branch this file was written against: that branch carried only the plan and the
  design bundle, and it merged to `main` as PR #1 before any wave-1 implementation started. Wave 1's
  PR is therefore **not** PR #1 — see W1.11 and W1.12, which name the consequences.
- **Goal:** everything later waves stand on — agent instructions, pinned toolchain, git hooks, docs,
  ADRs, CI, the committed design bundle, and the browser fixture app.

## What wave 1 does not do

Wave 1 ships **no extension code**. There is no `dist/`, no manifest, and nothing loadable in a
browser until wave 2. So wave 1 commits are gated on `deno fmt --check`, `deno lint`, `deno check`,
`deno test`, and CI green.

Wave 1 _is_ browser-verifiable in exactly one respect: W1.8's fixture app renders in a real browser
and W1.9 captures Playwright screenshots of it for the PR. The first **extension** load in
Playwright is a wave 2 exit criterion. Do not describe wave 1 as browser-verified beyond the fixture
app.

---

## W1.1 — Agent instructions

- [x] `AGENTS.md` + `CLAUDE.md` — SHA: `61118ab`

**parallel-safe.**

**Why:** every later wave and every other agent reads `AGENTS.md` for the conventions. It has to be
right before anyone writes code.

**Write `AGENTS.md`,** in this order:

1. _What the project is_ — a paragraph condensed from the README's "What this project is".
2. _Toolchain_ — Deno-first, `mise` manages tools, `deno task` is the single entry point. List every
   task and what it does. Node tooling arrives via `npm:` specifiers; no `package.json`. Note the
   wave-5 Astro exception and that it never ships inside the extension.
3. _Cross-browser invariants_ — the README's browser-support bullets restated as rules. Call out
   `chrome.offscreen` as forbidden and say why. State the `activeTab`-only stance as a privacy
   guarantee.
4. _UI conventions_ — Preact + JSX; closed shadow root for injected UI; design tokens are generated
   from `.claude-design/`, never hand-copied; no remote assets ever.
5. _Brand rules_ — the binding list from the README's design-system section (sentence case, no
   emoji, mono for technical values, one accent element per screen, hover lightens never darkens, no
   springy press states, functional-only animation). These are review-blocking, not suggestions.
6. _TypeScript conventions_ — strict mode; TSDoc on every exported symbol with `@param`, `@returns`,
   and a usage example where non-obvious; no `any` without a justifying comment; discriminated
   unions over optional-field soup.
7. _Testing_ — the three tiers and what each is responsible for, including the honest statement that
   Playwright cannot load Firefox extensions.
8. _Commit and PR discipline_ — one logical change per commit, tests green per commit, docs land
   with the code they describe, PRs carry screenshots of visible work.
9. _Version pinning_ — exact everywhere, with the README's resolved-versions table inlined.
10. _One-time setup_ — `mise install`, then `deno run -A npm:playwright@1.62.0 install chromium`.
11. _Docs layout_ — the five `docs/` folders (`specs/`, `plans/`, `adr/`, `tutorials/`, `assets/`)
    and what belongs in each, per [`docs/README.md`](../README.md).

**Write `CLAUDE.md`** as a pointer only: a few lines telling the reader to read `AGENTS.md`, which
is authoritative. Do not duplicate content between the two — duplication guarantees drift.

**Verify:** both exist; `CLAUDE.md` names `AGENTS.md`; no `TBD` or placeholder text; every version
in it matches the resolved-versions table.

**Commit:** `docs: add AGENTS.md conventions and CLAUDE.md pointer`

---

## W1.2 — Toolchain via mise, and Deno project config

- [x] `mise.toml`, `deno.json`, `.gitignore`, `.editorconfig` — SHA: `3731e2b`

**parallel-safe** with W1.1.

**Why:** every later item runs `deno task <something>`. This creates those tasks and makes the
toolchain reproducible for a fresh clone and for CI from one file.

**`mise.toml`:** `[tools]` with `deno = "2.9.4"`, `node = "26.5.0"`, `lefthook = "2.1.10"` — exact
strings. Add an `[env]` section with a comment that env vars belong here, not in shell profiles. Do
**not** define tasks here; `deno.json` owns tasks so there is exactly one task registry. mise
manages _tools_, `deno task` manages _commands_.

**`deno.json`:**

- `lint` — `recommended` plus `no-slow-types`; include `src/`, `tests/`, `build/`.
- `fmt` — 2-space indent, 100-column width; pick single or double quotes once, record the choice in
  `AGENTS.md`, and make `.editorconfig` agree.
- `compilerOptions` — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`. Add DOM/WebWorker libs and the Preact JSX settings in wave 2 when there's
  code that needs them, not speculatively.
- `imports` — empty map with a comment that wave 2+ adds `esbuild`, `playwright`, `web-ext`, and
  `preact` at pinned versions.
- `tasks` — `lint`, `fmt`, `fmt:check`, `check`, `test` (`deno test -A`), and `ci` which runs
  `fmt:check` → `lint` → `check` → `test` in sequence. `ci` is the single command both CI and the
  pre-push hook call, so the two cannot diverge. Leave `build`, `e2e`, `smoke:firefox`, `fixture`,
  and `shots` **out** — each lands with the item that implements it. Never stub a task that would
  silently pass.

**`.gitignore` — this file already exists; ADD to it, never overwrite it.** It landed with the
design bundle in `9fc9c2a` and carries the Deno entries (`.deno/`, `coverage/`, `*.lcov`) and an
agent-scratch section (`.playwright-mcp/`, `.remember/`, `.review-playground/`). Those are
load-bearing: without the scratch entries, an agent's working directories are
untracked-but-unignored and the next `git add` sweeps them into a commit. Add the build-output
entries this item owns and leave everything else intact: `dist/`, `node_modules/`, `.playwright/`,
`playwright-report/`, `web-ext-artifacts/`, `*.zip`, `.DS_Store`.

**`deno.json` — exclude `.claude-design/` from `fmt` and `lint`** while you are in this file. The
bundle is an upstream artifact (see [`../design.md`](../design.md)); formatting it manufactures a
diff in something we don't own. This is the remaining open sub-item of W1.5, which cannot land until
this file exists.

**`.editorconfig`:** matching `deno fmt`'s indent and width so editors don't fight the formatter.

**Verify:**

```bash
mise install
mise exec -- deno --version       # must print 2.9.4
mise exec -- lefthook version     # must print 2.1.10
mise exec -- deno task ci
```

`deno task ci` passes trivially over a near-empty tree — expected. What you're verifying is that the
tasks resolve and that `mise install` produced the pinned versions.

Also prove nothing was lost from the pre-existing `.gitignore`, and that the bundle is excluded:

```bash
git check-ignore -v .remember/ .playwright-mcp/ .review-playground/ dist/ coverage/  # all five resolve
mise exec -- deno fmt --check   # must not touch .claude-design/
```

**Commit:** `chore: pin toolchain via mise and add deno project config`

---

## W1.3 — Lefthook git hooks

- [x] `lefthook.yml` + hooks installed and proven — SHA: `afcad51`

**Depends on:** W1.2.

**Why:** catch formatting, lint, and type errors before CI, without making the local hook the
authoritative gate — CI stays authoritative.

**`lefthook.yml`:**

- `pre-commit` — fast checks only: `deno fmt --check` and `deno lint` over **staged files** via
  lefthook's `{staged_files}` templating, filtered `glob: "*.{ts,tsx,js,json,jsonc,md}"`. Include
  the fix command (`deno task fmt`) in the failure output so the message is actionable.
- `pre-push` — the whole-tree gate: `deno task ci`. Same command CI runs, so green pre-push strongly
  predicts green CI.
- No `commit-msg` hook. Commit-message linting is not part of this project.

**Install:** `mise exec -- lefthook install`.

**Worktree caveat — verify empirically, never assume.** This repo is a git _worktree_, so the hooks
directory is not `.git/hooks`:

```bash
git rev-parse --git-path hooks
ls -la "$(git rev-parse --git-path hooks)"
```

Then prove the hook fires, rather than trusting the install message:

```bash
printf 'const   x=1\n' > badfmt.ts
git add badfmt.ts && git commit -m "test: should be blocked"   # MUST fail on fmt
git reset HEAD badfmt.ts && rm -f badfmt.ts
```

If that commit succeeds the hook is not wired — fix it before checking this item off. A hook that
silently doesn't run is worse than no hook, because it manufactures false confidence.

**Verify:** the deliberate-failure test blocks the commit; `git status` is clean afterward with no
stray `badfmt.ts`; `deno task ci` passes so real pushes aren't blocked.

**Commit:** `chore: add lefthook pre-commit and pre-push checks`

---

## W1.4 — Docs bootstrap

- [x] [`docs/README.md`](../README.md) written — SHA: `419cfa8`
- [x] per-folder index files — SHA: `f1e91cf`

**parallel-safe** with W1.1 and W1.2.

**Done — [`docs/README.md`](../README.md) already exists** and is more than a map: it is the
publishing contract, carrying the four numbered documentation obligations every item in the project
inherits and naming what wave 5 renders. **Do not rewrite it from this item's description.** An
agent handed "write a map of the docs tree" would produce a plausible file that silently drops those
obligations — the content still reads fine, so nothing in review would catch it.

**Remaining files:**

- `docs/adr/README.md` — the ADR index table (number, title, status) plus the project's ADR
  template: Context / Decision / Consequences / Alternatives considered. W1.6 fills the table.
- `docs/specs/README.md`, `docs/tutorials/README.md` — a short paragraph of purpose each.
- Add the `docs/adr/README.md` link to `docs/README.md` once it exists — that link is the one thing
  the existing file is missing, because its target isn't written yet.

**Verify:** every relative link in `docs/README.md` resolves to a file that exists. Check them; do
not eyeball them. Confirm the four documentation obligations are still present — `git diff` on this
item must show additions to `docs/README.md`, not a replacement of it.

**Commit:** `docs: bootstrap docs tree with index files and ADR template`

---

## W1.5 — Commit the design system as source of truth

- [x] `.claude-design/` committed — SHA: `9fc9c2a0752369d7a049398e0bdd76d1fe5ed13c`
- [x] [`docs/design.md`](../design.md) written — SHA: `419cfa8`
- [x] `.claude-design/` excluded from `deno fmt` / `deno lint` in `deno.json` — SHA: `3731e2b`
- [x] export identity recorded in [`docs/design.md`](../design.md) — SHA: `3d7be3f`

**The two open sub-items have different blockers.** The `deno.json` exclusion waits on W1.2, which
creates that file — do not hand it out as immediately startable: a second agent holding `deno.json`
while W1.2 is creating it conflicts on a file that didn't exist when it started. The export-identity
record edits [`../design.md`](../design.md), which already exists, so that half is parallel-safe and
can land at any time.

**Why:** `.claude-design/` was untracked. Every wave-3 item builds against it, and wave 2
_generates_ token files from it. It had to be in version control before anything depended on it, or
the generated output has no reproducible input.

**Done — the bundle is committed** exactly as exported, 88 files: the six `tokens/` files, 13
`guidelines/` specimen cards, 15 components in 14 files under `components/` (each with `.d.ts` and
`.prompt.md`), the six `ui_kits/`, `assets/icon.svg`, `_adherence.oxlintrc.json`, and
`_ds_manifest.json`. Nothing was edited, reformatted, or "fixed" — it is an upstream artifact, and
local edits are silently lost on the next export. If something in it must change, change it upstream
and re-export the whole bundle in one commit.

**Done — [`docs/design.md`](../design.md)** documents the bundle map, the never-hand-edit rule, the
three substitutions MV3 forces (Google Fonts `@import` → vendored subset WOFF2; Lucide from unpkg →
build-time SVG sprite of only the icons used; React + `@babel/standalone` from unpkg → precompiled
Preact, no in-browser transform), the binding brand rules, the non-blocking `deno task lint:design`
(oxlint, added in wave 2, because the project itself lints with `deno lint`), and the rule that
tokens are **generated** into `src/shared/design/` and never hand-copied.

**Remaining:** add the `deno fmt` / `deno lint` exclusion for `.claude-design/` in `deno.json`, so
the formatter cannot rewrite an upstream artifact. This waits on W1.2, which creates `deno.json` —
the one part of this item that is not parallel-safe. Do it in the same commit as W1.2 or immediately
after.

**Also record which export this is** — this is the second open box, and it is not optional.
`_ds_manifest.json` carries no version field; its identity is the `namespace` key (currently
`PointShootDesignSystem_5498d1`). Record that namespace **and** a content hash of the bundle
(`git -C "$(git rev-parse --show-toplevel)" ls-files -s .claude-design | git hash-object --stdin` —
anchor it to the repo root, because from any subdirectory `git ls-files` matches nothing and the
pipeline silently returns the empty-blob hash, which looks like a real answer) in
[`../design.md`](../design.md), together with the rule that a re-export is its own commit. Without
it, W2.4's `tokens-drift` check cannot distinguish a hand edit (what it exists to catch) from a
legitimate re-export with stale generated files — and the agent that hits the red check on an
unrelated PR has no way to tell which it is. A re-export is its own commit that regenerates tokens
and refreshes the W4.2 visual baselines together, because all of them move at the same instant.

**Verify:** `git status` shows `.claude-design/` tracked (done); every path named in
`docs/design.md` exists; once `deno.json` exists, `deno task ci` passes with the bundle in the tree
and `deno fmt --check` reports no files under `.claude-design/`.

**Commit:** `docs: commit design system bundle and document its authority`

---

## W1.6 — Architecture decision records

- [x] Eleven ADRs written and indexed — SHA: `3314673`

**Depends on:** W1.4 (template and index), W1.5 (ADRs 0008–0011 reference the design bundle).

**Why:** these are the decisions a future contributor will otherwise reverse by accident. Each ADR
must state the **constraint that forced** the decision, not merely the decision.

Write each in `docs/adr/` from the W1.4 template, status `Accepted`, dated `2026-07-24`:

1. `0001-offscreencanvas-over-chrome-offscreen.md` — Chrome's idiomatic MV3 path for image work is
   the `offscreen` document API; **Firefox has none**. Using it forks the codebase, so cropping and
   encoding use `createImageBitmap` + `OffscreenCanvas.convertToBlob`, which works in both
   background contexts. Consequence: reaching for `chrome.offscreen` later reintroduces the fork.
2. `0002-activetab-only-permission-model.md` — no `<all_urls>`; `activeTab` is gesture-gated, so the
   extension cannot read pages the user didn't point it at. A privacy guarantee and a store-review
   advantage. Consequence: no background page-scanning feature is possible without revisiting this.
3. `0003-json-canonical-markdown-projection.md` — versioned JSON in IndexedDB is canonical; Markdown
   and clipboard output are projections. Consequence: v2's remote handoff and any MCP sink become
   serializer swaps, not rewrites.
4. `0004-deno-first-toolchain-npm-specifiers.md` — Deno owns the dev loop; Playwright, esbuild,
   web-ext, and the font subsetter arrive via `npm:`. Alternative considered: a minimal
   `package.json` for the E2E stack. Consequence: occasional npm-compat friction accepted for one
   runtime and one task registry. Record the wave-5 Astro carve-out explicitly.
5. `0005-safari-deferred.md` — Safari needs `xcrun safari-web-extension-converter`, an Xcode
   project, a signed app wrapper, and a paid developer account. Out of scope for v1, but the code
   stays compatible: promise-based `browser.*`, no Chrome-only APIs, no `offscreen` dependency.
   Record the conversion path so picking it up later is mechanical.
6. `0006-closed-shadow-dom-for-injected-ui.md` — toolbar, picker overlay, and any in-page UI mount
   in a closed shadow root so arbitrary host CSS can't break them and extension styles can't leak
   onto the page under inspection (which would corrupt the very thing being screenshotted).
   Consequence: design tokens must be injected across the boundary deliberately.
7. `0007-playwright-chromium-plus-web-ext-coverage-split.md` — Playwright loads extensions only in
   Chromium via `launchPersistentContext` + `--load-extension`; no Firefox or WebKit equivalent
   exists. Chromium E2E is the per-commit gate, Firefox gets a `web-ext` smoke check, and API
   divergence is covered by unit tests against fakes. Consequence: never claim Firefox E2E parity.
8. `0008-preact-for-extension-ui-astro-for-marketing.md` — the design bundle ships JSX, so a JSX
   runtime ports it directly. Preact at ~4KB is chosen over React (~45KB into arbitrary third-party
   pages for no benefit at this surface area) and Lit (rewrites every prototype as tagged
   templates). Astro was evaluated and rejected for the extension: it's Vite/Node-based, its
   `security.csp` support emits a `<meta>` tag with hashes and doesn't work in dev, MV3 governs
   extension pages through `content_security_policy.extension_pages`, and decisively **a content
   script is not a page**, so Astro cannot build the overlay at all. Astro _is_ adopted for the
   wave-5 marketing site, where its Node toolchain stays isolated in `site/`.
9. `0009-no-remote-assets-vendored-fonts-and-icons.md` — the bundle loads Google Fonts and Lucide
   from CDNs. MV3 forbids remote code, and a remote font fetch from an injected overlay discloses to
   a third party which pages the user is annotating. Fonts are subset to WOFF2 and served from
   `web_accessible_resources`; Lucide icons are vendored as an inline SVG sprite at build time.
   Consequence: the build gains a subsetting step, and adding an icon means regenerating the sprite.
10. `0010-backdrop-luminance-theming-with-override.md` — the overlay is in a closed shadow root and
    cannot inherit the host page's theme, and a fixed dark overlay reads badly on a bright page. So
    theme is chosen by sampling backdrop luminance behind the toolbar, with an options override that
    force-pins dark or light. Record the known cost honestly: auto-adapt makes visual output
    page-dependent, so **tests must always force a theme**, and the override exists partly to make
    E2E screenshots deterministic.
11. `0011-generated-design-tokens-with-drift-check.md` — tokens are generated from
    `.claude-design/point-and-shoot/tokens/` into `src/shared/design/`, never hand-copied, because
    hand-copied tokens drift silently from the design source and drift is invisible in review. CI
    regenerates and fails on any diff. Consequence: token changes must be made upstream in the
    design bundle and re-exported.

**Verify:** all eleven exist; each is linked from `docs/adr/README.md` with a resolving link;
`grep -srniE 'TBD|TODO|FIXME|lorem' docs/adr docs/specs docs/tutorials docs/README.md docs/design.md`
prints nothing. Judge it on **output, not exit status**: `-s` silences the warning when one of those
directories does not exist yet (W1.4 creates them), but BSD grep still exits `2` there while GNU
grep exits `1`, so a status check passes or fails depending on the machine. `docs/plans/` is out of
scope deliberately — the plan files carry `SHA: _pending_` slots, the architecture review carries
`Effort: TBD` on every finding — both are the record working as intended — and this recipe's own
pattern string would otherwise match itself.

**Commit:** `docs: add ADRs 0001-0011 covering architecture, design, and toolchain decisions`

---

## W1.7 — CI workflow

- [x] `.github/workflows/ci.yml` — SHA: `df85366`

**Depends on:** W1.2.

**Why:** CI is the authoritative gate, and it must run the _same_ command as the pre-push hook so
local and remote cannot diverge.

**`.github/workflows/ci.yml`:**

- Triggers: `push` to `main`, and `pull_request`.
- One job `checks` on `ubuntu-latest`. Steps: `actions/checkout@v7` → `jdx/mise-action@v4` →
  `deno task ci`.
- Use `jdx/mise-action` rather than `denoland/setup-deno`: mise installs exactly what `mise.toml`
  pins, so CI and local machines resolve identical versions from one file. A separate `setup-deno`
  step would be a second place to bump Deno, and it would drift.
- `permissions: contents: read` at workflow level — least privilege by default.
- `concurrency` keyed on the ref with `cancel-in-progress: true`, so superseded pushes don't burn
  runners.
- Do **not** add `e2e-chromium`, `smoke-firefox`, `build`, or `tokens-drift` jobs. Each lands with
  the wave that implements what it tests. A job that runs nothing and reports green is worse than a
  missing job.

**Verify:**

```bash
git push -u origin feat/wave-1-plan
gh run watch --exit-status
```

**A workflow that has never executed is not verified.** Fix and re-push on failure; never check this
off against a red or absent run. Confirm the log shows Deno `2.9.4`, which proves `mise.toml` is
actually driving the CI toolchain.

**Commit:** `ci: run deno task ci via mise on push and pull request`

---

## W1.8 — Browser fixture app

- [x] `tests/fixtures/app/` + `deno task fixture` — SHA: `d391207`

**Depends on:** W1.2.

**Why:** every later wave's tests need pages that deliberately contain the hard cases — the ones the
selector engine and capture pipeline get wrong if nobody built a page to catch them. Build the
adversarial cases now, while it's cheap, instead of discovering them in wave 3.

**Files** under `tests/fixtures/app/`:

- `server.ts` — a small static server on `Deno.serve`. Directory listing off, correct MIME types,
  no-cache headers so reruns aren't stale.

  **Ports are OS-assigned, not fixed.** This plan originally called for a fixed port that tests
  hardcode; the first run proved why that is wrong — an unrelated local process already held the
  chosen port and the server died on `AddrInUse` before serving a single page. `port: 0` on both
  listeners, with `startFixtureServer()` returning the two resolved base URLs, makes the collision
  impossible instead of merely recoverable. Nothing is documented in `AGENTS.md`, because there is
  no number to document.

  Two listeners, not one: `iframe.html` needs a genuinely cross-origin frame, and the fixtures must
  run offline, so the second origin is the same directory on a second port — same host, different
  port, different origin, no network egress. Since that port is only known after binding,
  `iframe.html` carries a `__CROSS_ORIGIN__` placeholder that the server substitutes on the way out.
  The origin is written down once and cannot drift.

  `/favicon.ico` answers `204`, not `404`. Browsers request it unprompted on every navigation, and a
  `404` logs a console error on every fixture page — which buries the errors the fixtures exist to
  surface, and makes the zero-console-errors check below unpassable for the wrong reason.
- `index.html` — ordinary nested layout with: elements carrying `data-testid`, elements with no id
  or test id, several elements sharing an identical class list (so class-based selectors are
  ambiguous), a deeply nested button, and a list where sibling index is the only distinguishing
  feature.
- `dark.html` — light content on a near-black background. Exercises both picker-highlight contrast
  and the W1.6/ADR-0010 backdrop-luminance theming path.
- `light.html` — the bright-page counterpart, so the theme sampler has both poles to test against.
- `shadow.html` — one **open** and one **closed** shadow host with content in each. The closed host
  is the case the selector engine cannot traverse; the page exists so that limitation is tested and
  documented rather than discovered late.
- `iframe.html` — a same-origin and a cross-origin frame. Cross-origin is a hard content-script
  boundary; the page makes it explicit.
- `canvas.html` — a `<canvas>` with drawn content plus an inline `<svg>`: targets with no meaningful
  DOM interior, where the screenshot is the only signal.
- `tall.html` — content several viewports tall with a `position: sticky` header, for region clamping
  and the `truncated: true` path.

Every page: valid HTML5, **no external network requests** (tests must run offline), and a visible
`<h1>` naming the page so a screenshot is self-identifying.

**Add to `deno.json`:** task `fixture` → `deno run -A tests/fixtures/app/server.ts`.

**Verify:** `deno task fixture` serves; load every page and confirm **zero console errors**. Check
the console — don't assume. A fixture with a broken script produces mysterious test failures three
waves later.

Verified in Chrome via Playwright, and the assertions each page exists to support were checked
rather than eyeballed: the same-origin frame's `contentDocument` is reachable while the cross-origin
one is blocked, the open shadow root exposes its button while the closed one returns `null`, the
canvas holds real drawn pixels, and `tall.html`'s over-tall region measures larger than the
viewport. `server_test.ts` covers the path resolver's sad paths — plain traversal, percent-encoded
traversal, directory requests — because a fixture server that can be walked out of its own directory
is a local file-disclosure hole that stays silent until someone looks.

With `tests/` now holding real files, `--permit-no-files` comes off the `lint` and `test` tasks, as
W1.2's comment said it should: a mis-scoped `include` now fails loudly instead of passing silently.

**Commit:** `test: add browser fixture app covering selector and capture edge cases`

---

## W1.9 — Fixture screenshots for the PR

- [ ] `deno task shots` + committed screenshots — SHA: _pending_

**Depends on:** W1.8, W1.2.

**Why:** the project convention is that PRs carry screenshots of visible work. Wave 1's only visible
artifact is the fixture app, so shoot that. It also proves the Playwright plumbing works before wave
2 and wave 4 depend on it.

**Files:**

- `tests/shots.ts` — using `npm:playwright@1.62.0`: start the fixture server, launch Chromium, visit
  each fixture page, write a full-page PNG to `docs/assets/wave-1/<page>.png` at a fixed 1280×800
  viewport so images are comparable and deterministic.
- `deno.json` task `shots` → `deno run -A tests/shots.ts`.
- Commit the PNGs under `docs/assets/wave-1/`. Downscale any file over ~300KB.

First run needs the browser binary: `deno run -A npm:playwright@1.62.0 install chromium`. Document
it in `AGENTS.md` as one-time setup (W1.1 already lists this).

**PR embedding note:** GitHub does **not** render relative image paths in PR descriptions. Use the
raw blob form:
`https://github.com/whizzzkid/point-and-shoot/blob/feat/wave-1-plan/docs/assets/wave-1/index.png?raw=1`

**Verify:** `deno task shots` regenerates every PNG; each opens and shows the expected page with its
`<h1>` legible.

**Commit:** `test: add playwright fixture screenshot task and wave 1 assets`

---

## W1.10 — GitHub labels

- [ ] Labels created — no commit; verify with `gh label list`

**parallel-safe.**

Create with `gh label create <name> --color <hex> --description <text> --force` (`--force` makes
reruns idempotent):

- `area:content`, `area:background`, `area:sidepanel`, `area:build`, `area:ci`, `area:docs`,
  `area:shared`, `area:test`, `area:design`
- `type:feat`, `type:chore`, `type:docs`, `type:test`
- `size:s`, `size:m`, `size:l`
- `wave:1` … `wave:5`
- `parallel-safe` — no file overlap with other open work; safe to hand to a concurrent agent
- `blocked` — has an unmet dependency; do not start

**Verify:** `gh label list --limit 100` shows every label above.

---

## W1.11 — Branch protection and the tracking issue

- [ ] Protection configured, tracking issue opened — SHA: _pending_ (record the issue number here
      too)

**parallel-safe** with W1.10. W1.10 is `gh`-only; this item is `gh` plus one small docs commit (the
issue number), and it touches no file any other wave-1 item touches.

Two pieces of durable project infrastructure that the rest of the plan assumes exist.

**Branch protection on `main`.** W1.7 calls CI "the authoritative gate," but an unrequired GitHub
check is advisory: a PR with a red run stays mergeable, and the pre-push hook is bypassable by
`--no-verify` or by a machine without hooks installed. The authority the plan asserts is not
configured anywhere until this item. Require the `checks` context, require the branch be up to date
before merging, and require signed commits (the project signs already, so this codifies practice
rather than adding friction). Waves 2 and 4 extend the required-check list as they add jobs.

**The tracking issue.** [Rule 7](README.md#rules-for-working-any-wave) needs a status board that
survives every wave. No wave PR can be it — wave 1's PR (W1.12) closes on merge and its head branch
is typically deleted, after which four waves of post-merge syncs would be writing to a closed PR
that no one has reason to open. PR #1 is doubly unfit: it already merged, carrying only the plan and
the design bundle. Open a long-lived issue titled for v1, carrying the item checklist and the wave
status, labelled `wave:1`…`wave:5`. Every wave PR links to it; rule 7 targets it; it closes only
when v1 ships.

**Verify:**

```bash
gh api repos/whizzzkid/point-and-shoot/branches/main/protection   # required checks + signed commits
```

Then open a throwaway PR containing a deliberate lint error and confirm the merge button is blocked
— an unproven gate is not a gate, and this is the gate over all the other gates. Close the
throwaway. Confirm the tracking issue is open and referenced **by number** from
[`README.md`](README.md).

Recording that number is the one file change this item makes: edit the index's repo-facts bullet to
name the issue, and write the number into this item's checkbox line. That is a single docs commit —
`docs(plans): record the tracking issue number` — and it is the only commit W1.11 produces. The
branch-protection half touches no files at all.

---

## W1.12 — Pull request

- [ ] PR opened with screenshots — no commit; record the PR number here

**Depends on:** W1.1–W1.11 complete, CI green.

One PR for all of wave 1 against `main`. The body must contain:

- What wave 1 establishes, and the explicit statement that **no extension code ships in it**.
- A checklist mirroring W1.1–W1.11 with each commit SHA.
- A link to the W1.11 tracking issue, named as the status board that succeeds this PR.
- The fixture screenshots, embedded with the `?raw=1` blob URLs from W1.9.
- A **Verification** section listing each command run and its result. Every claim must map to a
  command actually executed; if something couldn't be verified, say so and why.
- A **Follow-ups** section naming what wave 1 deliberately leaves out: no `dist/`, no manifest, no
  extension load in Playwright yet, no Firefox smoke check, no token generation, and the
  closed-shadow-root traversal limitation recorded in the fixture app.

**After it merges:** run the post-merge plan sync — [rule 7](README.md#rules-for-working-any-wave).
Wave 1's integration branch _is_ this PR's branch, so this is the one wave whose sync happens on the
PR that is closing. Confirm every W1.x SHA in this file resolves post-merge, flip this wave's
**Status** to complete, and **hand the board over**: update the W1.11 tracking issue to show wave 1
done and wave 2 open, and leave a final line in this PR's body pointing at that issue as its
successor. From wave 2 onward, rule 7 targets the issue, not this PR.

**Verify:** `gh pr view --json number,title,body` renders as intended and `gh pr checks` is green.
Open the PR in a browser and confirm the screenshots actually display — raw-URL embedding is easy to
get subtly wrong.

---

## Wave 1 exit criteria

- W1.1–W1.11 all checked with real commit SHAs (W1.10 is the sole exception — it is `gh`
  verification only; W1.11 carries the commit that records its issue number).
- CI green on `feat/wave-1-plan`, run log showing Deno `2.9.4`.
- Lefthook proven to fire by W1.3's deliberate-failure test.
- `deno task ci` passes from a clean checkout after `mise install`.
- `deno task fixture` serves all seven fixture pages with zero console errors.
- `deno task shots` regenerates all screenshots.
- `.claude-design/` tracked in git, excluded from `deno fmt`/`deno lint`, and its export identity
  recorded in [`../design.md`](../design.md).
- `grep -srniE 'TBD|TODO|FIXME|lorem' docs/adr docs/specs docs/tutorials docs/README.md docs/design.md`
  prints nothing — judged on output, not exit status (see W1.6 for why).
- Branch protection on `main` requires the CI checks, and has been observed blocking a red PR.
- The tracking issue is open and is named as the status board in [`README.md`](README.md).
- PR open per W1.12 with screenshots rendering.
