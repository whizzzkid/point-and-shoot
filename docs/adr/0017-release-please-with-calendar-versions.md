# ADR-0017 — Use Release Please with calendar versions

- **Status:** Accepted
- **Date:** 2026-07-31

## Context

The extension needs one version shared by its Git tag, GitHub release, Chrome package, Firefox
package, and visible product surfaces. Chrome and Firefox accept one to four dot-separated integer
components, with no leading zeroes. Release Please calculates and records Semantic Versioning
values, whose release core has exactly three components.

The repository also needs a release pull request that accumulates every merged change, carries
testable browser packages before release, and creates the tag and final GitHub release when merged.
A workflow triggered by a tag or release created with the default `GITHUB_TOKEN` would not run:
GitHub suppresses recursive workflow events created by that token.

## Decision

Use one UTC calendar version in the form `YYYY.MMDD.N`:

- `YYYY` is the four-digit UTC year.
- `MMDD` is the variable-width numeric encoding `month * 100 + day`, without a leading zero. July 31
  is `731`; January 2 is `102`.
- `N` starts at `0` and increments for each additional release on the same UTC day.

For example, the first release on July 31, 2026 is `2026.731.0`, and its tag is `v2026.731.0`. This
is both a valid Semantic Versioning value for Release Please and a valid browser-extension version.
The existing `0.1.0` value is the only permitted bootstrap input; the first generated release pull
request transitions it to CalVer.

Run Release Please in manifest mode on every push to `main`. A deterministic Deno command computes
the next CalVer and supplies it as Release Please's `release-as` input. Release Please owns the
version manifest, changelog, release pull request, tag, and GitHub release. Its `extra-files`
configuration updates every source-controlled current-version reference in the same release pull
request.

When Release Please creates or updates its pull request, the same workflow checks out that pull
request's exact head SHA under read-only repository permissions, builds and validates both browser
packages, and uploads them as a GitHub Actions artifact for testing. When merging the release pull
request causes Release Please to create the tag and GitHub release, the same workflow rebuilds the
released SHA, validates both packages against the tag, and attaches `chrome-<version>.zip` and
`firefox-<version>.zip` to the release. Final attachment uploads replace an identically named asset
so retrying a partially failed workflow repairs the release instead of failing on the first asset
already present.

## Consequences

- Calendar dates, not commit types, determine versions. Conventional commits still group changelog
  entries, but do not choose a major, minor, or patch increment.
- The compact `MMDD` component must be decoded as `month * 100 + day`; it deliberately does not
  preserve a leading zero.
- Release sequencing uses UTC, so maintainers in another time zone may see the next calendar day.
- The release workflow must build preview artifacts itself. A separate pull-request or
  release-triggered workflow cannot be assumed to run when Release Please uses `GITHUB_TOKEN`.
- The GitHub release can briefly exist without both browser packages if the attachment step fails.
  The workflow remains red until both uploads succeed, and a retry replaces any partial assets.
- The release validator rejects version drift, unsafe archive paths, `dist/` leakage, sourcemaps,
  missing manifest keys, and remote URLs before an artifact reaches a release.
- Chrome Web Store and AMO submission remain manual and out of scope.

## Alternatives considered

### Use `YYYY.MM.DD.N`

Browser manifests accept four numeric components, but Release Please requires a three-component
Semantic Versioning release core. Leading zeroes in `MM`, `DD`, or `N` would also violate browser
package requirements.

### Use different tag and manifest versions

A three-component tag such as `v2026.731.0` could map to a four-component manifest such as
`2026.7.31.0`. That introduces two public identifiers for one release and weakens the tag-to-package
consistency check.

### Keep Semantic Versioning

Semantic Versioning describes compatibility for a public API. This project ships an end-user browser
extension, where the release date and same-day sequence communicate more useful information.

### Trigger packaging from the generated tag

With Release Please's default `GITHUB_TOKEN`, the generated tag does not trigger another workflow.
Using one workflow for orchestration and packaging avoids requiring a personal access token solely
to bypass event suppression.
