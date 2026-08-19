# Troubleshoot Point and Shoot

This guide distinguishes expected browser boundaries from failures that need investigation.

## The extension does not load

This section covers unpacked builds; see
[build Point and Shoot from source](building-from-source.md) for the build and load steps. Rebuild
both targets:

```bash
mise exec -- deno task build
```

In Chrome, load the directory `dist/chrome/`, not its parent and not a ZIP. Open
`chrome://extensions`, inspect the extension card for errors, and select **Reload** after
rebuilding.

In Firefox, open `about:debugging#/runtime/this-firefox` and load `dist/firefox/manifest.json`.
Temporary add-ons disappear when Firefox exits.

## The toolbar badge shows an exclamation mark

The page cannot grant `activeTab`. Browser-owned pages such as `chrome://` and `about:` documents,
extension stores, PDF viewers owned by the browser, and some policy-managed pages reject content
injection.

Point and Shoot does not create a session on a restricted page. Move to a normal `http://` or
`https://` page and select the toolbar action again. An earlier completed session may remain visible
in the side panel.

## A closed shadow-root control cannot be selected

A closed shadow root deliberately hides its internal DOM from page and extension scripts. Point and
Shoot can capture the visible host element but cannot generate trustworthy selectors or DOM evidence
for an internal control.

Capture the host and describe the internal target in the note. If you own the component, reproduce
the issue in a development build with an open shadow root when internal selector evidence is
required.

## A cross-origin iframe cannot be inspected

An iframe from another origin is a browser security boundary. The parent page's `activeTab` grant
does not allow Point and Shoot to read the child document.

Capture the iframe boundary and add the child page URL or reproduction steps to the note. If you
control the framed page, open it directly in a tab and capture it there.

Same-origin iframe content is capturable. A failure there should be treated as a bug rather than the
known cross-origin limit.

## A tall or off-screen region is marked clipped

Screenshots are limited to the current visible viewport. A selection that extends beyond it is
clamped, and the note records `truncated: true`. The notes panel and plan view show the clipped
state.

Scroll-and-stitch capture is not implemented. Capture multiple viewport-sized notes or zoom out
before selecting the region.

## The shortcut paused the session instead of hiding the overlay

This is expected. The default `Command+Shift+P` on macOS or `Ctrl+Shift+P` elsewhere fires the same
browser action as the toolbar icon, so it follows the same session path: it starts a session when
none is active, pauses a running one, and resumes a paused one. Press it again to resume.

You do not need it to regain the overlay after navigating — a running session remounts the overlay
on each page you load.

Neither the shortcut nor the toolbar icon ends a session. Only **Compile plan** in the side panel
completes one. See [configure options](options.md#shortcuts) for the full behavior.

Open the options page to see the browser's current assignment. **Manage browser shortcuts** opens
`chrome://extensions/shortcuts` in Chrome or `about:addons` in Firefox.

## The note has no description

Capture stores the screenshot and page evidence before the note body is edited. Empty note text is
valid and appears in the plan as an explicit missing description.

Open the note in the side panel, select **Edit**, add the intended behavior, and save it before
exporting.

## Export is disabled

The plan view disables every export action when no notes are included and temporarily disables the
export actions while one runs. Malformed screenshot data can disable the bundle download and
surfaces an error, but bundle size never disables copy or download.

Include at least one note. If bundle creation reports malformed screenshot data, capture the
affected note again before downloading the bundle.

## Query parameters are missing from the export

Sensitive query parameters are stripped by default when their names contain `token`, `key`,
`secret`, `auth`, or `session`. The local stored note still retains the full recorded URL.

Use the per-note export setting in the notes panel only when the query is safe and necessary for the
agent. A fragment is retained when the query is stripped.

## Framework hints are absent

Framework component hints are off by default because they probe non-standard properties in the page
world. Enable them in options for a development page you trust.

The v1 probes are verified against React 18.3.1 development builds and Vue 3.5.40 development
builds. Production builds, newer internal layouts, closed shadow roots, and cross-origin frames may
return no hint. Selector and style evidence still capture normally.

## The overlay looks stale after rebuilding

An open tab can retain the previously injected content realm. Reload the extension, refresh the
page, and invoke Point and Shoot again. A Playwright persistent context must be closed and
relaunched after rebuilding.

## Before sharing an export

The ZIP can contain screenshots, full page URLs subject to each note's query setting, DOM text,
selectors, computed styles, and capture metadata. Point and Shoot keeps the bundle local, but a
hosted agent receives whatever you upload.

Review authenticated-page screenshots, exclude unnecessary notes, and inspect `plan.md` before the
bundle leaves the machine.
