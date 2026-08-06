---
title: "PR 6: Activate live store listings"
type: plan
status: blocked
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-06
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - activation
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Website and published documentation
    path-or-url: ../../specs/website-and-published-docs.md
---

# PR 6: Activate live store listings

> **How to read this packet:** Start only after the manual gate is complete. Use its non-secret
> values as [Incoming handoff](#incoming-handoff), execute the [Checklist](#checklist), and enable
> automation only after reconciliation passes.

The `[DNM]` draft is a coordination scaffold, not the start of activation. Every checklist item
remains unchecked and the canonical contract retains `null` values while this packet is blocked.

## Outcome

Replace null store identities with verified public values, enable canonical store links everywhere,
and turn on automatic submission only after all fail-closed checks pass.

## Coordination

- Status: blocked
- Owner: Codex
- Depends on: manual gate complete
- Upstream delivery: PRs [#65](https://github.com/whizzzkid/point-and-shoot/pull/65),
  [#67](https://github.com/whizzzkid/point-and-shoot/pull/67),
  [#70](https://github.com/whizzzkid/point-and-shoot/pull/70), and
  [#75](https://github.com/whizzzkid/point-and-shoot/pull/75) merged as one stack on 2026-08-06.
- Remaining prerequisite: PR [#77](https://github.com/whizzzkid/point-and-shoot/pull/77) is open
  against `main` and remains the only code prerequisite for this packet.
- PR base: PR 5 branch until PR 5 merges; intentionally not registered in the `gh stack`
- PR boundary: canonical identity/state transition, regenerated projections, GitHub variables, and
  live-link verification; no unrelated feature work
- Merge gate: `[DNM]` until both official listings are publicly installable and the manual packet
  supplies every non-secret identity below

## Read first

- `docs/plans/publish/06-first-manual-publication.md`
- `store-listing.json`
- the live Chrome and Firefox listings
- the first public GitHub release and reconciliation result
- `README.md`
- `site/src/components/InstallActions.astro`
- `.github/workflows/store-publish.yml`

## Checklist

- [ ] Independently open both recorded listing URLs and confirm their IDs/slugs and public versions.
- [ ] Write failing contract tests using the verified published identities and URLs.
- [ ] Change both canonical store states from `unpublished` to `published` and replace each required
      `null` identity with the verified value.
- [ ] Incorporate any vendor-approved wording changes into canonical copy, privacy, and tests.
- [ ] Regenerate listing projections and assets; confirm the generated diff contains only expected
      state, URL, copy, and release-note changes.
- [ ] Verify README badges now link to the correct stores and source install remains available.
- [ ] Verify the website recommends Chrome for Chromium, Firefox for Gecko, and neither for
      Safari/unknown while always showing both published store actions on desktop.
- [ ] Verify `/privacy/`, support contact, documentation, and source links from each live listing.
- [ ] Set the non-secret repository variables to the exact values in `store-listing.json`.
- [ ] Run the workflow in reconcile mode and confirm repository, GitHub release, and stores agree.
- [ ] Set `STORE_PUBLISH_ENABLED=true` only after reconciliation passes.
- [ ] Run a dry reconciliation again and prove enablement does not upload without a new version.
- [ ] Install from `pointandshoot.app` in one current Chromium browser and one current Firefox
      browser, then complete capture, review, and export in each.
- [ ] Run `mise exec -- deno task ci`, `npm run ci`, site a11y, site Lighthouse, and all focused
      store checks.
- [ ] Attach live listing, website recommendation, and installed-extension evidence to PR 6.
- [ ] Commit with `chore(store): activate published extension listings` and open PR 6.

## Acceptance evidence

- No dummy, sentinel, or null public store link appears in generated surfaces.
- Every public surface resolves to the same two canonical listing URLs.
- Reconcile mode reports the first public release for both stores.
- `STORE_PUBLISH_ENABLED=true` is set only after the PR's exact config passes reconciliation.
- A fresh website-driven install and core flow succeed in Chromium and Firefox.
- PR 6 CI is green.

## Incoming handoff

The branch and draft pull request were scaffolded before publication at the user's direction. Do not
substitute dummy values: `store-listing.json` must keep unknown vendor values as `null` until the
manual gate supplies all of the following:

- Chrome extension ID: pending manual publication
- Chrome publisher ID: pending manual publication
- Chrome listing URL: pending manual publication
- Firefox AMO slug: pending manual publication
- Firefox listing URL: pending manual publication
- First public GitHub release URL and version: pending manual publication
- Vendor wording changes: pending manual publication

## Completion record

- Status: blocked
- Owner: Codex
- Started: 2026-08-05T16:58:14Z
- Completed: not completed
- PR: [#78](https://github.com/whizzzkid/point-and-shoot/pull/78), draft `[DNM]`
- Commit: `92c283fef71a8c0f080927f11ac93c28ba8b3714` (coordination scaffold only)
- Live-link verification: not run
- Browser installation verification: not run
- Automation enablement: disabled
- Deviations: PRs 1–4 merged before the manual gate. This branch remains based directly on open PR 5
  and is deliberately excluded from `gh stack`; no activation value or public projection changes
  until the gate is complete.
