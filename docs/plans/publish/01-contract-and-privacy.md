---
title: "PR 1: Store contract, privacy, and drift checks"
type: plan
status: complete
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - privacy
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Extension runtime
    path-or-url: ../../specs/extension-runtime.md
---

# PR 1: Store contract, privacy, and drift checks

> **How to read this packet:** Start with [Outcome](#outcome) and [Coordination](#coordination),
> preserve the [contract interface](#contract-interface), then execute the [Checklist](#checklist).

## Outcome

Create the single source of truth for store state and disclosures, publish a stable privacy URL, and
make permission, listing, website, and documentation drift fail locally and in CI.

## Coordination

- Status: complete
- Owner: Codex
- Depends on: none
- PR base: `main`
- PR boundary: contract, privacy page, checks, durable specs, and `AGENTS.md`; no badges or install
  CTA changes

## Read first

- `AGENTS.md`
- `build/manifest.ts`
- `docs/adr/0002-activetab-only-permission-model.md`
- `docs/adr/0009-no-remote-assets-vendored-fonts-and-icons.md`
- `docs/adr/0013-export-bundles-contain-page-data.md`
- `docs/specs/extension-runtime.md`
- `docs/specs/website-and-published-docs.md`
- `site/scripts/run-astro.mjs`

## File map

- `store-listing.json` — canonical identity, state, support, listing copy, privacy copy, and
  permission explanations.
- `build/store-listing.ts` — typed parsing, validation, and `check` mode.
- `build/store-listing.test.ts` — contract, drift, invalid-state, and permission coverage.
- `site/src/pages/privacy.astro` — stable public privacy policy at `/privacy/`.
- `docs/specs/store-publication.md` — durable listing, state, disclosure, and projection guarantees.
- `docs/specs/website-and-published-docs.md` — `/privacy/` publication and integrity guarantees.
- `deno.json` — the `store:check` task and `ci` inclusion.
- `.github/workflows/site.yml` — site checks when the root contract changes.
- `AGENTS.md` — rules that prevent store artifacts and disclosures from drifting.

## Contract interface

`store-listing.json` uses schema version `1` and these stable concepts:

- `support.email` is `support@pointandshoot.app`.
- `privacy.url` is `https://pointandshoot.app/privacy/`.
- `stores.chrome` owns `state`, `extensionId`, `publisherId`, and `listingUrl`.
- `stores.firefox` owns `state`, `slug`, `extensionId`, and `listingUrl`.
- Store state is one of `unpublished`, `submitted`, or `published`.
- Unknown identifiers and URLs are JSON `null` values.
- `listing.shortDescription` fits both manifest/store limits and remains consistent with
  `build/manifest.ts`.
- `listing.currentVersionSummary` is a concise capability summary owned by feature/release PRs, and
  `listing.fullDescription` projects it under **Current version**.
- `privacy.singlePurpose`, `privacy.permissions`, `privacy.remoteCode`, and
  `privacy.dataDisclosures` own the text submitted to the Chrome privacy form and rendered at
  `/privacy/`.

`build/store-listing.ts` exports `parseStoreListing(value: unknown): StoreListing`,
`validateStoreListing(root: URL): Promise<readonly StoreListingIssue[]>`, and a non-writing `check`
command. PR 2 adds `sync` with the marked README projection when that projection's public install
surface enters scope. Validation must reject:

- a published store without a syntactically valid HTTPS listing URL and identity;
- a non-published store with a public listing URL;
- support or privacy URLs that disagree with the canonical values;
- descriptions beyond vendor limits;
- permission explanation keys that differ from generated manifest permissions;
- a remote-code declaration other than `false`;
- missing required local-data disclosures;
- a Firefox extension ID that differs from `FIREFOX_EXTENSION_ID`; and
- public source files containing sentinel or dummy store URLs.

A validator cannot infer whether a capability changed by inspecting one repository snapshot.
`AGENTS.md` therefore owns the process invariant requiring feature and release PRs to make an
intentional `currentVersionSummary` decision.

`site/scripts/run-astro.mjs` copies the validated root contract to
`site/.generated/store-listing.json` before Astro starts. The privacy page and later install
component import only that generated file, so site builds never maintain a second copy.

## Required privacy copy

### Single purpose

Point & Shoot lets a user select a UI problem on the active page, annotate it, and export local
visual and structural evidence for a coding agent.

### Permission explanations

- `activeTab`: Temporarily accesses only the active tab after the user invokes Point & Shoot, so it
  can inspect the selected region and capture the visible page. It does not request persistent host
  access.
- `storage`: Saves extension settings and session pointers locally. Captures, screenshots, and notes
  remain in the browser's local IndexedDB storage until the user deletes them.
- `scripting`: Injects the packaged capture interface into the active tab after an explicit user
  gesture. It does not download or execute remote code.
- `downloads`: Creates a Markdown prompt or ZIP bundle only when the user chooses an export action.
- `clipboardWrite`: Copies the compiled prompt only when the user selects Copy prompt. The extension
  cannot read clipboard contents.
- `sidePanel`: Opens the Chrome review workspace where the user edits notes, compiles the prompt,
  and starts an export.

### Data and remote code declarations

- Remote code: No. Every executable asset ships in the extension package.
- Data handled locally: website content, page URL/web history for the active capture, user-authored
  notes, and selection/click activity needed for the chosen capture.
- Data collection: None. No handled data is transmitted off the device, sold, shared, used for
  advertising, or used for credit decisions.

## Checklist

- [x] Write failing tests for valid unpublished state, invalid published state, URL validation,
      description limits, Firefox ID drift, and permission additions/removals.
- [x] Add a test proving every generated Chrome and Firefox permission has exactly one explanation.
- [x] Add a test proving local-only page data is disclosed without being described as collected.
- [x] Implement schema version `1` in `store-listing.json` with both stores unpublished and all
      unknown public identities set to `null`.
- [x] Implement typed parsing and issue aggregation in `build/store-listing.ts`.
- [x] Add `store:check` and include it in the authoritative `deno task ci` sequence. Defer
      `store:sync` and its marked README projection to PR 2, which owns README install changes.
- [x] Project the validated contract into `site/.generated/store-listing.json` during each site
      check, build, and development-server start.
- [x] Render the canonical privacy copy at `/privacy/` with support contact and effective date.
- [x] Add `/privacy/` to site link, canonical URL, accessibility, and unexpected-resource checks.
- [x] Document store state transitions and canonical projection rules in the durable spec.
- [x] Record the store-metrics feasibility decision, supported AMO data, Chrome API limitation, and
      no-scraping rule in the durable spec.
- [x] Audit all of `AGENTS.md`, then add rules requiring listing copy, screenshots, README CTAs,
      privacy disclosures, permissions, release notes, and store status to change together.
- [x] Confirm the plan directory remains excluded from the published documentation manifest.
- [x] Run focused tests, `mise exec -- deno task ci`, and `npm run ci` from `site/`.
- [x] Commit the scoped contract and privacy implementation and open PR 1.

## Acceptance evidence

- The unpublished config renders no public store URL.
- A fixture permission added to either manifest makes `store:check` fail with the missing key.
- `/privacy/` builds with one H1, a canonical URL, the support address, every permission, the data
  declaration, and the no-remote-code declaration.
- PR 1 CI is green and its body includes the `/privacy/` preview.

## Incoming handoff

None.

## Completion record

- Status: complete
- Owner: Codex
- Started: 2026-08-04
- Completed: 2026-08-04
- PR: https://github.com/whizzzkid/point-and-shoot/pull/65
- Commits:
  - `dcbe7d98f177a18c0daa6325380d38145ba7471b` — publication rollout plan
  - `48e5c575290ff1d656c87dde16fdb88ceaa5d55a` — canonical listing contract and checks
  - `e688f281d5959246a3cb42baaeed3f6774f3e044` — public privacy policy
  - `dbb194a37ea52f2693f483bdd6511018de50780d` — adversarial fail-closed corrections
  - `4764c7f2a5bfc10e0b1627fe2afdc46e0286ac9e` — synchronized `main`
- Verification:
  - `mise exec -- deno task ci` — 336 tests passed.
  - `npm run ci` from `site/` — 24 tests passed; 19 pages, 17 published docs, 7 diagrams, and 21
    external links checked.
  - `npm run a11y` from `site/` — no serious or critical Axe findings on three surfaces.
  - Adversarial contract probes — malformed dates, polluted URLs, name/support drift, nested site
    source, and published-doc sentinels all fail closed.
  - GitHub Actions
    [extension CI](https://github.com/whizzzkid/point-and-shoot/actions/runs/30976411753) and
    [site CI](https://github.com/whizzzkid/point-and-shoot/actions/runs/30976411755) passed on
    `4764c7f2a5bfc10e0b1627fe2afdc46e0286ac9e`.
- Deviations: README projection and `store:sync` moved to PR 2 to preserve this packet's no-README
  boundary. Capability-summary intent is enforced as an `AGENTS.md` review invariant because a
  single-snapshot validator cannot infer whether shipped behavior changed. Adversarial review added
  one fail-closed correction commit, and the ready PR merged current `main` without rewriting its
  reviewed commits.
