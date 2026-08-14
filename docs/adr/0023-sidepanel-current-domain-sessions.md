# ADR-0023 — Side-panel current-domain session dropdown

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

`Session.domain` (see [ADR-0021](0021-session-domain-field.md)) records the hostname the user
started capturing on. The side panel has never surfaced a session picker — it renders whichever
session `displaySessionId` points at. Users who capture across multiple domains have no way to find
and reload an earlier session on the same site without opening the options page.

The user's mental model is "which site am I collecting evidence for," not "which URL path", so a
dropdown keyed on domain (host) rather than full URL matches how sessions are actually filed. The
sessions table can already answer "give me every session for this host" cheaply after ADR-0021.

## Decision

Add a **Current-domain sessions dropdown** to the side panel's sidebar. It is expressed as a
`<details>` disclosure so the same element is a native listbox (keyboard-navigable, screen-reader
friendly) and can hold per-row action buttons for delete. The summary shows the domain and total
count. Each row is a button-row: click the row to load that session into the panel; click the
adjacent trash button to open a delete confirmation.

Domain resolution runs against the active tab, not the currently loaded session. `NotesRepository`
gains `currentDomain()`, backed by `tabs.query({active: true, currentWindow: true})`. Reading the
active tab respects the ADR-0002 permission model — the extension is loaded in a panel context that
already sees these URLs. `null` (unparseable, `chrome://newtab/`, `about:blank`) is a legal value;
the dropdown shows sessions with `domain === null` in that case.

`NotesRepository` gains three companion methods:

- `listForDomain(domain)` returns sessions whose stored `Session.domain` matches, newest first.
- `loadIntoPanel(id)` sets `displaySessionId` and bumps `sessionRevision` — the existing panel
  reload path takes over.
- `deleteFromPanel(id)` removes the record and clears `activeSessionId`/`displaySessionId` if they
  matched the removed id.

## Consequences

- The panel gains one more surface that must reload on `sessionRevision` change; the existing
  `watch()` callback now refreshes both the loaded session and the dropdown list.
- `loadIntoPanel` does not touch `activeSessionId`, so a running capture keeps running even while
  the user reviews a previously captured session for the same domain. Deliberate — the user asked
  for cross-navigation note-taking, not cross-session juggling.
- Users switching between tabs on different domains see the dropdown re-resolve on `watch()` fires.
  It does not re-resolve continuously on tab focus changes yet; a follow-up may listen for
  `tabs.onActivated` if the delay is noticeable.
- The delete path is confirmable via the same Dialog component already used for note deletion, so
  keyboard and screen-reader affordances match the existing pattern.

## Alternatives considered

### Filter by exact URL path

Would show only sessions that started on the same page. Rejected because the user's brief called out
"for the current domain, not the just the url path" — a per-path dropdown fragments the list into
tiny per-page buckets and hides the sessions the user is most likely looking for after navigating a
step or two.

### Use a native `<select>` for the dropdown

A `<select>` gives good keyboard defaults but forbids inline delete buttons and per-row content
richer than a text label. `<details>` gives us both without third-party listbox code.

### Re-resolve current domain on every keystroke or interval

Overkill. `watch()` already fires on every note write and session pointer change, which is when the
list content changes. Re-resolving on tab focus can land as a follow-up if users report the list
feels stale.
