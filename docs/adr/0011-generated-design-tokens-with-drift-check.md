# ADR-0011 — Generate design tokens from the bundle, and fail CI on drift

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The design system's colours, spacing, radii, type scale, and motion values live in
`.claude-design/point-and-shoot/tokens/`, which is an upstream artifact we do not hand-edit (see
[`../design.md`](../design.md)). The extension needs those same values as TypeScript and as CSS
custom properties injected into the closed shadow root
([ADR-0006](0006-closed-shadow-dom-for-injected-ui.md)).

The path of least resistance is to copy them once into `src/shared/design/` and move on. The problem
is not the copying — it is that the copy and the source then diverge silently. A re-export of the
design bundle changes an accent colour; the extension keeps rendering the old one; nothing fails;
and review cannot catch it, because a diff that touches only `.claude-design/` looks like an
upstream update nobody needs to read. The drift surfaces eventually as "the toolbar's blue is
slightly off", which is expensive to trace back to its cause.

## Decision

Generate `src/shared/design/` from `.claude-design/point-and-shoot/tokens/` with a build step. The
generated files are committed, so the extension builds without running the generator, and they carry
a header marking them generated. Never hand-edit them.

CI regenerates the tokens and fails on any diff against what is committed. Drift becomes a red build
rather than a visual bug.

## Consequences

- The committed tokens are always exactly what the design bundle specifies, and that is enforced by
  a gate rather than by remembering.
- A token change must be made **upstream in the design bundle and re-exported**. There is no valid
  local edit — a change made directly in `src/shared/design/` fails CI, which is the intended
  outcome rather than an obstacle.
- The generator must be deterministic: stable key ordering, fixed number formatting, and a fixed
  newline convention. A generator whose output varies between runs or between machines turns the
  drift check into a flaky failure, which is worse than no check because it teaches people to ignore
  it.
- The generator's output must satisfy `deno fmt --check` as generated, or the check fails on
  formatting rather than on drift and the signal is lost.
- Re-exporting the bundle now moves several things at once: the tokens, the recorded export identity
  in [`../design.md`](../design.md), and any visual baselines the token change invalidates. That is
  one commit, and it is a deliberately visible event.
- Adding a token category means updating the generator, not just consuming a new value.

## Alternatives considered

**Hand-copy the tokens.** Rejected: it is the status quo this ADR exists to prevent. The failure is
silent and it is invisible in review, which is the worst combination.

**Read the bundle's token files at runtime.** Rejected: it makes the upstream artifact a runtime
dependency shipped inside the extension, ties the extension's behaviour to a file we do not own, and
adds parsing to startup. Generation happens once at build time instead.

**Generate at build time without committing the output.** Rejected: it removes the drift check's
whole mechanism — with nothing committed there is no diff to compare against — and it makes every
build depend on the generator working. Committed generated output plus a regeneration check gives
both reproducibility and enforcement.

**Import the bundle's tokens directly as a module.** Rejected: the bundle's files are JSX and
TypeScript written against dependencies this project does not have (which is why `.claude-design/`
is excluded from `deno check` wholesale). Importing them would pull that dependency surface into the
extension.
