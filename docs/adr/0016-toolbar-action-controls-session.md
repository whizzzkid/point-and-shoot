# ADR-0016 — Let the toolbar action control the session

- **Status:** Superseded by [ADR-0022](0022-pause-resume-and-compile-plan-completion.md) — toolbar
  now pauses/resumes; Compile Plan completes; a `tabs.onUpdated` listener re-mounts the overlay
  across navigations.
- **Date:** 2026-07-30

## Context

[ADR-0014](0014-toolbar-action-opens-popup.md) made the toolbar icon open a launcher popup because
Manifest V3 cannot dispatch `action.onClicked` while an action popup is declared. That resolved the
entry-point conflict, but it made the primary capture path require a second click inside the popup.

The notes side panel now carries session review, editing, plan compilation, and export. Keeping a
separate launcher between the toolbar gesture and that workspace duplicates session state without
adding a necessary decision. The toolbar itself can communicate the remaining state through its
badge and title.

## Decision

Remove `action.default_popup` and register `action.onClicked` on both browser targets.

The first click on an eligible page starts or resumes capture, opens the side panel, and mounts the
overlay. A click while a session is active ends that session, unmounts the overlay on the current
page, and leaves the side panel open on the completed session. The next click creates a fresh
session and switches the side panel to it.

The action badge shows the current note count, capped at `99+`. The action title is the hover
tooltip and always carries the exact count. A completed session clears the badge and restores the
start-session title.

The keyboard shortcut uses `_execute_action`, which fires `action.onClicked` and grants `activeTab`
— the same path as the toolbar click. Both entry points follow the session lifecycle.

## Consequences

- The toolbar click is the session lifecycle gesture instead of a popup-opening gesture.
- The side panel is the primary extension workspace and remains useful after capture ends.
- Active-session and displayed-session pointers are distinct so ending capture does not hide the
  completed export.
- Session writes, note appends, and action-state refreshes must serialize to avoid an end/capture
  race.
- The action popup document may remain buildable for regression coverage, but it is not a normal
  user entry point and cannot own the shipped session lifecycle.
- Options remain reachable through the browser's extension controls and the manifest-declared
  options page.

## Alternatives considered

### Add an end button to the popup

This preserves the extra click and keeps the popup as a second session-state owner. It does not
improve the primary flow once the side panel already provides the workspace.

### Toggle only the overlay from the toolbar

An overlay-only toggle leaves session start and end implicit. The stored session then has no
reliable point at which to set `endedAt`, which blocks lifecycle verification and makes a fresh
session ambiguous.

### Close the side panel when ending

Ending capture is not the same as finishing review or export. Closing the panel would hide the
completed work at the moment the user is most likely to compile or download it.
