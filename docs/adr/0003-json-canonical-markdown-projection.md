# ADR-0003 — Versioned JSON is canonical; Markdown and clipboard output are projections

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

A capture is a structured thing: a selector bundle with several strategies, element geometry, a
screenshot reference, the page URL and title, a timestamp, and the user's note. The user, however,
mostly wants to paste Markdown into an issue or a chat with a coding agent.

That makes Markdown tempting as the storage format — it is what gets shown, so storing it directly
removes a conversion step. The cost is that Markdown is lossy in one direction only: a selector
bundle rendered into a fenced block cannot be reliably parsed back into its fields, so anything the
renderer chose not to print is gone. The first consumer that needs a field the renderer dropped has
to change the storage format, migrate existing records, and hope the old text can be re-parsed.

v2 already has known consumers that are not Markdown: a remote handoff, and MCP sinks that want the
structured record rather than prose.

## Decision

Store captures as versioned JSON in IndexedDB. Every record carries an explicit schema version.
Markdown, clipboard text, and any other human-facing output are **projections** computed from that
JSON at read time by a serializer — never the stored form, never round-tripped back into storage.

## Consequences

- Adding an output format is a new serializer over an unchanged store. v2's remote handoff and any
  MCP sink are serializer swaps, not rewrites or migrations.
- Every schema change needs a version bump and a migration path, and the migration code accumulates.
  That is real ongoing cost, accepted because the alternative is unrecoverable data loss rather than
  bounded maintenance.
- Reading a capture always costs a serialization step. Irrelevant at this scale, and it keeps
  exactly one code path responsible for how a capture renders.
- The Markdown output is not a source of truth and must never be parsed by our own code. A feature
  request to "import a pasted capture" is a request for a new input parser, and it needs its own ADR
  — it does not make Markdown canonical by the back door.
- Because the projection is deterministic from stored data, rendered output is testable without a
  browser: unit tests feed JSON fixtures to the serializer.

## Alternatives considered

**Store Markdown directly.** Rejected: it discards structure the product needs later, and the loss
is silent — nothing fails at write time, only at the point some future consumer wants a field the
renderer never printed.

**Store both JSON and rendered Markdown.** Rejected: two representations of one truth drift the
moment the renderer changes, and the stored copy becomes stale for every record written before that
change. If Markdown is cheap to compute — it is — there is no reason to keep a copy that can be
wrong.

**Unversioned JSON.** Rejected: the first schema change then has to infer a record's shape by
inspecting it. A version field costs nothing and turns migration from guesswork into a lookup.
