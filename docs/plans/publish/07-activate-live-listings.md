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

Both stores are now publicly installable (2026-08-14):

- Chrome: `https://chromewebstore.google.com/detail/point-shoot/efiaamiohjjhhcgeaihgmbajnamhbahb`
- Firefox: `https://addons.mozilla.org/firefox/addon/point-and-shoot/`
- Chrome extension ID: `efiaamiohjjhhcgeaihgmbajnamhbahb`
- Chrome publisher ID: `d40d655e-e8ab-491b-9fc7-f5220fdca1c7`
- Firefox extension ID: `pointandshoot@whizzzkid.dev`
- Firefox slug: `point-and-shoot`

## Automation enablement checklist

Both Chrome and Firefox submissions are automated by `.github/workflows/store-publish.yml`. The
workflow fires automatically after every GitHub release (via `release.yml`). To enable it:

### Repository variables (`Settings > Secrets and variables > Actions > Variables`)

- [ ] `STORE_PUBLISH_ENABLED` = `true` (fail-closed gate; any other value runs the `disabled` job)
- [ ] `CHROME_EXTENSION_ID` = `efiaamiohjjhhcgeaihgmbajnamhbahb`
- [ ] `CHROME_PUBLISHER_ID` = `d40d655e-e8ab-491b-9fc7-f5220fdca1c7`
- [ ] `GCP_WORKLOAD_IDENTITY_PROVIDER` = full GCP Workload Identity Provider resource name
- [ ] `GCP_SERVICE_ACCOUNT` = GCP service account linked in the Chrome Web Store developer dashboard

### Protected environment secrets (`Settings > Environments > browser-stores`)

Create a protected GitHub environment named `browser-stores`, then add:

- [ ] `WEB_EXT_API_KEY` = AMO JWT issuer from Firefox Add-ons developer account
- [ ] `WEB_EXT_API_SECRET` = AMO JWT secret from Firefox Add-ons developer account

### Chrome OIDC setup (GCP Workload Identity Federation)

The Chrome publishing step authenticates via OIDC — no long-lived API key. Required GCP setup:

1. Create a GCP project (or reuse an existing one) with the Chrome Web Store API enabled.
2. Create a service account with `chromewebstore` scope.
3. Create a Workload Identity Pool and Provider configured for GitHub Actions OIDC
   (`token.actions.githubusercontent.com`), restricted to this repository.
4. Link the service account in the Chrome Web Store developer dashboard.
5. Set `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` as repository variables.

### Firefox AMO credentials

1. Go to Firefox Add-ons developer hub > API Keys.
2. Generate a JWT issuer and secret.
3. Set `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` as secrets on the `browser-stores` environment.

### Verification

After setting all variables and secrets:

1. Set `STORE_PUBLISH_ENABLED` = `true`.
2. Merge a conventional `feat:` or `fix:` commit to `main` to trigger a release PR.
3. Merge the release PR.
4. Watch the store-publish workflow: it should submit to both Chrome and Firefox, then update the
   GitHub release body with publication status.
5. Confirm both stores show the new version.

## Completion record

- Status: in progress
- Owner: user
- Started: 2026-08-14
- Completed: not completed
- PR: #96 (Chrome activation), #90 (Firefox activation)
- Commit: pending
- Live-link verification: both listings verified reachable
- Browser installation verification: not run
- Automation enablement: pending GCP WIF + AMO credentials
- Deviations: activated stores separately (Firefox first in #90, Chrome in #96) rather than together
  as originally planned; automation enablement deferred to after identity PRs merge
