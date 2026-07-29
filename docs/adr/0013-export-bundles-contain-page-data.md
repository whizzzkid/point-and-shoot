# ADR-0013 — Disclose page data before export

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

ADR-0002 limits what Point & Shoot can read: the extension receives access to one active tab only
after a user gesture. That inbound boundary does not make the resulting capture safe to share.

An export can contain a screenshot from an authenticated page, its URL, visible DOM text, selectors,
computed styles, and framework component hints. The extension writes the export to a local file or
the clipboard, but the product's purpose is to help the user hand that material to a coding agent.
When the agent is hosted, the user can therefore send data outside the device even though the
extension itself makes no network request.

A generic privacy statement in settings would be too far from the decision. The user needs this
context while choosing notes and immediately before creating the file or copying the prompt.

## Decision

Keep v1 export delivery local: write a ZIP through the browser downloads API or copy image-free
Markdown to the clipboard. Do not upload captures or call a remote agent.

At the export actions, name the data the bundle can contain and tell the user to treat it like any
other file they would paste into a chat. State that a hosted agent may receive data captured from
authenticated pages.

Strip a URL query by default when a parameter name looks sensitive, while allowing the user to
override that decision per note. Keep the full recorded URL in the local session; sanitize every
export projection independently.

## Consequences

- A user sees the outbound privacy boundary at the moment it matters, not only during installation
  or in options.
- v1 never sends a capture over the network. Adding a hosted-agent integration requires a successor
  ADR that specifies consent, destination, authentication, retention, and failure behavior.
- Query stripping reduces accidental token disclosure but cannot identify secrets in a path,
  screenshot, page title, DOM text, or an innocently named query parameter.
- The local IndexedDB record retains the original URL so review remains faithful and an explicit
  per-note choice can include the query.
- Clipboard output omits images, but it still contains URLs, note text, selectors, style evidence,
  and surrounding page metadata.
- Excluding a note excludes it from JSON, Markdown, and `shots/`; there is no hidden full-session
  payload in a filtered export.

## Alternatives considered

**Rely on the install-time permission prompt.** Rejected: `activeTab` explains when the extension
may read a page, not what an exported file contains or where the user may send it.

**Upload directly to a configured agent.** Rejected for v1: it turns a local capture tool into a
data processor and requires destination-specific consent, security, and retention decisions that
local download and clipboard delivery avoid.

**Remove every URL query unconditionally.** Rejected: some non-sensitive query state is essential to
reproduce a UI. The sensitive-name default plus a visible per-note override preserves that evidence
without silently exporting common token fields.

**Redact screenshots automatically.** Rejected for v1: reliable content-aware redaction is outside
the capture pipeline's guarantees. Pretending a heuristic makes authenticated screenshots safe would
be more dangerous than describing the actual boundary plainly.
