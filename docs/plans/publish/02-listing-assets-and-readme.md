---
title: "PR 2: Listing assets and README install flow"
type: plan
status: draft
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - assets
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Design guide
    path-or-url: ../../design.md
---

# PR 2: Listing assets and README install flow

> **How to read this packet:** Confirm [Coordination](#coordination), use the named
> [screenshot set](#screenshot-set), then execute the [Checklist](#checklist) and record evidence.

## Outcome

Generate vendor-compliant listing images from current product sources and add honest Chrome and
Firefox install surfaces to the repository without exposing unusable links before publication.

## Coordination

- Status: pending
- Owner: unassigned
- Depends on: PR 1 complete
- PR base: PR 1 branch until PR 1 merges
- PR boundary: store artwork, asset generation/checking, README install flow, and listing copy; no
  website browser detection

## Read first

- `docs/plans/publish/01-contract-and-privacy.md`
- `store-listing.json`
- `README.md`
- `docs/design.md`
- `.claude-design/point-and-shoot/readme.md`
- `tests/visual/baselines/`
- `docs/assets/note-hover-highlight.png`

## File map

| Path                         | Responsibility                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `build/store-assets.ts`      | Deterministic screenshot composition, tile generation, and format checks        |
| `build/store-assets.test.ts` | Dimensions, color mode, alpha, source freshness, and deterministic output tests |
| `docs/assets/store/`         | Five listing screenshots, two promo tiles, and official store badges            |
| `README.md`                  | Browser store install flow with source-install fallback while unpublished       |
| `store-listing.json`         | Final launch description and screenshot ordering                                |
| `build/store-listing.ts`     | Marked README projection for unpublished and published states                   |
| `deno.json`                  | `store:assets` and `store:assets:check` tasks, with drift check in CI           |
| `AGENTS.md`                  | Generated-asset ownership and screenshot-refresh triggers                       |

## Screenshot set

Use these five current product scenes. Reuse the toolbar image directly because it already meets the
required dimensions. Recapture the other four scenes at a 1280×800 store viewport from their
existing fixtures; use the current images as composition references rather than scaling or padding
them. Every output is full bleed with square corners.

| Order | Subject                          | Existing source or reference              | Treatment             |
| ----- | -------------------------------- | ----------------------------------------- | --------------------- |
| 1     | Capture toolbar on a page        | `tests/visual/baselines/toolbar-dark.png` | Reuse directly        |
| 2     | Notes review workspace           | `tests/visual/baselines/notes-dark.png`   | Recapture its fixture |
| 3     | Hover highlight linked to a note | `docs/assets/note-hover-highlight.png`    | Recapture its fixture |
| 4     | Compiled plan                    | `tests/visual/baselines/plan-dark.png`    | Recapture its fixture |
| 5     | Privacy and behavior settings    | `tests/visual/baselines/options-dark.png` | Recapture its fixture |

Do not use `docs/assets/export-actions.png`; it contains the removed export-budget interface. Do not
use popup-only artwork in the first five because it explains less of the end-to-end workflow.

## Listing copy

The full description must stay below 16,000 characters and include:

- the Point, Shoot, Review, and Export workflow;
- the evidence captured: screenshot, URL, selectors, DOM text, metadata, and computed styles;
- local-only processing and `activeTab`-only access;
- Chrome/Chromium and Firefox/Gecko support, with Safari deferred;
- **Current version**, a short canonical capability summary updated when shipped behavior changes;
- support requests at `support@pointandshoot.app`; and
- links to the privacy policy, documentation, and source.

The opening paragraph is the store summary:

> Point at a UI problem, capture its visual and structural evidence, and export a fix-ready prompt
> for your coding agent.

## Checklist

- [ ] Write failing tests for all seven output dimensions, JPEG or PNG color type 2 RGB encoding,
      deterministic bytes, missing inputs, and stale generated output.
- [ ] Implement 1280×800 screenshot composition using product tokens and vendored fonts.
- [ ] Generate a text-free 440×280 small promo tile focused on the crosshair and fix-ready evidence.
- [ ] Generate a text-free 1400×560 marquee tile showing capture-to-agent handoff.
- [ ] Add official Chrome Web Store and Firefox Add-ons badges from vendor-provided sources, retain
      their aspect ratios, and record source URLs in generator metadata.
- [ ] Add `store:assets` and `store:assets:check`; include the check in `deno task ci`.
- [ ] Add screenshot ordering and complete launch copy to `store-listing.json`.
- [ ] Add a current-version summary check that requires feature PRs changing public capabilities to
      update the summary or record that the existing summary remains accurate.
- [ ] Add a README **Install** section that shows both browsers and source installation.
- [ ] While store state is unpublished, do not render either official store badge; retain **Build
      from source** as the only install action and state that store publication is in progress.
- [ ] When state becomes published, make each badge link to its canonical listing without a README
      edit beyond the config transition.
- [ ] Add concise alt text that states the user-visible outcome of every image.
- [ ] Document screenshot-refresh triggers in `AGENTS.md`: visible features, permissions, settings,
      export behavior, listing copy, or a release's current-version summary.
- [ ] Run asset tests twice and compare hashes, then run `mise exec -- deno task ci`.
- [ ] Visually inspect all seven outputs at original resolution and attach them to PR 2.
- [ ] Commit in the two boundaries listed in the parent plan and open PR 2.

## Acceptance evidence

- Exactly five opaque 1280×800 screenshots exist.
- Both promo tiles have exact vendor dimensions and no alpha channel.
- Re-running the generator produces no diff.
- The README has no broken or dummy store URL in unpublished state.
- PR 2 CI is green and its body displays all listing artwork at full-size links.

## Incoming handoff

Record any asset-source substitutions, final output filenames, and generator interface changes.

## Completion record

- Status: pending
- Owner: unassigned
- Started: not started
- Completed: not completed
- PR: none
- Commits: none
- Verification: not run
- Deviations: none
