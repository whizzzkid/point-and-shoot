# Get started with Point and Shoot

This walkthrough installs Point and Shoot from your browser's extension store, captures notes across
multiple pages, and hands the export to a local coding agent.

## Install the extension

Install the published listing for your browser:

- Chrome and other Chromium-based browsers:
  [Point & Shoot on the Chrome Web Store](https://chromewebstore.google.com/detail/point-shoot/efiaamiohjjhhcgeaihgmbajnamhbahb).
- Firefox and other Gecko-based browsers:
  [Point & Shoot on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/point-and-shoot/).

Chrome 116 or newer and Firefox 109 or newer are supported. Safari support is planned separately, so
Safari has no store listing yet.

After installing, pin Point and Shoot if you want its action and note-count badge to remain visible.
The store handles updates for you.

Prefer to build from source? See [build Point and Shoot from source](building-from-source.md) for
the Git and mise walkthrough, including loading an unpacked build in Chrome or Firefox.

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

Navigate to another page while the session remains active. The session keeps running across the
navigation, but the overlay does not, so press the default shortcut — `Command+Shift+P` on macOS or
`Ctrl+Shift+P` elsewhere — **twice** on the new page: once to pause the session, once to resume it
and re-inject the overlay. Then capture and edit another note.

The shortcut is bound to the same browser action as the toolbar icon, so it pauses a running session
and resumes a paused one. Neither ends the session. See
[manage a Point and Shoot session](sessions.md) for the full lifecycle, or
[the Shortcuts section](options.md#shortcuts) for how to change the binding.

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

An export with no included notes is disabled. Excluding notes reduces the current bundle
immediately. Lowering screenshot quality or maximum dimensions in the
[options page](options.md#capture) only affects future captures; existing screenshots keep their
original size until you recapture them. See [compile a plan and export it](exporting.md) for the
full treatment of the compile-plan step, the header and footer prompts, and the bundle format.

## Hand the bundle to a local agent

Extract the ZIP somewhere outside the source repository. Start your local coding agent in the
repository that owns the page you captured, then give it this instruction:

> Read `plan.md` in the Point and Shoot export. Use `session.json` as the canonical evidence and
> resolve every relative image link under `shots/`. Implement the requested fixes, then verify them
> against the captured pages.

Keep the extracted ZIP directory intact; moving only its `plan.md` leaves its screenshot links
dangling. The standalone prompt download contains no screenshot links.

## Pause or end the session

Two different gestures, and it is worth keeping them apart.

Select the Point and Shoot toolbar icon to **pause**. The overlay closes and the tooltip becomes
**Resume session**, but the session stays active and keeps its notes — selecting the icon again
resumes it on the current tab.

**Compile plan** in the side panel is what **ends** a session. It stamps the end time and clears the
action badge, and the side panel stays on the completed session so it can still be edited or
exported. The next toolbar click after that starts a fresh session.

See [manage a Point and Shoot session](sessions.md) for the full lifecycle.

## Understand what leaves the device

Point and Shoot stores and exports screenshots, full page URLs subject to each note's query-string
setting, DOM text, selectors, computed styles, and surrounding capture metadata. Point and Shoot
does not upload this data.

Sending the ZIP to a hosted agent does send the included evidence off the machine. Authenticated
pages may contain private account data even when sensitive query parameters are stripped. Review the
selected notes and screenshots before handing the bundle to any service.

Continue with [troubleshooting and known limits](troubleshooting.md) if a page or target cannot be
captured.
