---
title: "PR 3: Browser-aware website install flow"
type: plan
status: in progress
author: Point & Shoot maintainers
created: 2026-08-04
last_updated: 2026-08-05
epic: https://github.com/whizzzkid/point-and-shoot/issues/3
reviewers: []
labels:
  - browser-stores
  - website
related:
  - title: Publication plan
    path-or-url: README.md
  - title: Website and published documentation
    path-or-url: ../../specs/website-and-published-docs.md
---

# PR 3: Browser-aware website install flow

> **How to read this packet:** Confirm [Coordination](#coordination), preserve the
> [install-target interface](#install-target-interface) and
> [interaction contract](#interaction-contract), then execute the [Checklist](#checklist).

## Outcome

Make the website recommend the Chrome Web Store to Chromium-engine browsers and Firefox Add-ons to
Gecko-engine browsers while preserving visible choices, accessible fallback, and source install.

## Coordination

- Status: in progress
- Owner: Codex
- Depends on: PR 2 complete
- PR base: PR 2 branch until PR 2 merges
- PR boundary: site install components, browser-family classification, website tests, and website
  spec; no release workflow changes

## Read first

- `docs/plans/publish/02-listing-assets-and-readme.md`
- `store-listing.json`
- `site/src/pages/index.astro`
- `site/src/styles/global.css`
- `site/scripts/run-astro.mjs`
- `site/scripts/check-links.mjs`
- `docs/specs/website-and-published-docs.md`
- `docs/design.md`

## File map

- `site/src/lib/install-target.mjs` — pure desktop Chromium, desktop Gecko, mobile, or unknown
  classification.
- `site/src/components/InstallActions.astro` — store actions, recommendation, source fallback, and
  no-script behavior.
- `site/src/lib/install-recommendation.ts` — progressive enhancement without navigation or hidden
  choices.
- `site/scripts/install-target.test.mjs` — browser-family, mobile, spoofed, and unknown fixtures.
- `site/scripts/install-flow.test.mjs` — built-page semantics, publication states, and no-script
  fallback.
- `site/src/pages/index.astro` — shared install component in hero and closing sections.
- `site/src/styles/global.css` — responsive and accessible recommendation styling.
- `docs/specs/website-and-published-docs.md` — detection priority, fallback, and direct-install
  meaning.

## Install-target interface

`classifyInstallTarget(environment)` returns `"gecko"`, `"chromium"`, `"mobile-unsupported"`, or
`"unknown"`. Its input exposes only testable values: user-agent brands, user-agent text, platform
evidence, touch/mobile evidence, and whether the engine supports the Gecko-specific
`-moz-appearance` property.

Classification priority is:

1. iOS/iPadOS and Android as mobile-unsupported, regardless of branded wrapper tokens.
2. Gecko engine capability, then Firefox-family UA evidence.
3. A Chromium brand in User-Agent Client Hints.
4. Chromium-family UA evidence.
5. Unknown, including desktop Safari/WebKit and bots.

The classifier must not maintain a closed list as its primary mechanism. Representative fixtures
must cover Chrome, Chromium, Edge, Brave, Opera, Vivaldi, Arc, Firefox, LibreWolf, Waterfox, Floorp,
Firefox for Android, Chrome for Android, iOS wrappers, Safari, and an empty user agent.

## Interaction contract

- Server-rendered HTML always contains Chrome, Firefox, and source-install choices.
- In unpublished state, official store badges are absent, publication status is plain text, and
  source install is the only action.
- When only one store is published, render that store and source install; identify the other store's
  publication state as text without an inert badge-like control.
- In published state, the compatible store is visually recommended and receives the only accent
  treatment; the other store remains visible and operable.
- Unknown, Safari/WebKit, and iOS states recommend neither store and explain that Safari support is
  deferred or that mobile extension installation is unavailable.
- JavaScript never redirects, invokes a store protocol, or attempts Chromium inline installation.
- Recommendation changes must be announced once in a dedicated polite live region without stealing
  focus or replacing canonical store-publication status.
- Hero and closing sections share one component and one source of URLs.
- Plain text directly above each store action says that the action opens a browser-extension listing
  and states Point & Shoot's single purpose.

## Checklist

- [ ] Write classifier fixtures and verify they fail before the module exists.
- [ ] Implement the pure four-state classifier without reading globals inside the decision module.
- [ ] Write built-page tests for both store actions, source fallback, canonical URLs, no-script
      behavior, mobile states, and a config with one store still under review.
- [ ] Build `InstallActions.astro` from canonical store data projected by the site preparation step.
- [ ] Add progressive enhancement that changes recommendation labels and attributes and writes
      browser guidance to one dedicated live region without replacing publication status.
- [ ] Replace both duplicated landing-page source CTAs with the shared install component.
- [ ] Add responsive states for narrow viewports and 200% zoom without horizontal overflow.
- [ ] Add keyboard, focus, reduced-motion, and screen-reader assertions.
- [ ] Update the website spec with detection priority and the definition of installable from the
      website.
- [ ] Add a footer link to `/privacy/` and verify the canonical contact information.
- [ ] Run `npm run ci`, `npm run a11y`, and `npm run lighthouse` from `site/`.
- [ ] Preview Chrome, Firefox, Safari/unknown, and no-JavaScript states at desktop and mobile
      widths.
- [ ] Attach the state matrix to PR 3 and open the focused PR.

## Acceptance evidence

- Every representative desktop Gecko fixture recommends Firefox Add-ons.
- Every representative desktop Chromium fixture recommends the Chrome Web Store.
- Android and iOS wrappers recommend neither desktop store.
- Both store choices remain visible in every desktop browser state.
- Unknown and Safari/WebKit states do not receive an incorrect recommendation.
- The built page contains no public dummy link and makes no external request except user-activated
  navigation to a published store.
- Site CI, axe, and Lighthouse are green for PR 3.

## Incoming handoff

Record the final classifier signature, component props, generated-data path, and any browser fixture
whose behavior differs from the contract.

## Completion record

- Status: in progress
- Owner: Codex
- Started: 2026-08-05T06:41:35Z
- Completed: not completed
- PR: none
- Commits: none
- Verification: not run
- Deviations: none
