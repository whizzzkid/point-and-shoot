# ADR-0018 — Astro for the marketing and documentation site

- **Status:** Superseded by ADR-0019
- **Date:** 2026-07-31
- **Supersedes:** [ADR-0008](0008-preact-for-extension-ui-astro-for-marketing.md)

## Context

[ADR-0008](0008-preact-for-extension-ui-astro-for-marketing.md) selected Preact for the five
extension surfaces and isolated Astro in `site/` for the marketing page. The extension framework
boundary remains correct, but the public product documentation now also needs static rendering,
shared product theming, generated navigation, build-time Mermaid diagrams, and link validation.

Maintaining a second website toolchain for documentation would duplicate token, font, deployment,
and integrity work. Copying Markdown under `site/` would also create two editable sources for each
document.

## Decision

Keep Preact for every extension surface. Use the isolated Astro project in `site/` for both public
web surfaces: the marketing page at the site root and rendered product documentation under `/docs/`.

Astro reads the publishable Markdown from the repository's existing `docs/` tree without copying it.
The website consumes generated design tokens and vendored fonts from the same source artifacts as
the extension. Nothing in `site/` ships in either browser package, and the site build does not
import extension runtime code from `src/`.

## Consequences

- Marketing and documentation share one static build, deployment, theme, and integrity pipeline.
- Repository Markdown remains the only editable documentation source.
- The Node carve-out is larger than ADR-0008 originally allowed, but it remains confined to `site/`
  and cannot affect extension packages.
- Site failures are isolated by path filters, while changes to published Markdown must run the site
  checks because they change deployed output.
- Reusing runtime Preact components in the site would cross the boundary and requires another
  decision; shared generated tokens and vendored assets are data inputs, not runtime imports.

## Alternatives considered

**A separate documentation generator.** Rejected because it duplicates theming, navigation,
deployment, and link-check infrastructure for the repository's second public web surface.

**Copy Markdown into an Astro content collection.** Rejected because two editable copies drift and
the repository-local document is already the contributor-facing source of truth.

**Publish documentation only through GitHub.** Rejected because it cannot provide the product theme,
build-time diagram validation, or the integrated public navigation required by the site.
