---
title: "PR 5: Store publishing automation"
type: plan
status: complete
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-05
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - release
  - automation
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Release tutorial
    path-or-url: ../../tutorials/releasing.md
---

# PR 5: Store publishing automation

> **How to read this packet:** Confirm [Coordination](#coordination), preserve the
> [automation interface](#automation-interface) and secret boundary, then execute the
> [Checklist](#checklist).

## Outcome

Add retryable, least-privilege automation that submits the exact assets from a new GitHub release to
both stores, verifies vendor acceptance, and remains safely disabled until the first manual listings
establish live identities and credentials.

## Coordination

- Status: complete
- Owner: Codex
- Depends on: PR 4 complete
- PR base: PR 4 branch until PR 4 merges
- PR boundary: vendor clients, reusable workflow, tests, status reconciliation, and operator docs;
  store identities remain unset and automatic submission remains disabled

## Read first

- `docs/plans/publish/04-release-surfaces.md`
- `store-listing.json`
- `.github/workflows/release.yml`
- `build/release.ts`
- `docs/specs/build-release-and-verification.md`
- `docs/tutorials/releasing.md`
- Chrome Web Store API v2 upload, publish, and fetch-status documentation
- Chrome Web Store service-account documentation
- Mozilla `web-ext sign` and source-submission documentation

## File map

- `scripts/chrome-store.ts` — upload, publish, poll, reconcile, and redact Chrome API v2 operations.
- `scripts/chrome-store.test.ts` — success, warning, rejection, timeout, retry, and mismatch HTTP
  fixtures.
- `scripts/firefox-store.ts` — listed submission, source upload, metadata, polling, and
  reconciliation.
- `scripts/firefox-store.test.ts` — accepted, review, rejection, duplicate, and mismatch fixtures.
- `scripts/store-release.ts` — exact release-asset validation, per-store orchestration, and status.
- `scripts/store-release.test.ts` — version binding, retry, partial success, and secret redaction.
- `.github/workflows/store-publish.yml` — reusable submission, retry, and reconciliation entry
  point.
- `.github/workflows/release.yml` — reusable workflow call after final assets exist.
- `build/release-workflow.test.ts` — trigger, permission, secret-boundary, and exact-release checks.
- `docs/specs/build-release-and-verification.md` — automated publication and failure states.
- `docs/tutorials/releasing.md` — setup, enablement, retry, rejection, rollback, and rotation.

## Automation interface

The reusable workflow accepts `tag_name`, `release_sha`, and operation `submit | reconcile`. It also
supports `workflow_dispatch` for an exact existing tag. It must:

1. Stop successfully with a visible disabled status when `STORE_PUBLISH_ENABLED` is not `true`.
2. Resolve the release by exact tag and confirm its target SHA equals `release_sha`.
3. Download the four release assets and run the same release validation used before upload.
4. Submit Chrome and Firefox independently so one vendor's failure does not erase the other's state.
5. Update only the marked store-status section of the GitHub release.
6. Return failure when submission bytes/version differ, credentials are missing after enablement,
   vendor warnings are configured to block, or the vendor rejects the upload.
7. Treat an already-uploaded matching version as idempotent success and continue reconciliation.

Package automation does not scrape or mutate Chrome listing copy because the official v2 resources
do not expose that operation. When canonical copy changes, the workflow carries the manual action
from the release status contract until an operator confirms the dashboard update.

`scripts/chrome-store.ts` uses Chrome Web Store API v2 only. Authentication uses a Google service
account through GitHub OIDC where the account supports it; no long-lived OAuth refresh token is the
preferred path. The client uploads the Chrome ZIP, checks upload state, publishes with warning
blocking enabled, polls fetch status, and verifies `crxVersion`.

`scripts/firefox-store.ts` extracts the attached `firefox.zip` into a temporary source directory,
invokes exactly `web-ext` 10.5.0 for a listed-channel submission, supplies the generated metadata
and release notes, and uploads `firefox-source.zip`. It verifies the stable Gecko extension ID,
compares the submitted file set and manifest version with the release asset, and records the
returned add-on/version review state.

## Repository configuration

Use a protected `browser-stores` GitHub environment. The activation packet fills these names after
manual publication:

| Kind                | Name                             | Initial state |
| ------------------- | -------------------------------- | ------------- |
| Repository variable | `STORE_PUBLISH_ENABLED`          | `false`       |
| Repository variable | `CHROME_EXTENSION_ID`            | absent        |
| Repository variable | `CHROME_PUBLISHER_ID`            | absent        |
| Repository variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` | absent        |
| Repository variable | `GCP_SERVICE_ACCOUNT`            | absent        |
| Environment secret  | `WEB_EXT_API_KEY`                | absent        |
| Environment secret  | `WEB_EXT_API_SECRET`             | absent        |

The workflow validates variables against `store-listing.json`. Secret values must be masked before
any subprocess starts, and caught errors must never serialize request headers or full responses.

## Checklist

- [x] Verify every external endpoint, status field, action version, and `web-ext` flag against the
      current official vendor documentation and each CLI's help output.
- [x] Write Chrome HTTP fixtures before implementing the client.
- [x] Implement Chrome upload, blocking publish, status polling with bounded backoff, and version
      reconciliation.
- [x] Write Firefox process/API fixtures before implementing the client.
- [x] Implement listed submission with reviewer source, metadata, release notes, and review-state
      reconciliation.
- [x] Write orchestrator tests for exact tag/SHA/version binding, partial success, safe retry,
      disabled mode, missing credentials, timeout, and redacted errors.
- [x] Implement the reusable workflow with minimal permissions and the protected environment.
- [x] Call the reusable workflow directly from the current release workflow after final asset
      verification; do not depend on a `GITHUB_TOKEN`-created release event starting another
      workflow.
- [x] Keep automatic submission disabled and prove a release completes without accessing secrets.
- [x] Add a scheduled or manually dispatchable reconciliation operation that performs no upload.
- [x] Update release status after each store changes state and preserve the other store's last known
      result.
- [x] Preserve and surface the manual Chrome listing-copy action without blocking package upload or
      silently marking copy parity complete.
- [x] Document Google service-account/OIDC setup, AMO API credential setup, GitHub configuration,
      enablement, rotation, retry, rejection, and emergency disablement.
- [x] Add tests proving pull-request workflows and forked contexts cannot access publication
      secrets.
- [x] Run focused script tests, action linting, `mise exec -- deno task ci`, and a disabled-mode
      workflow exercise against a test release or controlled fixture.
- [x] Commit in the two boundaries listed in the parent plan and open PR 5.

## Acceptance evidence

- Disabled mode reads no vendor secret and performs no upload.
- A matching retry is idempotent; a mismatched version is blocked.
- Logs and status output contain no credential or authorization header.
- The release workflow hands the exact validated release assets to the reusable workflow.
- Both vendor clients pass success, failure, warning, rejection, timeout, and retry fixtures.
- PR 5 CI is green while `STORE_PUBLISH_ENABLED` remains `false`.

## Incoming handoff

- Inputs: exact `tag_name`, exact `release_sha`, and `submit | reconcile`; manual dispatch exposes
  the same interface.
- Actions: `actions/checkout@v7`, `jdx/mise-action@v4`, and `google-github-actions/auth@v3` on
  `ubuntu-24.04`.
- Repository configuration: `STORE_PUBLISH_ENABLED`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`,
  `GCP_WORKLOAD_IDENTITY_PROVIDER`, and `GCP_SERVICE_ACCOUNT` variables; `WEB_EXT_API_KEY` and
  `WEB_EXT_API_SECRET` secrets in the protected `browser-stores` environment.
- Chrome: API v2 upload accepts `SUCCEEDED | IN_PROGRESS | FAILED`; revision states map
  `PENDING_REVIEW` to submitted, `STAGED | PUBLISHED | PUBLISHED_TO_TESTERS` to reviewed or public,
  and `REJECTED | CANCELLED` to actionable failure. Unknown states and malformed successful JSON
  fail closed. Upload and publish polling use at most six attempts separated by five seconds.
- Firefox: every version-detail reconciliation carries a fresh 60-second HS256 AMO JWT. `public`,
  `unreviewed`, and `disabled` map to published, submitted, and rejected. A duplicate-like `web-ext`
  failure succeeds only after authenticated reconciliation finds the exact version.
- `web-ext` runs with an empty inherited environment and receives only the two AMO credentials.
  Chrome uses a short-lived OIDC access token; no long-lived Google credential is supported.
- Disabled mode validates tag, checkout, and requested SHA, preserves existing same-version vendor
  state, adds a separate disabled notice, and resolves no vendor secret.
- Chrome listing-summary follow-up is derived by comparing the current tagged contract with the
  preceding `v*` tag. A missing prior contract fails safe as changed.

## Completion record

- Status: complete
- Owner: Codex
- Started: 2026-08-05T16:29:26Z
- Completed: 2026-08-05T16:58:14Z
- PR: https://github.com/whizzzkid/point-and-shoot/pull/77
- Commits: `c444f47`, `c8897a4`, `a20ccc4`, `c051962`
- Verification: current official Chrome Web Store API v2, Chrome service-account, Google OIDC, AMO
  API v5/JWT, and Mozilla `web-ext` documentation; `web-ext` 10.5.0 `sign --help`; 27 focused tests;
  Ruby YAML parse of both release workflows; `mise exec -- deno task ci` with 398 passing tests;
  independent adversarial re-review clear; exact-head GitHub CI and site workflows green.
- Deviations: the pinned toolchain has no local `actionlint`, so local workflow validation used a
  YAML parse and the exact-head GitHub run. Disabled mode was exercised through the controlled CLI
  fixture rather than by mutating a disposable GitHub release. No live vendor request was made.
