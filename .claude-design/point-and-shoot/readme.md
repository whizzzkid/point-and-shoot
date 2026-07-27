
# Point & Shoot Design System

## Context

Point & Shoot is a browser extension for reporting and fixing UI/UX bugs in place. Turned on from the browser toolbar (or a keyboard shortcut), it drops a small action bar onto the current page. The user highlights a region of the page and writes a note about what's wrong; the extension captures a screenshot of the region, the full page URL, the XPath of every element inside the highlight, and surrounding DOM/meta context, bundling it all with the note. A page can hold many of these notes. The collected notes are then compiled into a plan prompt for a local coding agent to act on. The extension can also run headless as a Playwright companion for local dev workflows (see [Chrome extensions in Playwright](https://playwright.dev/docs/chrome-extensions)). A planned v2 sends the same plan to a configurable remote host, which pulls the target repo and host to work the fix itself.

This is a from-scratch design system: **no codebase, Figma file, or existing brand assets were attached.** Everything here — palette, type, components, UI kits — was designed for this project based on the product brief above and the following direction from the founder: modern, futuristic, minimalist; classy but industrial-function-over-form. If a codebase or Figma file exists, attach it and this system should be rebuilt/reconciled against it as ground truth.

**Sources referenced:** none (brief only, no repo/Figma links provided).

## Product surfaces covered

- **Toolbar overlay** — the in-page action bar + highlight/annotate flow, injected onto any site
- **Extension popup** — opened from the browser toolbar icon
- **Notes panel** — review list of all notes captured on a page
- **Plan view** — turns collected notes into an agent-ready prompt
- **Options/settings**
- **Marketing/landing site**

## Content fundamentals

- **Voice:** precise and slightly warm — an expert tool that respects your time. Never cutesy, never corporate. Think "senior engineer's internal tool," not "consumer app."
- **Person:** direct address, "you/your" for the user; the product refers to itself by name ("Point & Shoot captured...") rather than "we." No first person ("I").
- **Casing:** sentence case everywhere — buttons, headings, labels, menu items. No title case, no ALL CAPS except tiny eyebrow labels/tags (e.g. section kickers at `--text-2xs` with `--tracking-wider`).
- **Tone examples:**
  - Button: "Send to agent" (not "Let's fix this!")
  - Empty state: "No notes yet. Highlight anything on the page to start one."
  - Confirmation: "Note saved with screenshot, XPath, and DOM context."
  - Error: "Couldn't capture this element — try a different region."
  - Status chip: "3 notes · 1 sent"
- **Length:** short. One sentence for helper text, none for decoration. Prefer a fragment over a full sentence in tight UI ("Screenshot attached" not "A screenshot has been attached to this note").
- **Emoji:** none, ever. Status is carried by color/icon, not emoji.
- **Numbers & technical strings:** show real values (URLs, XPaths, element tags) in mono type, truncated with ellipsis rather than wrapped, always with a way to see the full value (title attr / expand).
- **Errors:** state what happened and the next action, never blame the user.

## Visual foundations

- **Palette:** near-black canvas (`--bg-canvas #0a0b0d`) with a single confident accent blue (`--accent #4f7cff`). Neutrals are a cool blue-gray ramp, not pure gray — everything, including grays, leans slightly cool/blue to feel technical rather than warm/consumer. Color is used sparingly: accent blue marks the one interactive/active thing on screen (the highlight box, the primary button, a focused input ring); everything else stays neutral. Semantic colors (success green, warning amber, danger red) are reserved strictly for status, never decoration.
- **Type:** three families with clear jobs. **Space Grotesk** (display) for headings and anything that needs presence — geometric, slightly technical, distinctive without being decorative. **Inter** (body/UI) for all interface text and copy — neutral and highly legible at small sizes. **JetBrains Mono** for anything literally technical: URLs, XPaths, element tags, keyboard shortcuts, code. This 3-way split is a core brand signal: mono type is what makes the tool feel like it's showing you the *real* underlying page, not a gloss over it.
  - *Font files were not provided; these are Google Fonts substitutes loaded via `tokens/fonts.css`. Flag: if the product has existing licensed fonts, send the files and this system will be updated.*
- **Spacing:** 4px base unit (`--space-1` = 4px through `--space-24` = 96px). Layouts are compact and information-dense — this is a tool for people mid-task, not a landing page with room to breathe. The marketing site is the one place spacing opens up.
- **Backgrounds:** flat and dark, no gradients, no photography, no illustration, no textures or grain. The one exception is a very subtle radial vignette (`--bg-canvas` darkening at the edges) on full-bleed marketing sections, and the accent "glow" (`--glow-accent`) used on the live highlight box and primary CTA hover to suggest something is "live"/scanning.
- **Animation:** minimal and functional only — no bounce, no spring, no decorative motion. Fades and 4–8px slide-ins on `--ease-out`, 120–280ms (`--duration-fast/base/slow`). The highlight box uses a subtle pulsing outline (opacity, not scale) to read as "actively selecting." Nothing animates just for delight.
- **Hover states:** interactive elements lighten one step (accent → `--accent-hover`, surface → `--bg-elevated`) — never darken on hover in the dark theme, since darkening reads as "disabled" against a near-black canvas.
- **Press/active states:** color deepens one step further (`--accent-active`) with no scale/shrink — this is a precision tool, elements shouldn't feel "squishy."
- **Borders:** hairline (1px) `--border-subtle`/`--border-default`/`--border-strong` on cool-gray, used to separate surfaces instead of shadow in most UI (shadow is reserved for floating/overlay elements). Borders, not background-color changes, define most component edges — keeps the flat-black canvas feeling engineered/precise.
- **Corner radii:** small and consistent — `--radius-sm` (4px) for inputs/buttons/tags, `--radius-md`/`--radius-lg` (6–10px) for cards and panels, `--radius-full` only for pills/dots. Nothing is heavily rounded; sharper corners reinforce "industrial tool," not "friendly consumer app."
- **Cards/panels:** `--bg-surface` or `--bg-surface-raised` fill, 1px `--border-subtle` outline, `--radius-lg`, and `--shadow-md` only when floating above page content (popovers, the toolbar itself, dialogs); inline cards (e.g. a note row in a list) use border only, no shadow.
- **Shadow system:** two-tier — `--shadow-sm` for slight separation (list rows, inputs on focus) and `--shadow-md`/`--shadow-lg` for anything that floats above the page (the injected toolbar, popover menus, modals). No inner shadows.
- **Transparency & blur:** used specifically for the injected in-page overlay, since it sits on top of arbitrary third-party page content — the toolbar and highlight scrim use `--bg-overlay` + `--blur-panel` (14px backdrop blur) so it reads as "extension chrome" floating above the page rather than part of it. Not used elsewhere (popup, options, marketing are all opaque).
- **Focus states:** every interactive element gets a visible `--shadow-focus` ring (3px, accent-tinted) — this is a keyboard- and precision-heavy tool (selecting exact elements), so focus visibility is non-negotiable.
- **Imagery color vibe:** cool, desaturated, high-contrast screenshots (the captured page regions themselves are the only "imagery" in the product) — no stock photography, no illustration.
- **Layout rules:** the injected toolbar is a fixed, floating element (bottom-center or top-right of viewport) that must never obstruct the highlighted region; it repositions to stay clear of the active selection.

## Iconography

No icon codebase was provided. The system uses **[Lucide](https://lucide.dev)** (loaded from CDN, `assets/icons.js` wrapper) — a minimal, consistent-stroke (1.5–2px) line-icon set that matches the brand's flat, technical, non-decorative visual language. Stroke icons only (no filled/duotone variants), sized at 16/20/24px, colored via `currentColor` so they inherit text/icon-color tokens. No emoji anywhere in-product. No unicode-glyph icons. *Flag: this is a substitution — if the product has a bespoke icon set, attach it and this section/asset set will be replaced.*

## Index

- `styles.css` — root stylesheet entry (imports everything under `tokens/`)
- `tokens/` — colors, typography, spacing, effects (shadow/motion/blur), fonts, base resets
- `assets/` — icon loader (Lucide), no logo provided (see below)
- `guidelines/` — foundation specimen cards shown in the Design System tab (Colors, Type, Spacing, Brand)
- `SKILL.md` — Claude Code-compatible skill wrapper for this system

### Components (`components/`)

- `core/` — Button, IconButton, Card, Badge, Tag, Icon
- `forms/` — Input, Select, Checkbox, Switch
- `feedback/` — Tooltip, Toast, Dialog
- `navigation/` — Tabs
- `capture/` — CaptureMinimap

**Intentional additions:** no source defined a component inventory (from-scratch brief), so this is the standard set sized to the product's needs — sized down (no Avatar, Accordion, etc. — not used anywhere in the six surfaces) rather than padded out. `CaptureMinimap` is product-specific: every note carries a screenshot, so note lists and generated plans always show the captured region rather than a generic image placeholder.

### UI kits (`ui_kits/`)

- `toolbar-overlay/` — the in-page action bar + highlight/annotate/note flow
- `extension-popup/` — popup opened from the browser toolbar icon
- `notes-panel/` — review list of notes captured on a page
- `plan-view/` — notes → agent prompt
- `options/` — settings page
- `marketing/` — landing site

*No official logo was provided.* `assets/icon.svg` is an original mark designed for this system (viewfinder corner-brackets + center dot, in the accent blue) — used alongside the "Point & Shoot" wordmark. Replace it if the product adopts a real logo.
