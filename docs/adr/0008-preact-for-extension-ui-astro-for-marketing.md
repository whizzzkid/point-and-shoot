# ADR-0008 — Preact for the extension UI; Astro only for the marketing site

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The committed design bundle (see [`../design.md`](../design.md)) ships its prototypes as `.jsx`. A
JSX runtime therefore ports them across more or less directly, while any other rendering model means
rewriting every prototype by hand — and a hand-rewrite is where design intent gets quietly dropped.

The constraint that decides which JSX runtime is where the code runs: the toolbar and picker overlay
are injected into arbitrary third-party pages. Whatever the runtime weighs is added to every page
the user annotates, and whatever surface it exposes is exposed inside someone else's document. React
is around 45KB minified and gzipped for react + react-dom; Preact is around 4KB with a compatible
API and JSX handling. At this surface area — a toolbar and an overlay — React's advantages
(ecosystem depth, concurrent rendering, the larger hooks surface) buy nothing we need.

Astro came up because it is the obvious choice for the wave-5 marketing site and it would be tidy to
use one framework for everything. It does not work for the extension, for reasons worth writing down
so nobody re-litigates them:

- It is Vite/Node-based, which conflicts with the Deno-first toolchain
  ([ADR-0004](0004-deno-first-toolchain-npm-specifiers.md)).
- Its `security.csp` support emits a `<meta>` CSP tag with hashes and does not work in dev, while
  MV3 governs extension pages through the manifest's `content_security_policy.extension_pages`. The
  two mechanisms do not meet.
- Decisively: **a content script is not a page.** Astro's output unit is an HTML document. The
  overlay has no document — it is a subtree mounted into someone else's. Astro cannot build it at
  all, at any level of effort.

## Decision

Use Preact with JSX for all five extension surfaces: the injected toolbar overlay, the popup, the
notes side panel, the plan view, and the options page. Use Astro for the wave-5 marketing site only,
isolated in `site/` with its own Node toolchain, producing nothing that ships inside the extension.

## Consequences

- Design-bundle prototypes port to production components with their structure intact, so review can
  compare against the prototype rather than against a description of it.
- Roughly 4KB of framework, not 45KB, enters every annotated page. It is still not zero, and it is
  still our code running in someone else's document — the bundle-size budget is a real gate in wave
  2, not a nice-to-have.
- Anything reaching for a React-ecosystem package must go through `preact/compat`, and some packages
  will not work. Preferring a small hand-written component over a dependency is the default answer,
  which suits a surface this size.
- Two frameworks exist in the repository. The boundary is absolute and mechanical: `site/` is Astro
  and Node, everything else is Preact and Deno. Nothing crosses. A shared component between the two
  would be the first sign this decision is eroding.
- The marketing site's Node toolchain means `site/` has its own `package.json`, which is the
  carve-out ADR-0004 records rather than an exception someone discovered.

## Alternatives considered

**React.** Rejected: about 45KB into arbitrary third-party pages for capabilities this surface does
not use. The API compatibility that would make it a drop-in is exactly what Preact already provides.

**Lit, or web components with tagged templates.** Rejected: it pairs naturally with the closed
shadow root in [ADR-0006](0006-closed-shadow-dom-for-injected-ui.md), which is a genuine point in
its favour, but every design-bundle prototype would be rewritten from JSX into tagged templates by
hand. The rewrite cost falls on the exact artifact whose fidelity matters most.

**No framework — direct DOM construction.** Rejected: it is the smallest possible option and it was
seriously considered, but the picker overlay has enough interactive state (hover target, hover
candidates, selection, note editing, capture progress) that hand-rolled DOM updates become a bespoke
reconciler with none of the testing.

**Astro for the extension too.** Rejected on the mechanism: a content script has no document for
Astro to emit, so this is not a trade-off but an impossibility.
