# Use Point and Shoot with Playwright

Point and Shoot can run beside a local app in a headed Playwright browser. This is useful when a
developer wants to pause an automated setup at the exact state that needs annotation, capture the
problem, and return an evidence bundle to the same repository.

This guide is verified with Playwright 1.62.0 and follows Playwright's
[Chrome extensions guide](https://playwright.dev/docs/chrome-extensions).

## Build Point and Shoot

Playwright side-loads an unpacked directory, so this guide needs a local build rather than a store
install. See [build Point and Shoot from source](building-from-source.md) for the full walkthrough.
From the Point and Shoot checkout, run:

```bash
mise exec -- deno task build
```

The Playwright project will load the unpacked `dist/chrome/` directory.

## Launch the extension in a persistent context

Extensions require a persistent Chromium context. Google Chrome and Microsoft Edge no longer accept
the command-line flags Playwright needs for side-loading, so use the `chromium` channel bundled with
Playwright.

Add a fixture like this to the application under test:

```ts
import { type BrowserContext, chromium, test as base } from "@playwright/test";
import { resolve } from "node:path";

const extensionPath = resolve(
  process.env.POINT_SHOOT_EXTENSION ?? "../point-and-shoot/dist/chrome",
);

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      channel: "chromium",
      headless: false,
    });

    await use(context);
    await context.close();
  },
});
```

Use an absolute `POINT_SHOOT_EXTENSION` path when the two repositories are not siblings.

## Pause at the state to annotate

Import the fixture into a focused development spec:

```ts
import { test } from "./point-and-shoot-fixture";

test("annotate the local checkout flow", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/checkout");
  await page.getByRole("button", { name: "Open order summary" }).click();
  await page.pause();
});
```

Run that spec with the application's normal headed Playwright command. When the inspector pauses:

1. Select the Point and Shoot extension action in the bundled Chromium window.
2. Capture and annotate the broken state.
3. Export the bundle into the application repository or another local working directory.
4. Resume or stop the Playwright test.

The persistent profile lasts for that launched context, so the session survives page navigation and
reloads during the paused run. Closing the context removes the temporary profile when Playwright
uses an empty user-data directory.

## Keep automation and inspection separate

Point and Shoot uses `activeTab`, which must come from an explicit browser action or shortcut.
Playwright should prepare and navigate the application state; the developer should invoke the
extension in the headed browser. This preserves the extension's no-standing-host-access guarantee.

Do not use this Chromium setup as evidence of Firefox parity. Playwright cannot load extensions in
Firefox; Point and Shoot uses a separate `web-ext` and Marionette smoke tier for Gecko.

## Rebuild after source changes

Close the persistent context, rebuild Point and Shoot, then start a fresh Playwright context:

```bash
mise exec -- deno task build
```

An already-running context keeps the extension code it loaded at startup.
