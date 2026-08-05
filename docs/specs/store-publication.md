---
title: Browser store publication
type: spec
status: accepted
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-04
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - privacy
related:
  - title: Extension runtime
    path-or-url: extension-runtime.md
  - title: Build, release, and verification
    path-or-url: build-release-and-verification.md
  - title: Website and published documentation
    path-or-url: website-and-published-docs.md
---

# Browser store publication

> **How to read this doc:** [Context](#context) explains why store metadata is a checked contract,
> [Reference](#reference) defines its schema and failure behavior,
> [Projection flow](#projection-flow) shows how public surfaces consume it, and
> [Store metrics](#store-metrics) records which vendor data may be used without scraping.

## Context

Browser-store identity starts unknown and becomes durable only after a maintainer creates and
publishes each listing. Placeholder URLs are unsafe because they look installable before a vendor
has assigned the real identity. Listing copy and privacy disclosures also describe extension
behavior that can change independently of the store dashboards.

The root `store-listing.json` file is therefore the canonical source for store state, identities,
public links, listing copy, support details, and privacy disclosures. The generated manifests remain
canonical for requested permissions and Firefox's stable extension ID. The non-writing `store:check`
task joins these sources and rejects drift.

## Reference

### Contract schema

The contract uses `schemaVersion: 1`. Unknown vendor-assigned identities and public listing URLs are
JSON `null`, never empty strings or dummy links.

| Field                           | Guarantee                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `support.email`                 | Exactly `support@pointandshoot.app`                                               |
| `support.url`                   | Exactly `https://pointandshoot.app/`                                              |
| `listing.name`                  | Public store name                                                                 |
| `listing.shortDescription`      | Matches the generated manifest description and is at most 132 characters          |
| `listing.currentVersionSummary` | Concise summary intentionally reviewed when shipped capabilities change           |
| `listing.fullDescription`       | At most 16,000 characters and contains `currentVersionSummary` verbatim           |
| `privacy.url`                   | Exactly `https://pointandshoot.app/privacy/`                                      |
| `privacy.singlePurpose`         | Chrome single-purpose declaration, at most 1,000 characters                       |
| `privacy.remoteCode`            | Always `false`                                                                    |
| `privacy.permissions`           | One explanation, at most 1,000 characters, for each generated manifest permission |
| `privacy.dataDisclosures`       | Local handling categories and explicit false collection/use declarations          |
| `stores.chrome`                 | State, extension ID, publisher ID, and listing URL                                |
| `stores.firefox`                | State, slug, stable extension ID, and listing URL                                 |

The required locally handled categories are `websiteContent`, `webHistory`, `userActivity`, and
`userGeneratedContent`. These categories describe data processed on the device after a user gesture;
they do not mean the extension collects or transmits that data. The collection, transmission, sale,
sharing, advertising, and credit-purpose declarations remain `false`.

### Store state

Each store state is `unpublished`, `submitted`, or `published`.

```mermaid
stateDiagram-v2
    [*] --> unpublished
    unpublished --> submitted: First manual submission
    submitted --> published: Public listing verified
    published --> published: Later version submitted or reviewed
```

Only `published` permits a non-null `listingUrl`. A published Chrome entry also requires its
extension and publisher IDs. A published Firefox entry requires its slug, and its `extensionId` must
always match `FIREFOX_EXTENSION_ID` from `build/manifest.ts`. URLs must use HTTPS, the official
vendor host, and a path matching the configured identity. Once a listing is public, later package
submissions do not change this visibility state; per-version review status is tracked by release
automation instead.

### Validation and failures

`parseStoreListing(value)` treats decoded JSON as untrusted input and fails if any required field
has the wrong shape. `validateStoreListing(root)` returns every schema, limit, manifest-drift,
state, identity, URL, privacy, and public-sentinel issue in deterministic order.
`deno task store:check` prints those issues and exits unsuccessfully without modifying the
repository.

The checker compares the privacy explanation keys with the union of the permissions generated for
Chrome and Firefox. Adding or removing a permission therefore requires the manifest, contract,
privacy page, and disclosure tests to change together. Public repository and site sources may not
contain store URL sentinel tokens.

## Projection flow

```mermaid
flowchart TD
    Contract[store-listing.json] --> Parser[Typed parser and validator]
    ChromeManifest[Generated Chrome manifest] --> Parser
    FirefoxManifest[Generated Firefox manifest] --> Parser
    Parser --> Gate[store:check]
    Contract --> SiteProjection[site/.generated/store-listing.json]
    SiteProjection --> Privacy[Privacy page]
    SiteProjection --> Install[Install recommendations]
    Parser --> Repository[README and listing assets]
    Parser --> Release[Release surfaces]
```

The Astro runner parses and normalizes the root contract into `site/.generated/store-listing.json`
before each check, build, or development-server start. The generated directory is disposable and is
never a second source of truth. Later repository, asset, install, and release projections consume
the same validated contract.

## Store metrics

Firefox Add-ons exposes a documented add-on detail endpoint containing `average_daily_users`,
`weekly_downloads`, and rating aggregates including average, total count, and text-review count. Its
ratings endpoint can list public rating text, but that endpoint is explicitly not frozen. A later
website change may fetch Firefox aggregates at build time with a cached or absent-state fallback; it
must not make page rendering depend on a live vendor request. See the official
[add-on API reference](https://mozilla.github.io/addons-server/topics/api/addons) and
[ratings API reference](https://mozilla.github.io/addons-server/topics/api/ratings.html).

The documented Chrome Web Store API v2 exposes package upload, submission status, publication,
cancellation, and deployment-percentage methods. It does not expose a documented public method for
listing stars, rating counts, or review text. This conclusion is based on the current
[Chrome Web Store API v2 resource list](https://developer.chrome.com/docs/webstore/api/reference/rest).
The site must not scrape the Chrome listing. Chrome metrics remain store-native until Google ships a
documented supported endpoint or the maintainers choose a clearly labelled manual snapshot.
