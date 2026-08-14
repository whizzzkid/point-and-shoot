# Architecture decision records

An ADR records _why_ a decision was made, what was rejected, and what consequences were accepted. It
is written once, at decision time, and is **immutable once accepted**. A decision that turns out
wrong is not edited — it gets a successor ADR that supersedes it and links back, because the record
of having believed something is itself the value.

Read the ADR before arguing with a rule it produced. Most rules in this repo that look arbitrary
have one behind them.

## Index

| #                                                               | Title                                                            | Status              |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------- |
| [0001](0001-offscreencanvas-over-chrome-offscreen.md)           | Use OffscreenCanvas for image work, not the Chrome offscreen API | Accepted 2026-07-24 |
| [0002](0002-activetab-only-permission-model.md)                 | Request activeTab only, never broad host permissions             | Accepted 2026-07-24 |
| [0003](0003-json-canonical-markdown-projection.md)              | Versioned JSON is canonical; Markdown is a projection            | Accepted 2026-07-24 |
| [0004](0004-deno-first-toolchain-npm-specifiers.md)             | Deno owns the dev loop; Node tooling via npm: specifiers         | Superseded by 0019  |
| [0005](0005-safari-deferred.md)                                 | Safari is deferred past v1, but the code stays convertible       | Accepted 2026-07-24 |
| [0006](0006-closed-shadow-dom-for-injected-ui.md)               | Mount injected UI in a closed shadow root                        | Accepted 2026-07-24 |
| [0007](0007-playwright-chromium-plus-web-ext-coverage-split.md) | Chromium E2E via Playwright, Firefox via a web-ext smoke check   | Accepted 2026-07-24 |
| [0008](0008-preact-for-extension-ui-astro-for-marketing.md)     | Preact for the extension UI; Astro only for marketing            | Superseded by 0018  |
| [0009](0009-no-remote-assets-vendored-fonts-and-icons.md)       | No remote assets: fonts subset locally, icons vendored           | Accepted 2026-07-24 |
| [0010](0010-backdrop-luminance-theming-with-override.md)        | Theme by sampling backdrop luminance, with a user override       | Accepted 2026-07-24 |
| [0011](0011-generated-design-tokens-with-drift-check.md)        | Generate design tokens from the bundle, fail CI on drift         | Accepted 2026-07-24 |
| [0012](0012-dynamic-web-accessible-resource-urls.md)            | Rotate Chrome web-accessible resource URLs per session           | Accepted 2026-07-28 |
| [0013](0013-export-bundles-contain-page-data.md)                | Disclose page data before export                                 | Accepted 2026-07-28 |
| [0014](0014-toolbar-action-opens-popup.md)                      | Let the toolbar action open the launcher popup                   | Superseded by 0016  |
| [0015](0015-main-world-framework-probes.md)                     | Run opt-in framework probes in a constrained main-world call     | Accepted 2026-07-28 |
| [0016](0016-toolbar-action-controls-session.md)                 | Let the toolbar action control the session                       | Accepted 2026-07-30 |
| [0017](0017-release-please-with-calendar-versions.md)           | Use Release Please with calendar versions                        | Accepted 2026-07-31 |
| [0018](0018-astro-for-marketing-and-documentation.md)           | Astro for the marketing and documentation site                   | Superseded by 0019  |
| [0019](0019-deno-owned-repository-toolchain.md)                 | Deno owns the repository toolchain                               | Accepted 2026-08-05 |
| [0020](0020-site-theme-override-on-top-of-system-preference.md) | Site theme override layers on top of the system preference       | Accepted 2026-08-13 |
| [0021](0021-session-domain-field.md)                            | Capture the session domain at start and migrate stored records   | Accepted 2026-08-14 |

Six of these are load-bearing constraints rather than preferences, and reversing one by accident is
easy: **0001** (no `chrome.offscreen`), **0002** (no broad host permissions), **0005** (no
Chrome-only APIs), **0009** (no remote fetches, including fonts), and **0012** (no stable Chrome
resource URLs), and **0015** (no page-world bridge carrying extension data or APIs). `AGENTS.md`
restates the product-wide rules; this is where the reasoning lives.

## Filing a new one

- Filename is `NNNN-kebab-slug.md`, zero-padded to four digits, numbered in the order decisions are
  accepted — never renumbered.
- Add a row to the index above in the same commit. An ADR missing from the index is an ADR nobody
  finds.
- Status is one of `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, or `Rejected`. Carry the date
  the status was reached.
- Supersede rather than edit. The successor names its predecessor in **Context**; the predecessor's
  status flips to `Superseded by ADR-NNNN` — that status line is the only edit an accepted ADR ever
  takes.

## Template

Copy this into the new file and fill every section. An empty section means the decision was not
actually made yet.

```markdown
# ADR-NNNN — Title in sentence case

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context

What forced a decision. The constraint, the conflict, or the discovery — enough that a reader who
was not there can see why doing nothing was not an option. Name the specific platform limits,
because those are what make the alternatives unequal.

## Decision

What was decided, in the imperative. One decision per ADR.

## Consequences

What this costs and what it forecloses. Write the uncomfortable ones down: the thing that is now
harder, the feature that is now off the table without revisiting this record, the extra build step
someone will hit. An ADR listing only benefits is marketing, not a record.

## Alternatives considered

Each alternative, and the specific reason it lost. "We preferred X" is not a reason; "X has no
Firefox equivalent, so it forks the codebase" is.
```
