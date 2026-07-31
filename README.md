# Point and Shoot

Point and Shoot turns UI and UX bugs into evidence a coding agent can act on. Start a session from
the browser toolbar, select an element or drag around a region, add a note, and export the session
as an agent-ready ZIP.

![A Point and Shoot session in the notes panel](tests/visual/baselines/notes-dark.png)

The extension records the selected screenshot, page URL, DOM text, selector fallbacks, computed
styles, and capture metadata. It uses `activeTab`, so it reads a page only after you invoke it
there. Chrome and Firefox builds come from the same source.

## Build from source

You need [Git](https://git-scm.com/) and [mise](https://mise.jdx.dev/). The project installs exact
tool versions from `mise.toml`.

```bash
git clone https://github.com/whizzzkid/point-and-shoot.git
cd point-and-shoot
mise install
mise exec -- deno task build
```

The build writes unpacked extensions to:

- `dist/chrome/` for Chrome 116 or newer; and
- `dist/firefox/` for Firefox 109 or newer.

### Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/chrome/`.

Reload the extension from this page after each rebuild.

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json`.

Firefox removes a temporary add-on when the browser exits. Load the manifest again after restarting
Firefox.

## Capture a session

1. Open a normal web page and select the Point and Shoot toolbar icon. The side panel opens, a new
   session starts, and the capture overlay appears.
2. With **Select** active, select an element or drag around a visible region. Point and Shoot saves
   the screenshot and evidence as a note.
3. In the side panel, select **Edit**, describe what should change, and save the note.
4. Repeat on as many pages as needed. The toolbar badge shows the current note count; its tooltip
   says that the next toolbar click will end the session.
5. Select **Compile plan**, review the included notes, then select **Download for agent**.
6. Select the browser toolbar icon again to end the session. The completed session remains available
   in the side panel for editing and export.

The default shortcut is `Command+Shift+P` on macOS and `Ctrl+Shift+P` elsewhere. It toggles the
capture overlay without ending the active session. The options page shows the browser's current
assignment and links to the browser-owned shortcut settings.

See the [getting-started tutorial](docs/tutorials/getting-started.md) for the complete walkthrough.

## Give the export to a local agent

Extract the downloaded ZIP, open your coding agent in the target repository, and point it at
`plan.md`. Ask it to use `session.json` as the canonical record and the files under `shots/` as the
visual evidence. Keep the extracted bundle available until the work is verified so the agent can
follow every relative screenshot link.

### What an export contains

- `session.json` — the canonical session, including page URLs, DOM-derived evidence, selector
  bundles, computed-style digests, capture metadata, and inline screenshots.
- `plan.md` — the selected notes in an agent-readable projection with relative screenshot links.
- `shots/` — one WebP screenshot for every included note.

Point and Shoot does not upload the bundle. If you hand it to a hosted agent, all included
screenshots, URLs, DOM text, selectors, and computed styles may leave your machine. This matters
especially for authenticated pages. Review the plan, exclude notes you do not want to share, and
check each note's query-string setting before sending it anywhere.

## Known limits

Point and Shoot cannot inspect inside closed shadow roots or cross-origin iframe documents.
Restricted browser pages cannot grant `activeTab`. Region screenshots are clamped to the visible
viewport; scroll-and-stitch capture is not implemented.

See [troubleshooting and known limits](docs/tutorials/troubleshooting.md) for expected behavior and
workarounds.

## Development

The repository is Deno-first. Run the fast local gate with:

```bash
mise exec -- deno task ci
```

The [Playwright companion guide](docs/tutorials/playwright-companion.md) shows how to load the
unpacked extension beside a local app. Architecture, behavior specs, and the delivery plan live in
the [documentation index](docs/README.md).
