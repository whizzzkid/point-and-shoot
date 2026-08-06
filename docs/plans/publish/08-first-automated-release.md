---
title: First automated store release and closeout
type: plan
status: draft
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - release
  - verification
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Build, release, and verification
    path-or-url: ../../specs/build-release-and-verification.md
---

# First automated store release and closeout

> **How to read this packet:** Treat the [stop condition](#coordination) as binding. Complete the
> release and installation checklists, transfer lasting knowledge in
> [Closeout](#closeout-checklist), then remove this temporary plan.

## Outcome

Prove the end-to-end release path on a new version: GitHub packages exact bytes, both stores accept
them automatically, public versions converge, website installation works, and temporary plan state
is retired into durable documentation.

## Coordination

- Status: pending
- Owner: user + agent
- Depends on: PR 6 merged and automatic publication enabled
- Scope: one real release, monitoring, recovery if required, durable documentation, and plan removal
- Stop condition: both public store versions equal the GitHub release version and install cleanly

## Read first

- `docs/plans/publish/07-activate-live-listings.md`
- the current release pull request
- `.github/workflows/release.yml`
- `.github/workflows/store-publish.yml`
- `docs/tutorials/releasing.md`
- both live store listings

## Release checklist

- [ ] Confirm the release PR version, changelog, manifest sources, candidate ZIPs, reviewer source,
      and build instructions agree.
- [ ] Install both candidate packages manually and complete capture, review, and export before
      merge.
- [ ] Confirm the release PR comment identifies the exact head SHA and all candidate artifacts.
- [ ] Merge the release PR only after required CI, review, and candidate testing are complete.
- [ ] Confirm the tag and GitHub release point to the exact release commit.
- [ ] Confirm all four final release assets exist and pass release validation.
- [ ] Watch Chrome submission, publish, warning, and public-version states to a terminal result.
- [ ] Watch Firefox listed submission and review states to a terminal public result.
- [ ] If either vendor rejects the version, record the response, fix source on `main`, and publish a
      new CalVer release; never replace or move an existing tag.
- [ ] Confirm the GitHub release status section retains both vendors' timestamps and versions.
- [ ] If the canonical current-version summary changed, update Chrome listing copy in the dashboard
      and record completion; confirm Firefox metadata received the new summary.
- [ ] Run reconciliation after both listings become public.

## Installation verification

- [ ] Open the website in a clean current Chromium profile, follow the recommended store action,
      install, and confirm the installed version.
- [ ] Complete one element capture, one region capture, note review, prompt copy, and ZIP export in
      Chromium.
- [ ] Open the website in a clean current Firefox profile, follow the recommended store action,
      install, and confirm the installed version.
- [ ] Complete one element capture, one region capture, note review, prompt copy, and ZIP export in
      Firefox.
- [ ] Confirm both listings and the website link to the same privacy policy and support address.

## Closeout checklist

- [ ] Update the release spec to state that store submission is automated and define the observed
      review/publication states.
- [ ] Update the release tutorial with any setup, retry, or recovery correction learned from the
      live release.
- [ ] Update the website spec with the verified browser-family and store-install behavior.
- [ ] Audit `AGENTS.md` against the actual generators and drift checks; remove inaccurate guidance.
- [ ] Record the store-metrics decision in the durable store-publication spec.
- [ ] Confirm README, website, privacy, store copy, screenshots, release status, and public versions
      agree with the live release.
- [ ] Remove `docs/plans/publish/` in the final closeout commit after transferring every lasting
      guarantee and unresolved follow-up to a spec, ADR, tutorial, issue, or PR.
- [ ] Run the full repository and website gates on the closeout commit.

## Acceptance evidence

- The GitHub release, Chrome listing, and Firefox listing show one matching version.
- Vendor submissions used the assets attached to that exact GitHub release.
- The marked release status section shows terminal public states for both stores.
- Website-driven clean installs and core flows pass in both browser families.
- Lasting behavior is documented, no completion knowledge exists only in this directory, and the
  temporary directory is removed.

## Incoming handoff

Record PR 6 URL, exact automation configuration, the candidate release PR URL, and any known vendor
review delay or restriction.

## Completion record

- Status: pending
- Owner: user + agent
- Started: not started
- Completed: not completed
- Release PR: none
- GitHub release: none
- Chrome public version: not recorded
- Firefox public version: not recorded
- Chromium install evidence: not recorded
- Firefox install evidence: not recorded
- Durable documentation commit: none
- Plan removal commit: none
- Deviations: none
