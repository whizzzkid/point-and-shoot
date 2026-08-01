# ADR-0006 — Mount injected UI in a closed shadow root

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The toolbar and the picker overlay are rendered into pages we do not control. Two failure directions
follow, and they are not symmetrical.

Inward: the host page's CSS applies to anything we inject. A page with
`* { box-sizing: content-box }`, an aggressive `!important` reset, a global `font-size: 62.5%`, or a
`div { display: none }` rule scoped more broadly than its author intended will break our UI. There
is no set of defensive styles that survives arbitrary CSS, because the host always has the option of
`!important` plus higher specificity.

Outward — and this is the one that matters more here — our styles leaking onto the host page changes
the page. This extension screenshots the page. A leaked style shifts a layout by two pixels and
corrupts the very artifact the user is capturing, and the corruption is invisible because the
screenshot is the only record and it looks plausible.

An open shadow root fixes both, but leaves `element.shadowRoot` readable by page script, so hostile
or merely curious page code can walk our UI, read the note the user is typing, and dispatch events
into it. A closed root returns `null` to everything outside.

## Decision

Mount all in-page UI — toolbar, picker overlay, any future in-page surface — inside a **closed**
shadow root attached to a single container element. Nothing renders as a direct child of the host
document except that container.

## Consequences

- Host CSS cannot reach our UI, and our CSS cannot reach the host page. Captures are of the page as
  it was, not the page plus our styles.
- Page script cannot reach into our UI at all: `shadowRoot` is `null` from outside.
- **We** cannot reach in either, and neither can our tests. Playwright's selector engine cannot
  pierce a closed root, so E2E tests must drive the UI through the same closed boundary — via an
  exposed test hook or by interacting with the container — rather than by querying inner elements.
  This is a real cost and it shapes the browser tests; `tests/fixtures/app/shadow.html` exists to
  keep that limitation demonstrated rather than rediscovered.
- Design tokens do not inherit across the boundary. They must be injected into the shadow root
  deliberately, as an adopted stylesheet or an inline `<style>`, which is why token generation
  ([ADR-0011](0011-generated-design-tokens-with-drift-check.md)) produces something injectable
  rather than a global sheet.
- The page's theme is likewise not inheritable, which is what forces the backdrop-sampling approach
  in [ADR-0010](0010-backdrop-luminance-theming-with-override.md).
- Accessibility needs explicit attention: focus management, ARIA relationships, and the
  accessibility tree behave differently across a shadow boundary, and `aria-*` attributes cannot
  reference IDs across it.

## Alternatives considered

**Open shadow root.** Rejected: it gives the same style isolation but leaves the UI readable and
scriptable by the host page, including whatever the user is typing into a note. The only thing the
open mode buys is easier testing, and paying for test convenience with a user-facing information
leak is the wrong trade.

**An `<iframe>` for the UI.** Rejected: it isolates more strongly still, but the overlay must
position itself pixel-accurately over host page elements and pass geometry back and forth
continuously. Doing that across a frame boundary adds coordinate translation and async messaging to
the hottest path in the product, for isolation a closed root already provides.

**Namespaced classes with high specificity, no shadow DOM.** Rejected: it addresses neither
direction. Host `!important` still wins inward, and our rules still exist in the host's cascade
outward, so a capture can still be corrupted by our own presence.
