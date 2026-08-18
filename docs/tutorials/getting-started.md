# Get started with Point and Shoot

This walkthrough builds Point and Shoot from source, loads it in Chrome or Firefox, captures notes
across multiple pages, and hands the export to a local coding agent.

## Build the extension

Install [Git](https://git-scm.com/) and [mise](https://mise.jdx.dev/), then run:

```bash
git clone https://github.com/whizzzkid/point-and-shoot.git
cd point-and-shoot
mise install
mise exec -- deno task build
```

The command writes unpacked builds to `dist/chrome/` and `dist/firefox/`.

## Load the unpacked build

### Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose `dist/chrome/`.
4. Pin Point and Shoot if you want its action and note-count badge to remain visible.

When source changes, rerun the build and select **Reload** on the extension card.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json`.

The add-on is temporary and disappears when Firefox exits. Repeat these steps after restarting the
browser.

## Start a session

Open a normal `http://` or `https://` page, then select the Point and Shoot browser toolbar icon.
One gesture does all of the following:

- opens the notes side panel or Firefox sidebar;
- starts a session named from the active tab title and local creation time, such as
  `Checkout-2026-08-04-09-05-06`;
- injects the capture overlay into the current tab; and
- changes the action tooltip to **Point and Shoot — Pause session (0 notes)**, with a `0` badge.

If the badge shows `!`, the current page is restricted and no session was created. Move to an
ordinary web page and try again.

## Capture the first note

The **Select** tool is active when the overlay opens.

1. Move over the page to preview the element Point and Shoot will capture.
2. Select one element, or drag a box around a visible region.
3. In the composer, describe the broken behavior and intended result, then select **Save note**.
   Select **Save without note** to keep an empty body, or **Cancel** to discard the pending capture.
4. Wait for the note count in the floating toolbar and browser badge to increase.
5. In the side panel, select **Edit** if the saved note needs another change.

An empty note body is valid, but a specific problem statement gives an agent much better direction.
The screenshot, URL, selectors, computed styles, and capture metadata are stored only after either
save action succeeds.

Keyboard users can tab to a page element and press `Enter` while the selector is active. `Escape`
exits the picker from its current state without ending the durable session.

## Capture across pages

Navigate to another page while the session remains active. Use the default shortcut,
`Command+Shift+P` on macOS or `Ctrl+Shift+P` elsewhere, to toggle the overlay on that page. Capture
and edit another note.

The shortcut is bound to the same browser action as the toolbar icon, so it pauses a running session
and resumes a paused one. Neither ends the session. See
[manage a Point and Shoot session](sessions.md) for the full lifecycle.

The side panel groups notes by page. You can edit, delete, reorder, and choose whether each note's
query string is included in an export.

The generated session name is a starting point. Select **Edit session name** in the side panel to
replace it at any time.

## Review and export

1. Select **Compile plan** in the side panel.
2. Include or exclude individual notes and read the generated Markdown preview.
3. Review the selected evidence and generated prompt.
4. Read the outbound-data disclosure beside the export actions.
5. Select one of the prompt actions:
   - **Copy prompt** puts the image-free Markdown preview on the clipboard.
   - **Download prompt** saves that same preview as a standalone `.md` file.
   - **Download bundle** saves the complete ZIP with canonical JSON and screenshots.

The ZIP contains:

- `session.json`, the canonical validated record;
- `plan.md`, the selected notes and relative screenshot links; and
- `shots/note-NN.webp`, one screenshot per selected note.

An export with no included notes is disabled. A size warning is advisory; you may export as-is,
exclude notes, or lower screenshot quality or maximum dimensions in the options page.

## Hand the bundle to a local agent

Extract the ZIP somewhere outside the source repository. Start your local coding agent in the
repository that owns the page you captured, then give it this instruction:

> Read `plan.md` in the Point and Shoot export. Use `session.json` as the canonical evidence and
> resolve every relative image link under `shots/`. Implement the requested fixes, then verify them
> against the captured pages.

Keep the extracted ZIP directory intact; moving only its `plan.md` leaves its screenshot links
dangling. The standalone prompt download contains no screenshot links.

## End the session

Selecting **Compile plan** already ended it: the session received an end time and the action badge
cleared. The side panel stays on the completed session so it can still be renamed, edited, or
exported again. The next toolbar click starts a fresh session.

Selecting the toolbar icon pauses a running session rather than ending it, so the overlay can be
dismissed without giving up the session. See [manage a Point and Shoot session](sessions.md) for
pause, resume, and the rest of the lifecycle.

## Understand what leaves the device

Point and Shoot stores and exports screenshots, full page URLs subject to each note's query-string
setting, DOM text, selectors, computed styles, and surrounding capture metadata. Point and Shoot
does not upload this data.

Sending the ZIP to a hosted agent does send the included evidence off the machine. Authenticated
pages may contain private account data even when sensitive query parameters are stripped. Review the
selected notes and screenshots before handing the bundle to any service.

Continue with [troubleshooting and known limits](troubleshooting.md) if a page or target cannot be
captured.
