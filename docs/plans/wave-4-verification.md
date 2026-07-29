# Wave 4 — Verification and release

**Read [`README.md`](README.md) in this folder first.** Wave 4 assumes
[wave 3](wave-3-ui-and-capture.md) is complete.

- **Status:** blocked on Wave 3's component-gallery exit criterion
- **Goal:** prove the thing works, on both browsers, for keyboard and screen-reader users, and
  package it for install.

Wave 4 items are almost entirely **parallel-safe** — they touch disjoint test and packaging files.
W4.6 (CI) depends on the jobs it wires up; W4.8 (PR) depends on everything.

---

## W4.1 — Full-flow E2E suite

- [ ] `tests/e2e/` — SHA: _pending_

**parallel-safe.**

Expand beyond wave 2's smoke and wave 3's per-item checks into the flows a user actually performs:

- Multi-note, multi-page session: capture on `index.html`, navigate to `dark.html`, capture again,
  confirm both notes are in one session, export, and validate the bundle.
- Session lifecycle: start, resume after a browser restart (the store must survive it), end, and
  start a fresh one.
- Every fixture page as a capture target, including the flagged-unreachable cases.
- Sad paths: capture denied without a gesture, IndexedDB quota exceeded, a restricted page, a note
  with an empty body, an export with zero notes.
- Export validation: parse the emitted JSON against the W2.8 validator, and assert every Markdown
  image reference resolves to a file in the zip. A prompt bundle with dangling image links is the
  failure the user would only find inside their agent.

Force a theme in every visual assertion (ADR 0010). Upload traces on failure.

**Commit:** `test(e2e): add full-flow multi-page session suite`

---

## W4.2 — Visual regression

- [ ] `tests/visual/` + baselines — SHA: _pending_

**parallel-safe.**

Screenshot each surface — gallery, toolbar overlay, notes panel, plan view, popup, options — in
**both forced themes** at a fixed viewport, and compare against committed baselines with a small
pixel tolerance for font rendering.

Two things this must get right or it becomes noise everyone ignores: baselines are generated on the
**same platform CI uses** (font rendering differs across OSes, so a macOS-generated baseline will
fail on Linux CI forever), and a diff failure uploads the actual, expected, and diff images as
artifacts so review doesn't require reproducing locally.

Document how to intentionally update a baseline, and require the updated image in the PR diff so a
visual change is always visible in review.

**Commit:** `test(visual): add cross-surface visual regression with dual-theme baselines`

---

## W4.3 — Firefox smoke check

- [ ] `tests/firefox/` + `deno task smoke:firefox` — SHA: _pending_

**parallel-safe.**

Per ADR 0007, Playwright cannot load extensions in Firefox. Use `npm:web-ext@10.5.0` to run
`dist/firefox` in a temporary Firefox profile and drive a Marionette/WebDriver session to assert:
the event page boots (Firefox MV3 uses an event page, not a service worker); the content script
injects on activation; the sidebar opens via `sidebar_action`; one capture succeeds and produces a
valid note; and the vendored fonts and icon sprite resolve through Firefox's extension URL scheme.

That last one matters because `web_accessible_resources` and the `moz-extension://` origin behave
differently from Chrome's, and it's the most likely place the Firefox build silently differs.

Be explicit in the test file's header comment about what this tier does **not** cover, so nobody
later mistakes it for E2E parity.

**Commit:** `test(firefox): add web-ext smoke check for the firefox build`

---

## W4.4 — Accessibility checks

- [ ] `tests/a11y/` — SHA: _pending_

**parallel-safe.**

This is a tool for reporting UI/UX bugs; shipping it with UI/UX bugs of its own is not acceptable.

- Automated axe scan of every extension page and the injected overlay, failing on serious and
  critical violations.
- Keyboard-only traversal of the entire flow — activate, pick, annotate, review, export — with no
  mouse events at all. Assert focus is always visible and never lost, and that Escape exits the
  picker from any state.
- Focus management: Dialog traps focus and restores it to the trigger on close; the overlay doesn't
  steal focus from the host page on mount, which would break the page the user is inspecting.
- Contrast: assert the picker highlight and toolbar meet WCAG AA against both the `dark.html` and
  `light.html` fixtures. This is the concrete test for the ADR-0010 theming decision.
- `prefers-reduced-motion` disables every transition.

**Commit:** `test(a11y): add axe, keyboard, focus, and contrast checks`

---

## W4.5 — README and tutorial docs

- [ ] `README.md`, `docs/tutorials/` — SHA: _pending_

**parallel-safe.**

Rewrite the repo `README.md`: what it is, a screenshot or short clip of the real flow, install from
source for Chrome and Firefox, the keyboard shortcut, and how to feed an export to a local agent.

`docs/tutorials/`: a getting-started walkthrough, a page on using the extension as a Playwright
companion in local dev (per Playwright's Chrome-extensions guide, which the original brief named),
and a troubleshooting page covering the known limits — closed shadow roots, cross-origin iframes,
restricted pages, and viewport-clamped regions. Those limits are already known; documenting them up
front is cheaper than fielding them as bugs.

Add a short **"what an export contains"** section: screenshots of whatever was captured, full page
URLs, and DOM text — and the reminder that handing the bundle to a hosted agent sends all of it off
the machine. Users annotate authenticated pages; the tool should say so once, plainly, rather than
leaving it to be discovered. This pairs with the export-time disclosure in W3.7 and the ADR recorded
there.

Verify every command in the docs by running it. A README command that doesn't work is worse than no
README.

**Commit:** `docs: rewrite readme and add tutorials for install, playwright, and limits`

---

## W4.6 — CI completion

- [ ] `.github/workflows/ci.yml` — SHA: _pending_

**Depends on:** W4.1–W4.4.

Add `e2e-full`, `visual`, `smoke-firefox`, and `a11y` jobs. Cache both browser downloads keyed on
pinned versions. Upload traces, visual diffs, and axe reports as artifacts on failure.

Keep total wall-clock reasonable by running jobs in parallel rather than chaining them, and by
keeping `deno task ci` (the fast gate) separate from the browser tiers. If the suite gets slow
enough that people start skipping it, that's a correctness problem, not a convenience one.

Extend the branch-protection required-check list (W1.11) with the new jobs in the same PR. A job
that CI runs but protection does not require is advisory — it can go red and the PR still merges,
which is exactly the failure mode this wave exists to close.

**Verify:** `gh run watch --exit-status` green with every job present. Deliberately break one
assertion and confirm the right job fails and uploads its artifact — a CI job nobody has seen fail
is unproven. Confirm with `gh api repos/{owner}/{repo}/branches/main/protection` that the
required-check list now names every job in the workflow.

**Commit:** `ci: add full e2e, visual, firefox smoke, and a11y jobs`

---

## W4.7 — Release packaging

- [ ] `build/release.ts`, `.github/workflows/release.yml` — SHA: _pending_

**parallel-safe.**

`deno task build:release` already emits both zips (W2.3). Add:

- A version-consistency check: the version in `build/manifest.ts` must match the git tag being
  released, failing loudly on mismatch.
- A pre-flight validating each zip: required manifest keys present, no remote URLs anywhere in the
  bundle, no sourcemaps, no `dist/` path leakage, and a reported total package size.
- `release.yml` triggered on tag push: build, validate, and attach both zips to a GitHub release
  with generated notes.

No store submission automation in v1 — Chrome Web Store and AMO both need account credentials and a
review flow, and that's a deliberate follow-up rather than something to half-wire now.

**Commit:** `ci: add release packaging with manifest validation`

---

## W4.8 — Pull request

- [ ] PR opened — record the number here

**Depends on:** W4.1–W4.7, CI green.

Body must include: what wave 4 proves; a checklist with commit SHAs; **screenshots of every surface
in both themes** from the W4.2 baselines, embedded with `?raw=1` blob URLs; the final package sizes
for both browsers; a Verification section mapping every claim to a command actually run; and a
Limitations section stating plainly what remains unverified — Firefox is smoke-tested rather than
E2E-tested, Safari is unbuilt, framework hints are verified only against the specific framework
versions you tested, and scroll-and-stitch capture is not implemented.

**After it merges:** run the post-merge plan sync — [rule 7](README.md#rules-for-working-any-wave).
Tick every W4.x item with its merged SHA, flip this wave's **Status** to complete, and update the
**tracking issue** to state that v1 is verified and wave 5 is the only wave left. Wave 5 is deferred
rather than blocked — say which, so nobody reads the empty checklist as work in flight.

---

## Wave 4 exit criteria

- W4.1–W4.7 checked with real commit SHAs.
- Full E2E suite green on Chromium; Firefox smoke green; a11y checks green with no serious or
  critical axe violations.
- Visual baselines committed, generated on the same platform as CI.
- Both release zips validate with no remote URLs and no sourcemaps.
- Every command in the README and tutorials has been run and works.
- One deliberate failure per new CI job has been observed, proving the jobs can fail.
