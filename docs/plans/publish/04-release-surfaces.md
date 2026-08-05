---
title: "PR 4: Exact release artifacts and install status"
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
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Build, release, and verification
    path-or-url: ../../specs/build-release-and-verification.md
---

# PR 4: Exact release artifacts and install status

> **How to read this packet:** Confirm [Coordination](#coordination), preserve the
> [artifact](#artifact-contract) and [release status](#release-status-contract) contracts, then
> execute the [Checklist](#checklist).

## Outcome

Make release pull requests and GitHub releases identify the exact browser packages, reviewer source,
and store status for their version without presenting unsigned GitHub ZIPs as ordinary store
installs.

## Coordination

- Status: complete
- Owner: Codex
- Depends on: PR 3 complete
- PR base: PR 3 branch until PR 3 merges
- PR boundary: release artifacts, comments, release body/status, validation, and release docs; no
  vendor submission

## Read first

- `docs/plans/publish/03-website-install-flow.md`
- `.github/workflows/release.yml`
- `build/release.ts`
- `build/release-workflow.test.ts`
- `release-please-config.json`
- `docs/specs/build-release-and-verification.md`
- `docs/tutorials/releasing.md`

## File map

- `build/reviewer-source.ts` — reproducible Firefox reviewer source archive and build instructions.
- `build/reviewer-source.test.ts` — archive allowlist, secret exclusion, reproducibility, and
  rebuild proof.
- `build/release-status.ts` — expected, submitted, reviewed, and public version status Markdown.
- `build/release-status.test.ts` — state matrix, idempotent markers, and version mismatch behavior.
- `.github/workflows/release.yml` — candidate artifacts, release assets, and status projection.
- `build/release-workflow.test.ts` — exact-SHA, version, asset-name, and release-body assertions.
- `docs/specs/build-release-and-verification.md` — reviewer source and status guarantees.
- `docs/tutorials/releasing.md` — candidate installation, artifact purpose, and operator recovery.

## Artifact contract

Each release candidate artifact contains:

- `chrome.zip`, built and validated from the exact release PR head;
- `firefox.zip`, built and validated from the same head;
- `firefox-source.zip`, a reproducible source archive for Mozilla reviewers; and
- `firefox-build-instructions.md`, with the exact pinned setup and build commands.

The final GitHub release attaches the same four named artifacts rebuilt from the exact tagged SHA.
The source archive includes everything needed to reproduce `firefox.zip` but excludes `.git`, local
build output, caches, credentials, worktrees, review scratch, and generated website dependencies.

## Release status contract

An idempotent marked section in the GitHub release body reports, for each browser:

- expected GitHub release version;
- submission state and timestamp;
- vendor review state;
- public store version;
- live install URL only when published; and
- the last reconciliation timestamp and actionable failure text.

The release PR comment labels packages as candidate packages for manual testing. The GitHub release
labels ZIPs as store-submission and reviewer artifacts, not one-click consumer installers.

The marked release PR and release sections also report whether the canonical listing summary
changed. Chrome Web Store API v2 does not expose listing-copy mutation, so a changed Chrome summary
creates a named manual dashboard action. The release remains publishable, but closeout cannot claim
listing-copy parity until an operator records completion. Firefox automation supplies updated
metadata through `web-ext` when supported.

## Checklist

- [x] Write failing archive tests for deterministic ordering, normalized timestamps, required source
      files, prohibited paths, symlinks, secrets, and a clean rebuild.
- [x] Implement the reviewer source archive and generated build-instructions file.
- [x] Extend release validation to bind all artifacts to the same manifest version and commit.
- [x] Write failing release-status tests for unpublished, submitted, reviewed, published, partial,
      rejected, and public-version-mismatch states.
- [x] Implement the status renderer with a stable HTML comment marker for idempotent updates.
- [x] Extend the release PR artifact comment with filenames, SHA, version, loading instructions,
      source archive purpose, and expiry.
- [x] Attach all four artifacts to the final GitHub release and verify all four names.
- [x] Seed the final release body with expected version and unpublished store states.
- [x] Add an explicit Chrome listing-copy action when the canonical current-version summary differs
      from the last confirmed live summary.
- [x] Preserve existing release notes outside the marked status section.
- [x] Update the release spec and tutorial with exact artifact meanings and Mozilla review steps.
- [x] Add failure tests proving a branch race, wrong tag, missing source file, or mismatched version
      blocks release output.
- [x] Run focused release tests, `mise exec -- deno task ci`, and a local release build/validation.
- [x] Download the locally produced source archive into a temporary clean checkout and reproduce the
      Firefox release package byte-for-byte or document the normalized equivalence rule.
- [x] Commit the planned implementation boundaries and open PR 4.

## Acceptance evidence

- Candidate and final assets are built from the exact recorded SHA, not a moving branch.
- Mozilla reviewer source reproduces the Firefox package under the documented pinned toolchain.
- A release body can distinguish GitHub version, submitted version, and public store version.
- Re-running the status projection changes no unrelated release-note text.
- PR 4 CI is green and the PR body links a complete candidate artifact bundle.

## Incoming handoff

PR 5 receives four exact asset names: `chrome.zip`, `firefox.zip`, `firefox-source.zip`, and
`firefox-build-instructions.md`. The reviewer archive permits the required root files plus `build/`
and `src/`, rejects tracked input drift from `HEAD`, and is bound to the release commit and version.
Release status uses the `point-and-shoot-store-status` marker pair and
`projectReleaseStatus(releaseBody, status)`; seeding preserves an existing same-version section.

## Completion record

- Status: complete
- Owner: Codex
- Started: 2026-08-05T15:40:09Z
- Completed: 2026-08-05T16:22:45Z
- PR: https://github.com/whizzzkid/point-and-shoot/pull/75
- Commits: `5f0c2f8`, `ca6b1ee`, `d4879ff`, `d757a59`, `38393f4`, `c12337f`
- Verification: focused release tests passed; `mise exec -- deno task ci` passed 374 tests;
  `mise exec -- deno task release:artifacts` and `mise exec -- deno task release:validate` passed at
  `c12337fe55070fc6280621a0e63d61fdc349026b`; `mise exec -- deno task build` restored development
  packages.
- Deviations: review findings required four additional small fix commits beyond the two planned
  implementation boundaries. Reproducibility compares sorted paths and uncompressed bytes because
  ZIP container metadata may differ across tools.
