# ADR-0022 — Toolbar pauses/resumes; Compile Plan completes; overlay follows navigation

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

[ADR-0016](0016-toolbar-action-controls-session.md) put the toolbar in charge of both starting and
ending sessions: the first click created a session, the second stamped `endedAt` and dropped the
active pointer. In practice the second-click semantics fought the user's mental model whenever a
capture session spanned multiple pages. The overlay is destroyed by page unload — the background has
no `tabs.onUpdated` listener — so any navigation forced a second toolbar gesture, and misclicking
that gesture ended the session instead of resuming it. The result was constant
restart-and-lose-the-notes churn.

The side panel already has a natural completion gesture — the "Compile plan" button — and every
subsequent action (evidence selection, plan preview, export) already assumes the session is
finished. Nothing else needs the toolbar to be a session terminator.

## Decision

**Toolbar toggle becomes pause/resume, never terminates.** The click handler picks a branch off the
current session state:

- No active session (or the active pointer references an ended session) → start fresh.
- Active + `pausedAt === null` → pause: unmount the overlay, stamp `pausedAt`, keep the active
  pointer so the next click resumes the same session id.
- Active + `pausedAt != null` → resume: re-mount the overlay, clear `pausedAt`.

`Session` gains an optional `pausedAt: string | null` field. Records written before this ADR land
omit the field; validation and readers treat absent, `null`, and a valid ISO timestamp as the three
legal values.

**Compile Plan completes the session.** The side-panel button's click handler now invokes a new
`NotesRepository.complete(session)` before switching the panel to plan view: stamp `endedAt`, clear
`pausedAt`, drop `activeSessionId`, keep `displaySessionId` pointing at the completed record. The
plan view keeps rendering the same session id, so there is no user-visible flicker.

**A `tabs.onUpdated` listener keeps the badge honest across navigations.** A new module
`src/background/tab-lifecycle.ts` registers a listener that fires on
`changeInfo.status ===
"complete"` and re-synchronizes the action badge and title from the current
session state. Paused sessions and no-session cases are no-ops so the badge does not thrash between
"Pause" and "Start" labels. The listener does **not** re-inject the overlay: ADR-0002 restricts the
extension to `activeTab`, and the engine revokes that grant on every navigation, so injecting
without a fresh user gesture is impossible. The correct next step after navigation is one toolbar
click, which regrants activeTab, mounts the overlay, and (thanks to the persistent `activeSessionId`
pointer) continues the same session. The badge title on the new page shows "Pause session (N notes)"
— so the click is a resume, not a fresh start.

The action badge title reflects the three-way state: "Start session", "Pause session (N notes)", or
"Resume session (N notes)". The unavailable branch is unchanged.

## Consequences

- Sessions survive across pages by default; the user only ends a session when they deliberately hit
  Compile Plan.
- The old fresh-start-on-second-click flow is gone. A user who wants a fresh session must first
  complete the current one via Compile Plan, then click the toolbar.
- End-tolerance is now the responsibility of the side panel — a corrupted or lost `endedAt` is
  visible in the panel header. The toolbar can no longer clean up an orphaned session; the
  options-page "Clear all sessions" and future per-session delete affordances take over that role.
- Existing e2e coverage that clicked the toolbar to end must reach into IndexedDB (or drive Compile
  Plan) to observe an ended session. `tests/e2e/session-action.spec.ts` was rewritten;
  `tests/e2e/full-flow.spec.ts` gained a `serviceWorker.evaluate`-based `endSession` helper.
- Adding `tabs.onUpdated` does not require any new manifest permission: the event fires against the
  extension's existing capabilities, and the URL exposed by the event carries no more information
  than `activeTab` already grants when the user clicks.
- The overlay itself does **not** auto-remount after navigation. That would require broad host
  permissions (ADR-0002 rejected), so the user reactivates the overlay on each new page with one
  toolbar click. The badge title makes clear the click resumes the ongoing session rather than
  starting a new one — a much cheaper affordance than the alternatives below.

## Alternatives considered

### Add an explicit "End session" affordance to the toolbar or badge menu

The toolbar has room for one gesture. Splitting into two (short-click vs long-click, or icon vs
badge) shrinks discoverability of the primary flow and reintroduces the fragility ADR-0016 was
already trying to remove. Compile Plan is a discoverable, in-flow action already used at
capture-review time — the natural completion moment.

### Re-mount the overlay only on same-origin navigation

Would preserve "domain-scoped" note taking without following the user to unrelated sites. Ruled out
because a session's `domain` (ADR-0021) is fixed at start, so cross-domain notes still belong to the
origin the user set out to capture. Deciding this at the listener level would force a URL comparison
that the activation controller already performs implicitly — restricted pages return `"unavailable"`
and the listener treats that as a no-op.

### Fire off `webNavigation` instead of `tabs.onUpdated`

`webNavigation` gives per-frame granularity we do not need for a top-frame overlay mount, and adds a
permission surface (`webNavigation`) that the current activeTab model deliberately avoids.
`tabs.onUpdated` is the minimum-permission event that carries the completion signal.
