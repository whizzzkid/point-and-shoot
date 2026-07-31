# Specifications

A spec states _what_ the software guarantees: schemas, formats, invariants, and error behavior.
Specs are **normative** — an implementation that disagrees with a spec is a bug in one of the two,
and the pull request that finds the disagreement must say which one it is fixing.

Specs describe behavior, not plans. Sequencing and ownership live in
[`../plans/`](../plans/README.md); the reasoning behind a constraint lives in
[`../adr/`](../adr/README.md).

Write each spec for a reader implementing against it without access to the implementation. That
means naming the exact field names, the units, the bounds, and what happens on each failure — a spec
that only covers the happy path leaves the interesting half of the contract undefined. Every bound
cited here comes from the settled-numbers table in [`../plans/README.md`](../plans/README.md) rather
than being chosen locally, so two specs cannot disagree about the same limit.

## Published contracts

- [Export bundle](export-bundle.md) — note selection, privacy projection, canonical JSON, Markdown,
  ZIP layout, size warnings, and delivery failures.
- [Export-format spike](export-format-spike.md) — the measured agent trial that settled the v1
  bundle shape and `2 MB` default warning threshold.
- [Toolbar session control](toolbar-session-control.md) — toolbar and keyboard entry points,
  lifecycle, badge and tooltip state, concurrency, and failure behavior.
- [Extension settings](settings.md) — versioned defaults, runtime consumers, browser shortcuts,
  validation, and destructive clearing.
- [Framework component hints](framework-component-hints.md) — opt-in page-world probing, supported
  development builds, evidence shape, trust boundary, and graceful degradation.
