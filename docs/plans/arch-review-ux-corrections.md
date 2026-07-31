---
title: Architecture review of post-wave UX corrections
type: plan
status: accepted
author: Codex
created: 2026-07-30
last_updated: 2026-07-30
epic: null
reviewers:
  - Nishant Arora
labels:
  - architecture-review
  - browser-extension
  - ux
related:
  - title: Post-wave UX corrections
    path: ux-corrections.md
  - title: UI and capture delivery plan
    path: wave-3-ui-and-capture.md
---

# Architecture review of post-wave UX corrections

## Context

- **System:** A local-first Manifest V3 extension for Chrome and Firefox.
- **Quality priorities:** Correctness, privacy, maintainability, and interaction latency.
- **Constraints:** `activeTab` only, closed shadow-root UI, no remote assets, extension-owned
  sessions in IndexedDB, and browser divergence isolated behind the shared shim.
- **Scale:** One active user, one active capture session, and bounded local note collections.
- **Verdict:** Accepted after the plan incorporated the state-ownership and async-ordering findings
  below.

## Findings

### High — A content script cannot read extension-owned IndexedDB

- **Lens:** Underlying assumptions and unhappy paths.
- **Where:** `ux-corrections.md`, cross-context state contract and PR 3.
- **Problem:** The first draft said the content realm would reload the active session after a
  revision event. Content-script IndexedDB belongs to the inspected page origin, not the extension
  origin that owns sessions.
- **Failure mode:** A capture or deletion emits a revision, but the injected toolbar reads an empty
  or unrelated page database and remains stale.
- **Resolution:** The background context now owns the read and exposes a typed active-session
  summary message. Content receives only the canonical note count.

### High — Side-panel writes did not publish revision events

- **Lens:** Single points of failure and operability.
- **Where:** `ux-corrections.md`, PR 2 and PR 3.
- **Problem:** Existing background capture writes increment `SESSION_REVISION_STORAGE_KEY`, while
  direct side-panel saves only update IndexedDB. A listener alone cannot observe edits or deletes
  that never publish invalidation.
- **Failure mode:** Deleting a note updates the side panel but leaves the browser-action badge and
  injected toolbar count unchanged indefinitely.
- **Resolution:** The repository increments the revision after a successful IndexedDB commit.
  Background and content reload canonical state rather than applying deltas.

### Medium — Rapid note previews can resolve out of order

- **Lens:** Unhappy paths and delivery risk.
- **Where:** `ux-corrections.md`, PR 4.
- **Problem:** Selector resolution and cross-context messaging are asynchronous. Moving quickly from
  note A to note B can let A's slower lookup finish last.
- **Failure mode:** Hovering note B highlights note A, or leaving the card allows a late lookup to
  restore a highlight that should be clear.
- **Resolution:** Preview and clear requests carry a monotonic generation. Content ignores results
  older than the most recent generation.

### Medium — Escape must not conflate overlay and session lifecycle

- **Lens:** Underlying assumptions and maintainability.
- **Where:** `ux-corrections.md`, completion criterion 5 and PR 3.
- **Problem:** “End highlighting session” could mean either dismiss capture UI or end the durable
  session. The existing shortcut and browser action already own durable session lifecycle.
- **Failure mode:** Pressing `Escape` while composing could silently end the session or lose
  previously saved notes.
- **Resolution:** `Escape` discards only an unsaved pending capture and removes injected UI. The
  active session and saved notes remain available for shortcut resume.

### Low — A configured export budget remains useful only if labeled advisory

- **Lens:** Underlying assumptions and product behavior.
- **Where:** `ux-corrections.md`, PR 5.
- **Problem:** Retaining the existing budget selector while removing enforcement can look like a
  limit that failed to apply.
- **Failure mode:** Users expect output to be blocked at the selected threshold or believe a large
  successful download ignored their setting.
- **Resolution:** Specifications and UI will call it a warning threshold. Only empty selections and
  serialization failures block delivery.

## Underlying assumptions

| Assumption                                                                     | Status                                                | Risk if wrong                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------ |
| The background context can reopen extension-owned IndexedDB after suspension.  | Verified by the existing session service.             | Counts cannot reconcile after a worker restart.        |
| Storage change events reach open extension and content contexts.               | Verified by current settings and side-panel watchers. | Live state waits until remount.                        |
| Stored selectors can become stale after page mutation.                         | Verified by selector fallback design.                 | Hover preview can resolve nothing or the wrong target. |
| Export consumers understand CSS shorthand values.                              | Verified by standard CSS syntax.                      | Terse evidence becomes less actionable.                |
| Large local downloads remain technically possible above the warning threshold. | Verified by current configurable 8 MB path.           | Warning-only delivery can fail unexpectedly.           |

## Single points of failure

- **Background message router:** Owns extension-origin reads and tab routing. Suspension is
  recoverable because every request reopens canonical storage.
- **Revision key:** Owns invalidation, not data. A missed event causes temporary stale presentation;
  remount or the next revision reconciles from canonical storage.
- **Stored selector bundle:** Owns note-to-page preview resolution. Failure degrades to no preview
  and never alters the inspected page or stored note.

## Prioritized actions

1. Land durable revision publication before introducing content count subscriptions.
2. Add active-session summary messaging before removing the local count increment.
3. Prove `Escape` preserves the session with an end-to-end shortcut-resume test.
4. Add generation ordering before enabling hover previews.
5. Update export terminology in the same commit that removes hard blocking.

## What the design gets right

- The stack isolates packaging, review, capture, highlighting, and export risks.
- Stored session shape remains stable; terse styles are an export-only projection.
- Cross-context updates reload canonical state instead of maintaining distributed counters.
- Page highlighting degrades safely when selectors or page identity no longer resolve.
