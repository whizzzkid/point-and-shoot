# Build Point and Shoot from source

Most people should install Point and Shoot from a browser store, which
[get started](getting-started.md) covers. Build from source when you want to run unreleased changes,
develop the extension, or drive it from an automated browser.

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

## Next steps

- [Get started](getting-started.md) for the capture-to-handoff walkthrough, which continues from a
  loaded extension.
- [Use Point and Shoot with Playwright](playwright-companion.md) to load this unpacked build beside
  a local app.
- [Troubleshoot and understand known limits](troubleshooting.md) when the unpacked build will not
  load.
