---
title: "PR 6: Activate live store listings"
type: plan
status: draft
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
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

## Outcome

Replace null store identities with verified public values, enable canonical store links everywhere,
and turn on automatic submission only after all fail-closed checks pass.

## Coordination

- Status: pending
- Owner: unassigned
- Depends on: manual gate complete
- PR base: `main` after PR 5 merges
- PR boundary: canonical identity/state transition, regenerated projections, GitHub variables, and
  live-link verification; no unrelated feature work

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

Paste the non-secret completion values from the manual gate and note vendor wording changes.

## Completion record

- Status: pending
- Owner: unassigned
- Started: not started
- Completed: not completed
- PR: none
- Commit: none
- Live-link verification: not run
- Browser installation verification: not run
- Automation enablement: disabled
- Deviations: none
