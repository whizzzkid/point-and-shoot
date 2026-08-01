---
title: Architecture review of the A2A client plan
type: plan
status: accepted
author: Codex
created: 2026-07-31
last_updated: 2026-07-31
epic: null
reviewers:
  - Nishant Arora
labels:
  - architecture-review
  - a2a
  - browser-extension
  - security
related:
  - title: A2A client delivery plan
    path: README.md
  - title: ActiveTab permission decision
    path: ../../adr/0002-activetab-only-permission-model.md
  - title: A2A protocol specification
    url: https://a2a-protocol.org/latest/specification/
---

# Architecture review of the A2A client plan

**Reviewed artifact:** [A2A client delivery plan](README.md) and its five phase guides\
**Reviewer role:** Principal architect\
**Review date:** 2026-07-31

## How to read this review

- **Executive summary** gives the verdict and largest residual risks.
- **Context and lens summary** state the constraints against which the design was judged.
- **Critical findings** are falsifiable failures already corrected in the plan.
- **Assumptions, failure matrix, and single points of failure** define the remaining proofs.
- **Prioritized actions** preserve risk order during implementation.

## Executive summary

The plan is accepted for phased implementation after correcting its permission, lifecycle,
persistence, authentication, and PR-ownership boundaries. Its largest residual risk is the official
JavaScript SDK and browser-platform combination: a stable A2A v1 client still must bundle in both
targets and prove optional-host, streaming, and restart behavior before UI work begins. No hosted
service or always-on compute is introduced; the main efficiency ceiling is local IndexedDB quota,
which now produces explicit incomplete history instead of silent loss. Cookie authentication and
mTLS remain bounded browser feasibility decisions, not unconditional delivery promises.

## Context

- **System:** A local-first Chrome and Firefox Manifest V3 extension becoming an A2A v1 client.
- **Quality priorities:** Privacy, durable delivery evidence, interoperability, cross-browser
  behavior, and recoverability.
- **Constraints:** `activeTab` remains limited to inspected pages; remote access is optional and
  host-scoped; service workers are suspendable; secrets cannot persist to disk; local copy and
  download paths remain independent of A2A.
- **Scale:** One local user, a small configured-agent catalog, potentially many retained sessions
  and runs, and at most one visible live stream per side panel.
- **Empirical pass:** The current manifest generator, browser shim, session store, options page,
  toolbar, plan view, and tests were inspected. No A2A implementation exists to execute yet, so the
  SDK, permission, stream, and auth state machines remain explicitly unverified until their named
  phase gates run.
- **Verdict:** Accepted after the plan incorporated all high-severity findings below. Phase 0 must
  still turn browser, SDK, and lifecycle assumptions into executable evidence before product work.

## Lens summary

| Lens                         | Review result                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A - Single points of failure | The SDK wrapper, access broker, ledger, visible stream owner, and remote agent have bounded failure behavior and local fallbacks.                           |
| B - Unhappy paths            | Denial, revocation, malformed cards, auth failure, disconnect, unknown delivery, task purge, corrupt storage, and quota exhaustion retain actionable state. |
| C - Underlying assumptions   | SDK browser compatibility, loopback patterns, Firefox grants, cookie isolation, and mTLS remain explicit proofs rather than promises.                       |
| D - Performance and scale    | One visible stream and serial reconciliation prevent fan-out; append-only events avoid rewriting complete histories.                                        |
| E - Security and trust       | Host-scoped grants, exact URL policy, session-only credentials, text-only rendering, and no generic background proxy preserve boundaries.                   |
| F - Operability              | Run, message, task, and context ids, two-axis status, typed errors, and redacted evidence support local diagnosis.                                          |
| G - Cost and efficiency      | No hosted infrastructure is added; bundle size, local storage growth, and browser work are the relevant resource ceilings.                                  |
| H - Delivery risk            | Feasibility, foundations, product UI, enterprise auth, and final verification are barriers; file-disjoint PR stacks preserve parallelism.                   |

## Critical findings

### High - A manifest cannot be injected or expanded dynamically

- **Lenses:** C - underlying assumptions; E - security; H - delivery risk.
- **Where:** `README.md`, Agent discovery and network access; phase 0, P0.2.
- **Problem:** A first interpretation suggested adding remote Agent Card and interface origins to a
  manifest at runtime. Manifest V3 has no such mechanism, and required wildcard host access would
  violate the extension's existing privacy decision.
- **Failure mode:** Discovery works only for predeclared agents, or the extension ships standing
  access to every site.
- **Recommendation:** Declare `optional_host_permissions` for HTTPS eligibility. A user gesture
  requests the narrowest card, interface, metadata, token, or key-set host pattern at runtime.
  Chrome may include a port; Firefox grants the scheme and host across ports, so a separate URL
  allowlist enforces the configured origin and endpoint. Loopback HTTP remains blocked until phase 0
  proves exact browser patterns. ADR-0018 records this narrow successor to ADR-0002.

### High - Content scripts cannot own remote fetches

- **Lenses:** C - underlying assumptions; E - security; F - operability.
- **Where:** `README.md`, Component map; phase 2, P2.4.
- **Problem:** Content scripts remain subject to the inspected page's same-origin policy even when
  the extension has host permissions. Forwarding arbitrary URLs to the background would instead
  create a confused-deputy proxy available to hostile pages.
- **Failure mode:** Agent access fails under page CORS, or a compromised page causes privileged
  cross-origin reads.
- **Recommendation:** Only extension pages, the side panel, or the service worker may use granted
  remote origins. Content messages carry a stored agent id; the background validates it and returns
  safe target summaries. It never accepts an arbitrary fetch URL.

### High - The service worker is not a reliable stream owner

- **Lenses:** A - single points of failure; B - unhappy paths; F - operability.
- **Where:** `README.md`, Delivery and recovery flow; phase 0, P0.3; phase 1, P1.5.
- **Problem:** Chrome may terminate an idle service worker and imposes response-lifecycle limits. A
  long SSE fetch cannot be made durable by treating the worker as a daemon.
- **Failure mode:** Status stops silently when the worker suspends, leaving an in-memory task id and
  response history inaccessible.
- **Recommendation:** Make the visible side panel own one live stream. Persist a run and exact
  request before network delivery, every event persists before display, and known tasks recover
  through `SubscribeToTask` or `GetTask` after remount. Push notifications remain out of scope
  because the extension has no public webhook.

### High - Initial-send failure can have an unknowable remote outcome

- **Lenses:** B - unhappy paths; E - security; F - operability.
- **Where:** `README.md`, Delivery and recovery flow; phase 1, P1.9.
- **Problem:** A disconnect after the agent accepts a message but before the client receives a task
  id is not safely distinguishable from a failed delivery. A2A does not guarantee server-side
  idempotency for a repeated message id.
- **Failure mode:** Automatic retry creates duplicate remote tasks while local history shows one.
- **Recommendation:** Mark the run `delivery-unknown`. Reconciliation must never call initial send.
  The UI explains the ambiguity and requires a deliberate new send with a new message id.

### High - Parallel lanes originally edited shared integration files

- **Lenses:** F - operability; H - delivery risk.
- **Where:** `README.md`, Stack execution contract; phase 1 through phase 4 stack maps.
- **Problem:** Independent auth lanes all edited `strategy-registry.ts` and `Options.tsx`; delivery
  and history lanes both edited the side-panel stylesheet. The nominally parallel work would create
  merge conflicts and ambiguous ownership.
- **Failure mode:** Agents serialize on conflict resolution, duplicate integration logic, or land a
  combined tree that no individual PR tested.
- **Recommendation:** Use phase roots for common contracts. Lanes export isolated adapters and own
  lane-specific styles; convergence PRs alone register adapters and edit shared UI. Lane PRs record
  completion in their PR bodies, and convergence updates shared phase docs after every tip lands.

### High - Durable history cannot claim events that failed to persist

- **Lenses:** B - unhappy paths; D - performance and scale; F - operability.
- **Where:** `README.md`, Stored records; phase 1, P1.4 and P1.9.
- **Problem:** IndexedDB quota can be exhausted while an SSE stream is active. Continuing to display
  uncommitted events would make the visible response disagree with the promised durable history.
- **Failure mode:** Reopening a run loses output the user already saw, with no indication that the
  ledger is incomplete.
- **Recommendation:** Persist events before UI emission. A failed append aborts stream consumption,
  retains the last committed event, and marks the run's persistence state incomplete when possible.
  No automatic retention policy deletes old data to make room.

### High - Credentials and authenticated cards need a separate lifetime

- **Lenses:** B - unhappy paths; E - security; F - operability.
- **Where:** `README.md`, Authentication roadmap; phase 1, P1.6; phase 3.
- **Problem:** Agent profiles and run history must survive restart, while API keys, tokens, PKCE
  material, client secrets, and extended Agent Cards must not persist to disk.
- **Failure mode:** Durable storage leaks credentials or session clearing destroys discovery and
  history.
- **Recommendation:** Keep public cards, profiles, runs, and ordered events in IndexedDB. All
  credential material and authenticated extended cards use `storage.session`, remain inaccessible to
  content scripts, and require reauthentication after browser restart.

### High - Endpoint authentication and in-task authorization are distinct

- **Lenses:** B - unhappy paths; C - underlying assumptions; E - security.
- **Where:** `README.md`, Authentication roadmap; phase 3, P3.7.
- **Problem:** Agent Card security schemes authenticate protocol requests, while
  `TASK_STATE_AUTH_REQUIRED` can ask the client to fulfill an authorization out of band. Core A2A
  intentionally does not define that credential's representation.
- **Failure mode:** The extension sends a stored Bearer token or another credential into an A2A
  message that the agent did not request through a negotiated secure mechanism.
- **Recommendation:** Never infer a mapping from task authorization to endpoint credentials. Use an
  adapter only for a negotiated extension; otherwise let the user fulfill the request out of band
  and resume with `SubscribeToTask` or `GetTask` without transmitting credentials.

### Medium - Agent and skill security requirements are not interchangeable

- **Lenses:** C - underlying assumptions; E - security.
- **Where:** `README.md`, Authentication roadmap; phase 3, P3.9.
- **Problem:** The protocol permits both agent-level and skill-level security requirements, but the
  requested UI selects an agent, not a protocol skill.
- **Failure mode:** The client invents a skill selection or supplies a credential set unrelated to
  the sent request.
- **Recommendation:** Initial delivery negotiates agent-level requirements. Skill requirements are
  shown as metadata. A skill-specific challenge is handled as `TASK_STATE_AUTH_REQUIRED` or an HTTP
  auth failure; skill selection and a general multi-turn composer remain future work.

### Medium - Exact Markdown still needs input-mode negotiation

- **Lenses:** B - unhappy paths; C - underlying assumptions.
- **Where:** Phase 1, P1.8.
- **Problem:** Sending the existing Markdown does not imply that every card accepts `text/markdown`.
- **Failure mode:** The client sends a media type the agent explicitly does not support or changes
  the prompt to satisfy the card.
- **Recommendation:** Keep the request text byte-for-byte equal to the selected local Markdown. The
  client prefers `text/markdown`, may label it `text/plain` when that mode is accepted, and blocks
  an agent that accepts neither text mode.

### Medium - Interface tenant data is part of transport selection

- **Lenses:** B - unhappy paths; C - underlying assumptions.
- **Where:** `README.md`, Agent discovery; phase 1, P1.3 and P1.8.
- **Problem:** An Agent Card interface can include an opaque tenant used for routing every request.
  Saving only its URL, binding, and protocol version loses that required binding data.
- **Failure mode:** Discovery succeeds, but every send or task lookup reaches the wrong tenant or is
  rejected.
- **Recommendation:** The profile and immutable run target snapshot retain the selected interface's
  optional tenant, and the transport includes it without interpreting it in every operation.

### Medium - Browser-owned cookie and mTLS mechanisms need fixed decision rules

- **Lenses:** C - underlying assumptions; E - security; H - delivery risk.
- **Where:** Phase 3, P3.4 and P3.6.
- **Problem:** Cookie partitioning and client-certificate selection vary across browser, profile,
  privacy mode, OS, and enterprise policy. An implementation-first item could expand into a native
  credential broker.
- **Failure mode:** A Chrome-only path is labeled cross-browser, or private keys enter extension
  storage.
- **Recommendation:** Keep phase 3's proof items bounded. Each mechanism ships only if Chrome and
  Firefox meet the same safety contract; otherwise the client recognizes the scheme and provides an
  actionable browser-managed or unsupported state. Native messaging is excluded.

### Medium - A valid card signature is not an identity trust decision

- **Lenses:** C - underlying assumptions; E - security.
- **Where:** Phase 3, P3.5.
- **Problem:** A card can point at a key controlled by the same party that authored the card. JWS
  verification against that key proves integrity, but no independent authority vouched for the
  signer.
- **Failure mode:** The options page labels an attacker-controlled, self-signed card as a trusted
  enterprise agent.
- **Recommendation:** Render signature valid, unsigned, or signature invalid with key provenance.
  Fetch key sets only from a protected JWS header, and never claim agent identity trust without a
  separate external trust policy.

## Underlying assumptions

| Assumption                                                                             | Status                                                         | Risk if wrong                                                                                   |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A stable A2A v1 JavaScript SDK exposes a browser-safe client surface.                  | Unverified; P0.1 owns the executable proof.                    | The plan stops before phase 1 and requires an explicit prerelease or alternate-client decision. |
| Granted host permissions enable extension-context cross-origin fetch in both browsers. | Documentation-verified; P0.3 owns runtime verification.        | Discovery or streaming needs a different extension architecture.                                |
| Firefox host patterns cannot restrict a port, while client code can.                   | Verified in current browser documentation; P0.2 tests it.      | A grant is broader than disclosed or the exact URL policy blocks valid agents.                  |
| `storage.session` survives context suspension and clears on restart.                   | Documentation-verified; P0.3 owns runtime verification.        | Credentials disappear mid-run or persist longer than disclosed.                                 |
| An agent retains a known task long enough to query or subscribe.                       | Risky and server-dependent.                                    | Reconciliation reports a purged task without fabricating missing events.                        |
| Local IndexedDB has enough space for ordinary text responses.                          | Risky and unbounded by the protocol.                           | Stream consumption stops with explicit incomplete history.                                      |
| Cookie and mTLS paths can share one Chrome and Firefox safety contract.                | Unverified; P3.4 and P3.6 have fixed decisions.                | The scheme remains recognized but browser-managed or unsupported.                               |
| One visible stream plus serial reconciliation meets a single-user extension workload.  | Verified product constraint; P4 fault tests challenge fan-out. | History refresh becomes slow, but no remote task is replayed or lost locally.                   |

## Failure matrix

| Trigger                        | Required result                               | Forbidden result                                |
| ------------------------------ | --------------------------------------------- | ----------------------------------------------- |
| Origin grant denied or revoked | Stop before remote access; keep local actions | Retry prompt loop or required wildcard access   |
| Card redirect to a new origin  | Require a new explicit grant                  | Follow with the old grant                       |
| Missing or unsupported auth    | Explain exact schemes and preserve review     | Downgrade to no auth                            |
| `401`                          | Refresh or reacquire once where defined       | Infinite retry or retry `403`                   |
| Disconnect with task id        | Persist disconnected state and reconcile task | Replay initial send                             |
| Disconnect without task id     | Mark `delivery-unknown`                       | Claim failure or silently resend                |
| Event append hits quota        | Abort stream and show incomplete history      | Display unpersisted output or delete older data |
| Corrupt stored entry           | Isolate the entry and show other history      | Cast it or hide the complete list               |
| Remote HTML, Markdown, or URL  | Render text and typed metadata only           | Use `innerHTML` or load remote assets           |
| Browser restart                | Keep public history; clear credentials        | Persist secrets or erase run evidence           |

## Single points of failure

- **Official SDK wrapper:** Owns protocol compatibility. Phase 0 proves its browser bundle and pins
  the exact stable version; the adapter prevents Node-only or gRPC imports from leaking in.
- **Remote access broker:** Owns URL normalization and grants. Failure blocks remote delivery but
  leaves all local capture and export paths available.
- **Run ledger:** Owns durable client evidence. A storage failure stops remote consumption instead
  of silently operating without history.
- **Visible side panel:** Owns the current stream. Closing it degrades to durable task
  reconciliation, not task loss.
- **Agent service:** Owns task state and availability. The extension never claims delivery beyond
  its last persisted remote identifier or response.

## Prioritized actions

1. Complete the SDK, optional-host, cross-origin, Firefox, session-storage, and stream-lifecycle
   proofs before accepting ADR-0018.
2. Land the IndexedDB v2 and session-only credential boundary before any visible send action.
3. Preserve pre-network run creation and persist-before-display ordering through every UI path.
4. Land the first public, Bearer, and header API-key slice before expanding enterprise auth.
5. Apply phase 3's fixed cookie and mTLS decisions; do not expand scope to native messaging.
6. Re-run this review against the combined implementation in P4.9 and close no high-severity debt.

## What the design gets right

- Remote delivery remains behind the existing plan-review privacy boundary.
- Host-scoped optional grants plus exact URL policy extend remote-agent access without broadening
  inspected-page access.
- Protocol state, transport state, and persistence completeness remain separate user-visible facts.
- The official SDK owns evolving wire types while project adapters own browser and product policy.
- Immutable requests and ordered events make history useful even after sessions or profiles change.
- The phase and PR-stack topology maximizes concurrency while naming one owner for every shared
  integration point.
