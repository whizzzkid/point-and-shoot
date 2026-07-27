# ADR-0002 — Request activeTab only, never broad host permissions

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

This extension reads the DOM of whatever page the user is annotating and screenshots it. That is
exactly the capability a malicious extension wants, which means the permission the manifest requests
is the single most consequential line in it.

The convenient option is `"host_permissions": ["<all_urls>"]`. It works everywhere, needs no
gesture, and lets the extension act at any time — including on pages the user never pointed it at.
It is also the permission that makes an install prompt say the extension can read and change data on
all websites, which is the prompt users learn to fear and reviewers learn to scrutinise.

`activeTab` grants the same access to one tab, scoped to a user gesture on the extension's own UI,
and expires. The user's click is the grant. Nothing in the product's shape needs more than that: the
whole interaction begins with the user deciding to point at something.

## Decision

Request `activeTab` and nothing broader. No `<all_urls>`, no wildcard host permissions, no
persistent content-script registration in the manifest — inject on gesture instead. Every capability
the extension has over a page traces back to a click the user just made on the extension's own
surface.

## Consequences

- The extension is structurally incapable of reading a page the user did not activate it on. This is
  a guarantee we can state plainly rather than a policy we promise to follow.
- No background page-scanning, no "watch this page for changes", no automatic capture on navigation,
  no pre-warming a content script before the user asks. Any such feature requires revisiting this
  ADR, and revisiting it means changing the install prompt users already accepted.
- The content script must be injectable and initialisable mid-session, on a page that has already
  finished loading, with no guarantee it ran at document start. Wave 2 onward must not assume
  document-start timing.
- `activeTab` does not cover the browser's own privileged pages, extension gallery pages, or (in
  Firefox) certain restricted domains. Those failures are permanent, not bugs; the UI must say so
  clearly instead of appearing broken.
- Store review is faster and the privacy policy is short, because there is little to disclose.

## Alternatives considered

**`<all_urls>` host permissions.** Rejected: it buys convenience for the implementation and pays
with the user's trust and the reviewer's patience. It also makes any future security incident far
worse, since a compromised extension would already hold standing access to every page.

**Optional host permissions, requested at runtime for "power user" features.** Rejected for v1: it
reintroduces the broad grant through a door labelled differently, and once granted it is permanent
and invisible. Worth reconsidering only for a concrete feature that genuinely cannot work
gesture-scoped, documented in a successor ADR.

**A narrow static allowlist of host patterns.** Rejected: there is no defensible list — users
annotate arbitrary pages. A list broad enough to be useful is `<all_urls>` with extra steps.
