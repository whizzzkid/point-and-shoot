# Popup launcher

The extension action opens a compact launcher. The launcher exposes session and navigation controls;
it does not duplicate the note-editing workspace in the side panel.

## Entry points

The manifest declares `popup/popup.html` as `action.default_popup` for Chrome and Firefox. A toolbar
click opens that document and does not directly toggle capture. The `toggle-capture` keyboard
command is the direct overlay-toggle path.

The popup and keyboard command delegate to the same background activation controller. That
controller serializes requests per tab, injects the content bundle only when no listener exists, and
reports the resulting mounted state.

## Session states

The popup renders one of three session states:

- **Loading:** storage and active-tab overlay state are still being read. Session and notes actions
  are disabled.
- **No active session:** the heading is `No active session`, the note count is absent, and the
  primary action is `Start session`.
- **Active session:** the heading is the stored session name, the badge is the exact note count, and
  the primary action is `Resume session` while the overlay is off or `Session active` while it is
  on.

Starting a session creates one schema-valid `Untitled session` record in IndexedDB and stores its ID
under the shared `activeSessionId` extension-storage key. Concurrent start requests serialize and
must resolve to the same session. A stale pointer is replaced with a newly created session.

Resuming never creates a second session. If the overlay is off, start or resume also asks the shared
activation controller to mount it on the active tab.

## Controls

The launcher provides these controls:

- **Overlay on this tab:** a switch reflecting the content realm's mounted state. Turning it on
  first ensures an active session exists. Turning it off preserves the session and its notes.
- **Start session / Resume session:** ensures the session exists and mounts the overlay when needed.
- **Open notes panel:** opens the browser's side panel or sidebar for the active tab.
- **Open options:** opens the manifest-declared options page in a full tab.

Only one popup operation runs at a time. Controls that could overlap are disabled until the active
operation settles.

## Failure behavior

The popup treats a missing content listener during its initial state read as an overlay that is off;
that is the expected state before first injection.

User-triggered failures appear in an alert within the popup:

- no active browser tab;
- malformed background response;
- session-storage failure;
- side-panel or options-page failure; or
- a page where browser policy forbids injection.

For a restricted page, the alert reads `Point & Shoot is unavailable on this page.` and the toolbar
action receives the same `!` badge and unavailable title used by keyboard activation.

The default production theme is dark until the shared theme setting lands. The launcher component
supports explicit dark and light themes, and browser coverage exercises both.
