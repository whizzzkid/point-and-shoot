# ADR-0009 — No remote assets: fonts subset locally, icons vendored as a sprite

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The design bundle's prototypes load their typeface from Google Fonts and their icons from a Lucide
CDN. That is normal for a prototype and unacceptable for this extension, for two independent
reasons.

The first is policy: Manifest V3 forbids loading remote code, and the extension-pages CSP blocks
external fetches by default. A remote stylesheet or script is simply not going to load.

The second is worse, and it applies to fonts specifically — which are data, not code, and so are not
covered by the remote-code rule. The overlay is injected into whatever page the user is annotating.
A font fetch from that overlay tells the font's host which pages the user is annotating, complete
with timing. The user pointed at an internal admin page, and a third party learns they were looking
at something at that moment. That directly contradicts the privacy posture of
[ADR-0002](0002-activetab-only-permission-model.md), which is not merely a permission choice but the
product's central promise.

Neither reason has an exception for "just the font" or "only in the options page".

## Decision

Ship every asset with the extension. No remote fetches of any kind at runtime — no fonts, no icons,
no stylesheets, no scripts, no analytics, no telemetry.

- Fonts are subset to the glyphs the UI actually uses, converted to WOFF2, and served from
  `web_accessible_resources`.
- Lucide icons are vendored at build time as an inline SVG sprite containing only the icons used.

## Consequences

- The extension makes zero network requests attributable to the user's browsing. This is verifiable
  rather than promised: a test can assert that no request leaves the extension's own origin.
- The build gains a font-subsetting step and an icon-sprite generation step. Both are real
  infrastructure with pinned tool versions, and both can fail in ways that produce a working-looking
  build with missing glyphs.
- Adding an icon means regenerating the sprite; using a character outside the subset means
  regenerating the font. Neither fails loudly at build time by default — a missing glyph renders as
  a fallback or a box — so wave 2's build must make both failures visible.
- Subsetting must account for text the UI does not control: page titles, URLs, and the user's own
  note text can contain any character. The subset covers the UI's own strings, and the font stack
  must degrade to a system font for everything else rather than showing boxes.
- Bundle size grows by the WOFF2 file and the sprite, against the budget
  [ADR-0008](0008-preact-for-extension-ui-astro-for-marketing.md) already puts pressure on.
- The prototypes' CDN links are therefore **not** portable as written, and porting a prototype
  includes rewriting its asset references. This is one of the concrete ways the bundle is a source
  rather than a drop-in.

## Alternatives considered

**Load fonts from Google Fonts as the prototypes do.** Rejected: it discloses the user's browsing to
a third party from inside an overlay whose whole justification is that it does not do that. The CSP
would block it anyway, but the privacy reason is the one that would still apply if the CSP did not.

**System fonts only, no bundled font.** Rejected, though it is the cheapest option and remains a
reasonable fallback: the design system's type choices carry real identity, and matching the design
bundle's rendering is what makes the visual baselines in wave 3 meaningful. The system stack stays
as the fallback for out-of-subset text.

**Icon font instead of an SVG sprite.** Rejected: icon fonts are worse across the board here — they
inherit text-rendering quirks, they need careful accessibility handling, and they cannot carry
multi-colour or per-path styling. The sprite also lets the build include only what is used.

**Bundle the full Lucide set rather than generating a sprite.** Rejected: it is thousands of icons
for the dozen the UI uses, in a bundle that is injected into third-party pages.
