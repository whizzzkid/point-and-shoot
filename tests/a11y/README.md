# Accessibility verification

Run the accessibility tier with:

```bash
deno task a11y
```

The task builds the Chrome extension, then verifies:

- axe-core scans of the component gallery, popup, options page, notes panel, plan view, and injected
  toolbar;
- a keyboard-only capture, annotation, review, and ZIP-export flow with no physical pointer events;
- dialog focus trapping and trigger restoration;
- host-page focus preservation when the overlay mounts;
- WCAG AA contrast for the picker highlight and toolbar in both forced themes; and
- removal of every shared transition and animation under `prefers-reduced-motion: reduce`.

## Failure artifacts

Serious and critical axe failures write JSON reports under `playwright-report/a11y/`. CI uploads
that directory when the accessibility job fails.

## Closed shadow-root coverage

The production overlay uses a closed shadow root, which axe-core cannot traverse from page script.
The harness therefore clones the rendered production toolbar DOM into an open audit shadow root for
axe semantic rules. Contrast, reduced motion, Escape behavior, and focus preservation still inspect
the real production overlay inside its closed root.

Chromium automation cannot dispatch a browser-level extension shortcut reliably. The keyboard flow
uses Chromium DevTools' extension-action gesture to grant `activeTab`, then uses keyboard input
only. The `_execute_action` command fires `action.onClicked` directly, granting `activeTab` for both
toolbar click and keyboard shortcut.
