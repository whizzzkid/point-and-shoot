# ADR-0021 — Capture the session domain at start and migrate stored records

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

`Session` (`src/shared/schema.ts`) has never carried the tab a session began on. Notes carry
`pageUrl` per capture, but the session itself is unaddressable by page or site. Two UI directions
now need to filter by site: the side panel dropdown that offers the user prior sessions **for the
current domain** (not for the current path), and the options page grouping across all domains.
Deriving domain at query time from `notes[0].pageUrl` fails for empty sessions started before the
first capture and forces a full-notes scan on every dropdown render.

ADR-0002 restricts the extension to `activeTab`; the background reads the URL only for eligible
http(s) tabs and only in the click handler. That URL is available exactly at session start, which is
when the field is cheapest to fill.

## Decision

Add `domain: string | null` to `Session` and bump `SCHEMA_VERSION` to 2. `SessionActionController`
pipes the clicked tab's `url` through `SessionService.start(pageTitle?, pageUrl?)`, which sets
`domain` to `new URL(pageUrl).hostname` — `null` for `undefined`, empty, or unparseable URLs
(`chrome://newtab/`, `about:blank`). The value is written once, at creation, and is not updated when
the session crosses navigations later; that keeps sessions attributable to where they began even if
the user roams across sites within one session.

Bump IndexedDB `DB_VERSION` to 2. A v1 → v2 migration runs inside the upgrade transaction, walks the
`sessions` store with a cursor, and stamps each record with `schemaVersion: 2` and
`domain = new URL(notes[0].pageUrl).hostname` (or `null` when the session has no notes or an
unparseable first URL). `MIGRATIONS` now receives both the database and the upgrade transaction —
schema-only entries ignore the second argument, data reshapes need it.

## Consequences

- Domain filtering runs in `O(sessions)` instead of `O(sessions × notes)`.
- Empty sessions have a domain from the moment they exist, so the side panel dropdown includes a
  session started on a page before any note has been captured.
- Reopening the extension after this change forces a one-off IDB upgrade that walks the store once.
  The upgrade transaction blocks new opens while it runs; the existing `versionchange` handler in
  `openStore` (ADR-0003 store discipline) already closes stale connections so this cannot deadlock.
- Sessions that outlive a mid-session navigation to another host are attributed to the origin the
  user was on when they clicked "start". This is intentional — the user's mental model of "which
  site am I collecting evidence for" tracks the origin they set out to capture, not the last URL
  visited.
- Test fixtures across `src/**/*.test.ts` and `tests/e2e/*` must carry `domain` or the type checker
  and `validateSession` reject them. Every existing fixture was updated in the landing commit.

## Alternatives considered

### Derive domain at query time from `notes[0].pageUrl`

Cheap to add — no schema bump, no migration — but empty sessions have no domain, dropdown rendering
scans every note of every session, and the value depends on which note happens to be first after
edits. The store already validates on read; adding a computed field to every reader duplicates that
logic.

### Store the full start URL and compute domain on demand

Would let a future feature recover the exact start page for a session. Rejected because
`Note.pageUrl` already retains the first captured URL and the session-level start URL is only ever
consumed as its hostname today. Adding the full URL invites accidental leakage into exports and
future skew between two "start URL" sources of truth.

### Recompute domain on every note append

Would let a session "follow" the user across origins. Rejected because it makes the domain field
non-deterministic from a session's own history — reading back a stored session no longer tells you
which site it belongs to, which is precisely what the side panel dropdown needs.
