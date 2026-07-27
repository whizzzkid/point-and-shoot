# ADR-0005 — Safari is deferred past v1, but the code stays convertible

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

Safari supports web extensions, but not by loading one. A Safari web extension must be converted
with `xcrun safari-web-extension-converter` into an Xcode project, built as a native macOS or iOS
app wrapper, code-signed, and distributed through the App Store. That chain requires Xcode, a paid
Apple Developer account, and a release process with nothing in common with the Chrome Web Store or
AMO pipelines.

That is a meaningful amount of work, and none of it is shared with the other two browsers. Doing it
in v1 would roughly double the release surface before the extension has proven useful to anyone.

The trap is deferring support in a way that makes it expensive later. Safari's extension APIs are
promise-based and it does not implement Chrome-only surfaces, so a codebase written against
callback-style `chrome.*` accumulates incompatibilities that are invisible until someone attempts
the conversion — at which point the work is a rewrite rather than a build step.

## Decision

Do not ship Safari support in v1. Keep the code convertible: all extension API access goes through
the promise-based `browser.*` surface, no Chrome-only API is used, and nothing depends on
`chrome.offscreen` (see [ADR-0001](0001-offscreencanvas-over-chrome-offscreen.md)). Record the
conversion path here so picking it up later is mechanical rather than exploratory.

The conversion path, when it is taken up:

1. Build the extension as normal, producing `dist/`.
2. `xcrun safari-web-extension-converter dist/ --project-location <path> --app-name "Point and Shoot"`.
3. Open the generated Xcode project, set the bundle identifier and signing team.
4. Build and run to load the extension into Safari with developer mode enabled.
5. Verify the capabilities Safari is known to differ on: clipboard write from an extension context,
   `tabs.captureVisibleTab` behaviour, and IndexedDB persistence in the extension's storage
   partition.
6. Distribute through the App Store as a wrapped app.

## Consequences

- v1 supports Chrome and Firefox. Any claim of Safari support is false until the steps above have
  actually been run, and a converted-but-unverified build is not support.
- Every API call must go through the `browser.*` shim, including in code where the `chrome.*` call
  would be shorter. This is a review-blocking rule, not a style preference, because a direct
  `chrome.*` call is precisely the kind of thing that works fine for two browsers and quietly
  forecloses the third.
- Nothing may depend on Chrome-only behaviour even where Firefox tolerates it — the constraint is
  the intersection of three browsers, not two.
- The deferral has a shelf life. The longer it runs, the more untested Safari-specific divergence
  accumulates, and step 5 above grows. Treat the conversion as a debt with interest, not a free
  option.
- No CI job covers Safari, so the convertibility rules are enforced by review and by the `browser.*`
  shim's own type surface, not by a test.

## Alternatives considered

**Ship Safari in v1.** Rejected: an Xcode project, a signed app wrapper, a paid developer account,
and a third store review process, all before the extension has users. The cost is front-loaded and
the value is speculative.

**Ignore Safari entirely and write directly against `chrome.*`.** Rejected: it saves nothing — the
`browser.*` shim is small and needed for Firefox regardless — while converting a future Safari port
from a mechanical step into a rewrite.

**Target Safari first, since it is the strictest.** Rejected: the strictness is in the packaging and
distribution chain rather than the APIs, so building it first would front-load the platform work
without informing the extension's design.
