# Specifications

A spec states _what_ the software guarantees: schemas, formats, invariants, and error behavior.
Specs are **normative** — an implementation that disagrees with a spec is a bug in one of the two,
and the pull request that finds the disagreement must say which one it is fixing.

Specs describe the current product, not implementation history or future work. The reasoning behind
a constraint lives in [`../adr/`](../adr/README.md).

Write each spec for a reader implementing against it without access to the implementation. That
means naming the exact field names, the units, the bounds, and what happens on each failure — a spec
that only covers the happy path leaves the interesting half of the contract undefined. Shared bounds
come from the [runtime limits](runtime-limits.md) spec and their owning exported constants.

## Published contracts

- [Export bundle](export-bundle.md) — note selection, privacy projection, canonical JSON, Markdown,
  ZIP layout, legacy settings compatibility, and delivery failures.
- [Toolbar session control](toolbar-session-control.md) — toolbar and keyboard entry points,
  lifecycle, badge and tooltip state, concurrency, and failure behavior.
- [Extension settings](settings.md) — versioned defaults, runtime consumers, browser shortcuts,
  validation, and destructive clearing.
- [Framework component hints](framework-component-hints.md) — opt-in page-world probing, supported
  development builds, evidence shape, trust boundary, and graceful degradation.
- [Runtime limits](runtime-limits.md) — the single normative table for evidence, screenshot, and
  legacy export bounds.
- [Extension runtime](extension-runtime.md) — browser targets, permissions, injection, capture,
  evidence, storage, and UI surfaces.
- [Build, release, and verification](build-release-and-verification.md) — build outputs, test tiers,
  protected checks, CalVer, and release artifacts.
- [Website and published documentation](website-and-published-docs.md) — shared design inputs,
  published scope, static rendering, quality gates, and deployment.
