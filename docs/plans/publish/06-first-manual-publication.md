---
title: "Manual gate: First Chrome and Firefox publication"
type: plan
status: draft
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - manual-action
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Release tutorial
    path-or-url: ../../tutorials/releasing.md
---

# Manual gate: First Chrome and Firefox publication

> **How to read this packet:** This is a human-owned stop gate. Complete both store checklists and
> automation setup, verify [Acceptance evidence](#acceptance-evidence), then provide only the
> non-secret [Outgoing handoff](#outgoing-handoff).

## Outcome

Create and publish the first official listings with the exact release artifacts, capture their
stable identities, and configure vendor automation without placing credentials in the repository.

## Coordination

- Status: pending
- Owner: user
- Depends on: PR 5 merged; a GitHub release exists with all four validated artifacts
- Hard stop: no agent may start PR 6 until both public listing URLs and store identities are
  recorded
- Scope: vendor dashboards and GitHub repository/environment settings only; no repository commit

## Read first

- `docs/plans/publish/05-publishing-automation.md`
- `docs/tutorials/releasing.md`
- the target GitHub release and its store-status section
- the generated listing assets and canonical privacy copy
- current Chrome Web Store and Firefox Add-ons submission policies

## Chrome Web Store checklist

- [ ] Create or confirm the publisher account and complete identity/payment requirements.
- [ ] Upload `chrome.zip` from the target GitHub release, not a local rebuild.
- [ ] Confirm the uploaded manifest version equals the GitHub release version.
- [ ] Enter the canonical short and full descriptions, support email, homepage, documentation,
      source, and `https://pointandshoot.app/privacy/`.
- [ ] Verify ownership of `pointandshoot.app` using Google's current publisher-verification flow and
      select it as the listing's official URL.
- [ ] Upload the five screenshots in canonical order, the 440×280 small tile, and the 1400×560
      marquee tile.
- [ ] Enter the single-purpose and permission explanations from `store-listing.json` verbatim.
- [ ] Declare no remote code.
- [ ] Disclose locally handled website content, web history/page URL, user-authored notes, and
      selection activity; declare that none is collected or transmitted.
- [ ] Complete distribution, visibility, and region settings.
- [ ] Submit for review, resolve vendor feedback, and wait for the listing to become publicly
      installable.
- [ ] Record the extension ID, publisher ID, and final HTTPS listing URL in the completion record.

## Firefox Add-ons checklist

- [ ] Create or confirm the AMO developer account.
- [ ] Submit `firefox.zip` from the same GitHub release as a listed extension.
- [ ] Upload `firefox-source.zip` and `firefox-build-instructions.md` for reviewer reproduction.
- [ ] Confirm the add-on ID is `pointandshoot@whizzzkid.dev` and the version equals the GitHub
      release version.
- [ ] Enter the canonical description, support email, homepage, privacy URL, release notes, and the
      AMO license choice that matches the repository's GNU GPL v3-or-later grant.
- [ ] Upload compatible screenshots and complete required categories/platform metadata.
- [ ] Submit for review, resolve vendor feedback, and wait for the listing to become publicly
      installable.
- [ ] Record the AMO slug and final HTTPS listing URL in the completion record.

## Automation setup checklist

- [ ] Create the least-privilege Chrome Web Store service account and authorization described in the
      release tutorial.
- [x] Configure GitHub OIDC, repository variables, and the `browser-stores` environment for Chrome.
- [x] Create AMO JWT API credentials and store them as `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`
      environment secrets.
- [ ] Configure required reviewers on the protected GitHub environment if desired.
- [ ] Run the reusable workflow in reconcile mode against the already-public release.
- [ ] Confirm reconciliation reads both public versions correctly without uploading new bytes.
- [x] Set `STORE_PUBLISH_ENABLED=true` after both listings published and identities landed.

## Acceptance evidence

- Both public listing URLs open without developer authentication.
- Each public listing offers installation in its supported browser family.
- Both listings show the exact target GitHub release version.
- Both listings link to the verified website and public privacy policy.
- Reconciliation reports matching public versions and exposes no secret.

## Outgoing handoff

Provide only these non-secret values to PR 6:

- Chrome extension ID
- Chrome publisher ID
- Chrome listing URL
- Firefox AMO slug
- Firefox listing URL
- GitHub release URL and version used for first publication
- Any vendor-required copy or permission wording changes that must be made canonical

## Completion record

- Status: pending
- Owner: user
- Started: not started
- Completed: not completed
- Chrome extension ID: not recorded
- Chrome publisher ID: not recorded
- Chrome listing URL: not recorded
- Firefox AMO slug: not recorded
- Firefox listing URL: not recorded
- First public release: not recorded
- Reconciliation evidence: not recorded
- Vendor wording deviations: none
