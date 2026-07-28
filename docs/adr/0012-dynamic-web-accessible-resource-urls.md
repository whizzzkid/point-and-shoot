# ADR-0012 — Rotate Chrome web-accessible resource URLs per session

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

The injected overlay needs eleven vendored WOFF2 files and one SVG icon sprite on any page where the
user activates the extension. Those twelve files total 167,999 bytes and are therefore listed in
`web_accessible_resources` with `matches: ["<all_urls>"]`. This match pattern lets pages load the
assets; it grants the extension no access to page content and does not change the `activeTab`-only
permission model in [ADR-0002](0002-activetab-only-permission-model.md).

Chrome extension IDs are stable. Without another guard, a page that knows Point and Shoot's ID can
fetch a known font or sprite path and distinguish an installed extension from a missing resource.
Chrome documents extension fingerprinting as the reason resources are private by default and offers
`use_dynamic_url` to replace the stable host with an ID regenerated on browser restart or extension
reload. `runtime.getURL()` returns that dynamic URL for protected resources.

Firefox has a different baseline: each installation receives a random `moz-extension://` UUID, and
Firefox does not support `use_dynamic_url`. Adding the Chrome key to the shared manifest would
therefore create an unsupported Firefox field without improving Firefox's existing protection.

The relevant platform behavior is documented by
[Chrome's web-accessible resources reference](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
and
[Mozilla's Manifest V3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/).

## Decision

Set `use_dynamic_url: true` on every Chrome `web_accessible_resources` rule and omit the property
from Firefox.

Resolve every injected asset through the cross-browser shim's `browser.runtime.getURL(path)`.
Consumers must never assemble an extension origin or hardcode a Chrome extension ID. The shim keeps
this resolution path identical across engines: Chrome returns the session-scoped host, while Firefox
returns its random extension-origin UUID.

Keep the WOFF2 files and SVG sprite as external vendored assets. The Chromium smoke test must prove
that the stable Chrome-ID form fails from a page origin and that the URL returned by
`runtime.getURL()` loads every currently exposed file.

## Consequences

- A page that knows the stable Chrome extension ID can no longer use these resource paths as a
  pre-activation installation probe. Firefox retains its random-origin protection.
- This is not invisibility after activation. Once the user invokes the extension on a page, that
  page may observe injected UI or asset requests during that session; the decision removes the
  persistent, predictable probe available before the user acts.
- Chrome and Firefox manifests now differ for this field. The difference stays in
  `build/manifest.ts`; UI consumers use one shim method and contain no engine branch.
- Reloading the extension rotates Chrome's dynamic host. URLs retained by an already-injected page
  become stale, which is acceptable because an extension reload also requires the user to reactivate
  the overlay.
- Unit tests can lock the generated manifest shapes and shim delegation, but only a real Chromium
  run proves that the stable host is rejected. Firefox's existing boot check proves a randomized
  resource URL resolves; behavioural Firefox coverage remains deferred under
  [ADR-0007](0007-playwright-chromium-plus-web-ext-coverage-split.md).
- No new permission, host permission, remote request, dependency, or runtime network path is added.

## Alternatives considered

**Accept the stable Chrome probe.** Rejected: it contradicts the privacy posture established by
[ADR-0002](0002-activetab-only-permission-model.md) for no compensating product benefit.

**Inline the SVG sprite into the shadow DOM.** Rejected for this decision: it removes only the
2,199-byte sprite from the exposed set while all eleven fonts still require web-accessible URLs. It
also adds sprite-injection plumbing to the component library without eliminating the fingerprinting
surface.

**Inline fonts as data URLs or use system fonts only.** Rejected: data URLs duplicate and inflate
the generated CSS, while dropping the vendored fonts reverses
[ADR-0009](0009-no-remote-assets-vendored-fonts-and-icons.md)'s visual-fidelity decision. Dynamic
URLs solve the stable probe without either cost.

**Emit `use_dynamic_url` in both manifests.** Rejected: Firefox does not support the property and
already randomizes extension origins. Target-specific manifest generation exists for exactly this
kind of platform difference.
