# Wave 5 — Marketing site

**Read [`README.md`](README.md) in this folder first.**

- **Status:** deferred, post-v1
- **Goal:** the landing site from `.claude-design/point-and-shoot/ui_kits/marketing/index.html`.

## Why this is deferred and separate

A landing page ships nothing until there is something to install, and its content depends on a product
that doesn't exist yet. It is also the one surface where the design intentionally departs from the rest
— the bundle notes the marketing site is "the one place spacing opens up," in contrast to the
information-dense tool.

Nothing in waves 1–4 depends on this, and this depends on nothing but the design bundle. It can be
picked up at any time after v1 works.

## Stack

**Astro**, per ADR 0008. Astro was rejected for the extension (Vite/Node toolchain, and a content
script is not a page) but it's the right fit here: static output, zero JS by default, and Preact
islands via `@astrojs/preact` if any section needs interactivity — which lets the W3.1 components be
reused rather than rebuilt.

The Node toolchain is isolated in `site/` with its own `package.json` and lockfile. This is the
documented carve-out from the Deno-first ADR, and it holds only because **nothing in `site/` ships
inside the extension**. Do not let Astro or Vite reach into `src/`.

## Items

- [ ] **W5.1** — Astro project in `site/`, pinned exact versions, its own lint and build tasks, wired
  into CI as a separate job that does not gate extension changes.
- [ ] **W5.2** — Port the marketing kit. Read
  `.claude-design/point-and-shoot/ui_kits/marketing/index.html` first. Honour the brand rules
  (sentence case, no emoji, one accent element per screen) and the design's note that this surface uses
  more generous spacing than the tool. The design specifies high-contrast photography, no illustration.
- [ ] **W5.3** — Share the design tokens rather than duplicating them: consume the same generated
  tokens from W2.4, so a token change propagates to both the extension and the site. Duplicating the
  palette here would drift within a release.
- [ ] **W5.4** — Fonts: reuse the W2.5 subset WOFF2 files, self-hosted. The CDN prohibition was an MV3
  constraint and doesn't technically apply to a website, but self-hosting is still the right default
  for performance and for not sending visitors' IPs to a third party.
- [ ] **W5.5** — Install links for Chrome Web Store and AMO once listings exist, with a from-source
  fallback until then. Do not ship dead store links.
- [ ] **W5.6** — Deploy via GitHub Pages on a tag or on merge to `main`, with a Lighthouse check in CI
  and a real accessibility pass (the same axe standard as W4.4 — a tool that markets itself on UI
  quality cannot ship an inaccessible landing page).

## Exit criteria

Site builds and deploys; tokens and fonts are shared with the extension rather than copied; Lighthouse
and axe both pass; every install link resolves.
