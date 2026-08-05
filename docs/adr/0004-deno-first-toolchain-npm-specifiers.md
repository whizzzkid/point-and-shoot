# ADR-0004 — Deno owns the dev loop; Node tooling arrives via npm: specifiers

- **Status:** Superseded by ADR-0019
- **Date:** 2026-07-24

## Context

The extension is TypeScript. It needs formatting, linting, type checking, a unit test runner, a
bundler, an E2E driver, a Firefox launcher, and a font subsetter. Those tools do not come from one
ecosystem: Deno covers the first four natively with no dependencies to install, while esbuild,
Playwright, web-ext, and the subsetter are npm packages.

The default arrangement — a `package.json`, `node_modules`, and a separate tool for each of format,
lint, type-check, and test — means four config files that can each disagree about which files they
cover, plus a lockfile whose contents nobody reviews. The failure mode is not dramatic; it is a lint
rule that quietly stops applying to a directory somebody forgot to add.

Deno resolves `npm:` specifiers directly, so the npm tools are reachable without a `package.json`.

## Decision

Deno owns the development loop. `deno.json` is the single task registry, and `mise.toml` pins tool
versions and nothing else — mise manages tools, `deno task` manages commands. Node-only tooling is
invoked through pinned `npm:` specifiers. No `package.json` and no `node_modules` at the repository
root.

`deno task ci` runs `fmt:check` → `lint` → `check` → `test` in sequence, and is the single command
both the lefthook pre-push hook and GitHub Actions invoke, so local and remote gates cannot diverge.

## Consequences

- One file lists every command, and one file pins every tool version. A fresh clone is
  `mise install` plus the Playwright browser download.
- `deno.json`'s top-level `exclude` governs `fmt`, `lint`, and `check` together, so file scope is
  stated once instead of three times. Note that per-subcommand excludes do **not** cover
  `deno check` — a lesson learned the hard way when the committed design bundle's JSX broke type
  checking while passing fmt and lint.
- npm-compat friction is accepted. Some packages assume Node built-ins or a real `node_modules`
  layout; the mitigation is per-package (a `--node-modules-dir` flag, occasionally a different
  package), not an escape hatch back to a `package.json`.
- Tools invoked via `npm:` must carry their exact version in the specifier, since there is no
  lockfile entry pinning them for us. An unpinned `npm:` specifier is a floating dependency and is
  treated as a review blocker.
- **Carve-out:** the marketing and documentation site is Astro, which is Vite/Node-based and needs a
  Node toolchain. It lives entirely in `site/` with its own `package.json`, and nothing it produces
  ships inside the extension. See [ADR-0008](0008-preact-for-extension-ui-astro-for-marketing.md).

## Alternatives considered

**A minimal `package.json` for just the E2E stack.** Rejected: "minimal" does not stay minimal, and
the moment it exists there are two task registries and two places to bump a version. The friction it
avoids is occasional; the ambiguity it creates is permanent.

**Node with the full conventional toolchain — ESLint, Prettier, tsc, Vitest.** Rejected: four tools
with four independent notions of which files they cover, when Deno gives one. The specific hazard is
a config that silently stops covering a directory, which no test catches.

**Bun.** Rejected: it would cover much of the same ground, but its extension-relevant story is less
settled and it brings no advantage over Deno for this workload. Not a rejection on merit so much as
no reason to switch.
