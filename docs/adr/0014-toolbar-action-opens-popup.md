# ADR-0014 — Let the toolbar action open the launcher popup

- **Status:** Superseded by ADR-0016
- **Date:** 2026-07-28

## Context

The original delivery requirements assigned two incompatible behaviors to the extension's toolbar
action: open the session launcher and directly toggle the injected overlay.

Manifest V3 does not dispatch both behaviors. Chrome states that `action.onClicked` is not sent when
the action has a popup, and Firefox documents the same rule. The popup and click listener are
mutually exclusive entry points, not two handlers that can run for one click:

- [Chrome action API](https://developer.chrome.com/docs/extensions/reference/api/action)
- [Firefox action API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action)

The product needs the popup as the discoverable entry point for sessions, the notes panel, and
options. It also needs a fast path for repeat capture.

## Decision

Declare `popup/popup.html` as the action's `default_popup` on both browser targets. Do not register
an `action.onClicked` listener.

The popup's start, resume, and overlay controls send a typed runtime message to the background's
single-flight activation controller. The `toggle-capture` keyboard command continues to call that
controller directly, so experienced users retain a one-step capture path without opening the
launcher.

## Consequences

- A toolbar click always opens the launcher. Starting or toggling capture is a second explicit
  action inside it.
- The keyboard shortcut remains the direct overlay toggle and works before the popup has ever been
  opened.
- Both entry points share injection, restricted-page feedback, and double-activation protection.
- The popup remains a launcher; note editing and plan compilation stay in the side panel.
- Badge and title feedback remain available for pages where injection is forbidden.
- Browser tests trigger the real action to exercise its `activeTab` grant, then open the built popup
  by extension URL because Playwright does not expose the browser-owned action-popup target as a
  page.

## Alternatives considered

### Keep the direct toolbar toggle

Without a `default_popup`, the icon can dispatch `action.onClicked`, but the launcher has no normal
browser-chrome entry point. An extension-URL-only popup is not a usable product surface.

### Toggle automatically when the popup mounts

This technically couples both outcomes to one click, but opening options or checking the note count
would unexpectedly change page state. Popup mount is observation, not consent to inject or remove
the overlay.

### Open the popup programmatically after handling the click

Chrome's `action.openPopup()` is generally available only from Chrome 127, above this project's
Chrome 116 minimum. Making the primary flow depend on it would also replace a manifest-level
cross-browser behavior with an avoidable API divergence.
