# ADR-0015 — Run opt-in framework probes in a constrained main-world call

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

React, Vue, Svelte, and Angular attach development metadata to JavaScript wrappers around DOM
elements. The picker runs as an isolated content script: it shares the document with the page but
not the page's JavaScript object graph. Reading a React fiber or Vue component instance directly
from that isolated wrapper can pass a same-world test harness while returning nothing in the real
extension.

Both supported browser floors expose `scripting.executeScript()` with the `MAIN` execution world:

- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Firefox execution worlds](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld)

Main-world execution gives the page visibility into and influence over the probe. It therefore
cannot receive extension-owned data or retain extension capabilities.

## Decision

Run one pure, batched framework-probe function in the sender frame's `MAIN` world only after the
background independently confirms the persisted opt-in.

Pass only verified CSS selector segments derived from the inspected page. Return only validated,
page-derived component metadata. Do not expose storage, sessions, runtime messaging, extension URLs,
or any other extension API to the main-world function.

Treat the result as untrusted advisory evidence. Bound one batch to the settled 25-element note cap,
validate its exact alignment and field shapes in the isolated world, and convert every exception or
malformed result to absent hints without logging or blocking capture.

## Consequences

- Real React and Vue expandos are observable without adding host permissions or a persistent page
  bridge.
- The page can detect the probe, spoof framework metadata, override DOM methods, or make the call
  fail. The exported hint is therefore never authoritative.
- Opting out performs no main-world execution. The background rechecks storage so the privacy gate
  does not rely on content-realm state alone.
- One batched call avoids up to 25 page-world round trips for a drag selection.
- Production builds commonly strip source metadata and intentionally produce no hint.
- Framework internals are version-fragile. Support claims name only versions driven by real pinned
  fixtures.
- Probe failures are deliberately silent. Selector and style evidence, the screenshot, and note
  persistence continue unchanged.

## Alternatives considered

### Read expandos directly in the content script

Rejected because isolated-world DOM wrappers do not reliably expose page-owned JavaScript
properties. It creates a false-positive test path and a feature that silently fails in production.

### Install a persistent page-world event bridge

Rejected because it leaves a longer-lived, page-observable protocol in every activated document and
must account for page CSP, event spoofing, cleanup, and navigation. A one-shot scripting call has a
smaller lifetime and no retained capability.

### Run one main-world call per element

Rejected because a drag capture may contain 25 elements. Batching keeps failure alignment explicit
and pays the cross-world overhead once.

### Use browser developer-tools APIs

Rejected because they require a different extension surface and permission model, and they do not
fit gesture-driven capture under `activeTab`.
