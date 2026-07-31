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
- starts an `Untitled session`;
- injects the capture overlay into the current tab; and
- changes the action tooltip to **End session**, with a `0` badge.

If the badge shows `!`, the current page is restricted and no session was created. Move to an
ordinary web page and try again.

## Capture the first note

The **Select** tool is active when the overlay opens.

1. Move over the page to preview the element Point and Shoot will capture.
2. Select one element, or drag a box around a visible region.
3. Wait for the note count in the floating toolbar and browser badge to increase.
4. In the side panel, find the new note and select **Edit**.
5. Describe the broken behavior and the intended result, then select **Save changes**.

An empty note body is valid, but a specific problem statement gives an agent much better direction.
The screenshot, URL, selectors, computed styles, and capture metadata were already stored when the
selection completed.

Keyboard users can tab to a page element and press `Enter` while the selector is active. `Escape`
exits the picker from its current state without ending the durable session.

## Capture across pages

Navigate to another page while the session remains active. Use the default shortcut,
`Command+Shift+P` on macOS or `Ctrl+Shift+P` elsewhere, to toggle the overlay on that page. Capture
and edit another note.

The shortcut controls only the overlay. It does not end the session. The browser toolbar icon owns
the session lifecycle and ends the current session when selected again.

The side panel groups notes by page. You can edit, delete, reorder, and choose whether each note's
query string is included in an export.

## Review and export

1. Select **Compile plan** in the side panel.
2. Include or exclude individual notes and read the generated Markdown preview.
3. Confirm the selected ZIP is within the configured size budget.
4. Read the outbound-data disclosure beside the export actions.
5. Select **Download for agent**.

The ZIP contains:

- `session.json`, the canonical validated record;
- `plan.md`, the selected notes and relative screenshot links; and
- `shots/note-NN.webp`, one screenshot per selected note.

An export with no included notes is disabled. If the bundle exceeds its configured limit, exclude
notes or lower screenshot quality or maximum dimensions in the options page.

## Hand the bundle to a local agent

Extract the ZIP somewhere outside the source repository. Start your local coding agent in the
repository that owns the page you captured, then give it this instruction:

> Read `plan.md` in the Point and Shoot export. Use `session.json` as the canonical evidence and
> resolve every relative image link under `shots/`. Implement the requested fixes, then verify them
> against the captured pages.

Keep the extracted directory intact; moving only `plan.md` leaves its screenshot links dangling.

## End the session

Select the Point and Shoot toolbar icon. The overlay closes, the session receives an end time, and
the action badge clears. The side panel stays on the completed session so it can still be edited or
exported. The next toolbar click starts a fresh session.

## Understand what leaves the device

Point and Shoot stores and exports screenshots, full page URLs subject to each note's query-string
setting, DOM text, selectors, computed styles, and surrounding capture metadata. Point and Shoot
does not upload this data.

Sending the ZIP to a hosted agent does send the included evidence off the machine. Authenticated
pages may contain private account data even when sensitive query parameters are stripped. Review the
selected notes and screenshots before handing the bundle to any service.

Continue with [troubleshooting and known limits](troubleshooting.md) if a page or target cannot be
captured.
