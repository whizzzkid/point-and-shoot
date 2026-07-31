# Nice-to-haves — after the numbered waves

**Read [`README.md`](README.md) in this folder first.**

- **Status:** open, unscheduled — nothing here blocks any wave
- **Goal:** hold the work that is genuinely worth doing but does not belong to a wave, so it stops
  living in merged PR bodies where nobody reads it.

## What belongs here

An item earns a place here when all three hold:

1. It is real work with a real payoff, not a wish.
2. No wave's exit criteria depend on it — shipping v1 without it is fine.
3. It is specific enough that a future session can start on it without re-deriving the problem.

Anything that blocks a wave goes in that wave's plan instead. An item here that later turns out to
block something should be **moved**, not copied — two homes for one task is how the tracking issue
and the plans drift apart.

Unlike the numbered waves, this file has no dependency graph, no exit criteria, and no PR item. Each
entry is independently landable in its own PR. Tick the box and record the SHA when one lands.

---

## N.1 — Make `boot:firefox` runnable locally

- [ ] SHA: _pending_

`deno task boot:firefox` (W2.12) passes in CI and fails on at least one developer machine. The check
drives Firefox through `web-ext run` and reads boot markers off the launched browser's stdout, so it
is sensitive to the exact Firefox/`web-ext` pairing: CI installs a pinned Firefox via
`setup-firefox`, while locally it takes whatever Firefox is on the machine.

`PNS_FIREFOX_BINARY` already exists as an escape hatch, so the fix may be as small as documenting
which Firefox versions work and how to point at one. Diagnose before building anything:

- Capture the local failure mode. It is not currently written down anywhere, which is the actual
  blocker — "fails locally" is not a diagnosis. Run with `--verbose` output kept and compare against
  a passing CI run's log.
- Check whether it fails at launch, at the boot marker, or on `KNOWN_NOISE`. A third startup-warning
  class that the CI runner does not emit would land in `unexpectedErrors` and read as a real
  failure; that is a denylist gap, not a broken check.
- Prefer pinning the Firefox version the task expects over widening the noise filter. The denylist
  exists to filter _Firefox's_ output so that _our_ errors surface — every pattern added to it is
  coverage given up.

Worth doing because a CI-only gate is one nobody runs before pushing, so it fails after the push
rather than before it. Not blocking, because the gate does run.

## N.2 — Deepen Firefox coverage beyond load-and-boot

- [ ] SHA: _pending_

Firefox coverage today is `web-ext lint` plus the W2.12 boot check: the extension loads, the
background script starts, and one `web_accessible_resources` file resolves through
`moz-extension://`. Nothing exercises behaviour. W4.3 adds a behavioural Firefox suite, and
[ADR-0007](../adr/0007-playwright-chromium-plus-web-ext-coverage-split.md) sets the split
deliberately — Playwright cannot load extensions in Firefox, which is the constraint the whole
approach works around.

W4.3 covers one representative Firefox capture through the real toolbar, injected overlay, native
sidebar, and persisted session. It deliberately does not duplicate Chromium's multi-page lifecycle,
export, restricted-page, quota, accessibility, or visual-regression coverage, so those deeper
Firefox behaviours remain beyond v1's smoke tier.

Start from W4.3's Marionette harness rather than standing up a second Firefox stack.

## N.3 — Fixture-page coverage for the selector sad paths

- [ ] SHA: _pending_

`buildSelectorBundle` returns an `UnreachableSelectorBundle` for a closed shadow root interior, a
cross-origin iframe interior, an element from another realm's document, a detached element, and a
non-element node. These are unit-tested, and the unit tests are the reason the paths are known to
work at all.

What is missing is a real-browser case for each: the unit tests construct the conditions, and a
constructed cross-realm node is not the same object a live page hands you. The `tests/fixtures/app/`
server already serves two distinct origins, so the iframe case in particular is cheap from here.

Worth doing because these are the paths where a silent wrong answer is worse than a failure — a
bundle that claims to be reachable and is not produces a selector that resolves to the wrong
element. Not blocking, because the unit coverage is genuine and the sad paths all fail closed.
