# ADR-0001 — Use OffscreenCanvas for image work, not the Chrome offscreen document API

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

Capturing a region means taking the visible-tab screenshot the browser gives us, cropping it to the
target's bounds, and encoding the result. None of that can happen on the page itself: the page is
the thing being captured, and an injected `<canvas>` would be both visible to the user and reachable
by hostile page script.

Under Manifest V3 the background context is a service worker, which has no DOM. Chrome's idiomatic
answer is `chrome.offscreen` — a hidden document the worker creates specifically to get DOM APIs
back. It is well documented, it is what Chrome's own samples use, and it is the path a contributor
will reach for first.

Firefox has no equivalent. There is no `browser.offscreen`, and no shim can synthesise one, because
the missing piece is a hidden top-level document the extension may create on demand. Building on
`chrome.offscreen` therefore does not cost a polyfill — it costs a second implementation of the
entire capture pipeline, one per browser, diverging from the first commit that touches it.

`createImageBitmap` and `OffscreenCanvas` are available in both browsers' extension background
contexts, and together they cover everything the pipeline needs: decode, crop via `drawImage` with a
source rectangle, and encode via `convertToBlob`.

## Decision

Do all image decoding, cropping, scaling, and encoding with `createImageBitmap` and
`OffscreenCanvas.convertToBlob` in the background context. Never use `chrome.offscreen`, and never
create a document — hidden or otherwise — to obtain a 2D context.

## Consequences

- One capture pipeline serves both browsers. Cropping logic is tested once.
- `OffscreenCanvas` gives no access to DOM measurement, so every geometry input (element bounds,
  device pixel ratio, scroll offsets, sticky-header insets) must be measured in the content script
  and passed to the background as plain data. That boundary is now load-bearing and cannot be
  shortcut later by "just reading the element" from the background.
- Reaching for `chrome.offscreen` in a later wave silently reintroduces the fork this ADR exists to
  prevent. Treat any such addition as a change to this decision, requiring a successor ADR — not an
  implementation detail.
- Encoding quality and format options are whatever `convertToBlob` supports. A future need for an
  encoder it lacks (e.g. AVIF at a specific quantiser) means vendoring a WASM encoder, not adding a
  document.

## Alternatives considered

**`chrome.offscreen` with a Firefox-specific fallback.** Rejected: the fallback is not a small
adapter, it is a whole second cropping-and-encoding implementation living in a different execution
context with different lifetime rules. Two implementations of the one step whose output the user
actually keeps is where silent visual regressions come from — and only one of them would be covered
by the Chromium E2E gate (see [ADR-0007](0007-playwright-chromium-plus-web-ext-coverage-split.md)).

**Crop in the content script with a regular `<canvas>`.** Rejected: it puts a canvas holding a
screenshot of the page into the page, where hostile script can read it, and it makes the capture
observable by the very DOM being captured. It also conflicts with the closed-shadow-root isolation
in [ADR-0006](0006-closed-shadow-dom-for-injected-ui.md).

**Ship the full screenshot uncropped and crop on read.** Rejected: it stores far more pixel data
than the user asked for, which contradicts the minimum-necessary-capture posture of
[ADR-0002](0002-activetab-only-permission-model.md), and it defers the cost to every consumer of the
data instead of paying it once.
