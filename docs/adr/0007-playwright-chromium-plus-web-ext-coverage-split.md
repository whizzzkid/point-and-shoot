# ADR-0007 — Chromium E2E via Playwright, Firefox via a web-ext smoke check

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The obvious testing goal is the same E2E suite running against every supported browser. It is not
achievable, for a reason that has nothing to do with effort.

Playwright can load an unpacked extension only in Chromium, through `launchPersistentContext` with
`--disable-extensions-except` and `--load-extension`. Its Firefox build has no equivalent mechanism,
and WebKit has none either. This is not a gap we can work around with a fixture or a helper: there
is no API to load an extension into Playwright's Firefox.

Firefox does have a supported way to run an unpacked extension — `web-ext run`, which launches
Firefox with the extension installed. What it does not give is Playwright's selector engine,
assertions, or tracing, so it can establish that the extension loads and initialises but cannot
drive a multi-step interaction with the same fidelity.

So the choice is not "which browsers do we E2E test", but "what do we assert where, and what do we
claim as a result".

## Decision

Three tiers, each with a stated responsibility:

1. **Deno unit tests** — all pure logic: the selector-bundle builder, geometry maths, serializers,
   migrations, and every browser-API interaction tested against fakes of the `browser.*` shim. This
   tier is where cross-browser API divergence is covered, because it is the only tier that can
   exercise both shapes of an API.
2. **Playwright + Chromium E2E** — the per-commit gate. Real picker interaction, real capture, real
   screenshots against the fixture app. Chromium only.
3. **`web-ext` Firefox smoke check** — proves the extension loads in Firefox, the background script
   initialises, and the toolbar injects. Not a full interaction suite.

## Consequences

- **Never claim Firefox E2E parity.** Firefox has a smoke check and unit coverage of API divergence,
  not end-to-end interaction coverage. Any doc, PR description, or README line implying otherwise is
  wrong and should be corrected rather than softened.
- A Firefox-only interaction bug can reach a release. The mitigation is that tier 1 covers API
  divergence deliberately — which only works if `browser.*` fakes model both browsers' actual
  behaviour, including their differences, rather than a convenient average.
- WebKit is untested entirely, consistent with [ADR-0005](0005-safari-deferred.md).
- The closed shadow root ([ADR-0006](0006-closed-shadow-dom-for-injected-ui.md)) means even the
  Chromium suite cannot query into the UI, so tier 2 drives it through the boundary rather than by
  inner selectors.
- Tier 2 needs a Chromium download that is not part of `mise install`, so setup is two steps and CI
  must cache it.
- Test theming is forced, never sampled, so screenshots are deterministic — see
  [ADR-0010](0010-backdrop-luminance-theming-with-override.md).

## Alternatives considered

**Selenium or WebDriver BiDi for cross-browser extension E2E.** Rejected for v1: extension loading
is possible in Firefox via WebDriver, so this is the most credible alternative, but it means a
second E2E framework, a second set of page abstractions, and a second CI job to maintain alongside
Playwright's. Worth revisiting once the Chromium suite has stabilised and if a Firefox-specific bug
actually escapes — that would be a successor ADR with evidence behind it.

**Puppeteer for Chromium.** Rejected: it loads extensions too, but Playwright's tracing, assertions,
and screenshot comparison are materially better for a product whose output is screenshots.

**Manual Firefox testing before each release.** Rejected as the primary mechanism: it is
unrepeatable and it is the first thing dropped under time pressure. The `web-ext` smoke check runs
automatically and catches the failure that matters most — an extension that does not load at all.

**No Firefox coverage at all.** Rejected: "we support Firefox" with nothing verifying that the
extension even loads there is a claim waiting to be falsified by a user.
