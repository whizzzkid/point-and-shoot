# ADR-0010 — Theme the overlay by sampling backdrop luminance, with a user override

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

The overlay sits on top of an arbitrary page, inside a closed shadow root
([ADR-0006](0006-closed-shadow-dom-for-injected-ui.md)). Two ordinary approaches to theming both
fail here.

Inheriting the page's theme is impossible: the closed shadow boundary blocks inheritance, and in any
case most pages do not expose their theme in a readable form — there is no reliable "is this page
dark" signal to read.

Using `prefers-color-scheme` is possible but wrong, because it reports the _user's OS preference_,
not the _page's appearance_. A user with dark mode enabled at the OS level browsing a page that is
white regardless would get a dark toolbar over a white page. That is legible, but it is the case a
fixed theme already handles badly, so nothing is gained.

And a fixed theme in either direction is bad half the time: a dark toolbar on a bright page and a
light toolbar on a dark page both fight the content they sit on, which matters more than usual
because the toolbar's neighbours end up in the screenshot the user keeps.

What can actually be measured is what is behind the toolbar right now.

## Decision

Choose the overlay's theme by sampling the luminance of the page area behind the toolbar and picking
the variant that contrasts with it. Provide an options override that force-pins dark or light, which
disables sampling entirely.

## Consequences

- The overlay is legible on both bright and dark pages without the user configuring anything.
- **Visual output becomes page-dependent, which makes it non-deterministic for tests.** This is the
  significant cost and it is not hypothetical: the same code screenshotted against two pages
  produces two different toolbars. Therefore **tests must always force a theme via the override** —
  never sample — and the override exists partly for this reason rather than purely as a user
  preference. The visual baselines are invalid if any of them was captured with sampling active.
- The fixtures must cover both poles, which is why `tests/fixtures/app/dark.html` and `light.html`
  exist and why each contains a patch of the opposite luminance: a sampler that reads the whole page
  rather than the region behind the toolbar gets the patch case wrong, and only a fixture built for
  it catches that.
- Sampling costs a read of rendered pixels behind the toolbar, and it must be re-evaluated when the
  toolbar moves or the page scrolls, on a path where jank is visible. The sample must be cheap and
  rate-limited.
- A page whose backdrop is mid-luminance, or split light and dark under the toolbar, has no right
  answer. The behaviour must be defined and stable — pick a threshold, apply hysteresis so the theme
  does not flicker across it — rather than left to emerge.
- The override is a settings surface that must persist and apply before first paint, or the user
  sees a flash of the sampled theme before their forced one.

## Alternatives considered

**Fixed dark theme.** Rejected: it reads badly on bright pages, which are most pages, and the
toolbar appears next to the captured content in screenshots.

**`prefers-color-scheme`.** Rejected: it reports the user's OS preference rather than the page's
appearance, so it produces exactly the mismatch a fixed theme produces, just less predictably.

**Inherit the host page's theme.** Rejected: not possible across a closed shadow root, and pages do
not reliably declare a theme to inherit.

**High-contrast neutral theme designed to work on any backdrop.** Rejected, though it is the one
option that would keep tests deterministic for free: making it legible on every backdrop drives it
toward heavy borders and opaque scrims, which is visually louder than the design system allows and
still sits poorly on mid-tone pages.
