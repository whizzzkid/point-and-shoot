/// <reference lib="dom" />

/**
 * Loads the real built `dist/chrome/` extension into Chromium via Playwright and asserts it is a
 * working extension, not just a plausible-looking directory: the service worker boots, the content
 * script executes on an ordinary page, nothing logs a console or page error, and a vendored font and
 * the icon sprite resolve through the extension's own `web_accessible_resources` URLs.
 *
 * Named `.spec.ts`, not `.test.ts`, so `deno task test`/`ci`'s default glob skips it — this suite
 * needs a real built `dist/chrome/` and a real browser, so it runs on its own slower tier via
 * `deno task e2e:smoke`, per the three-tier testing split in `docs/plans/README.md`.
 *
 * Playwright cannot load extensions in Firefox, so this covers Chromium only; a `web-ext` smoke
 * check (W2.12) is Firefox's equivalent gate.
 *
 * Run with `deno task build && deno task e2e:smoke`.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { chromium } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";

const EXTENSION_DIR = fromFileUrl(new URL("../../dist/chrome/", import.meta.url));

/** Written only on failure — CI uploads this directory so a red run ships a replayable trace. */
const TRACE_PATH = fromFileUrl(
  new URL("../../playwright-report/e2e-smoke-trace.zip", import.meta.url),
);

/** One vendored font, arbitrarily chosen — proves `web_accessible_resources` covers the font set. */
const FONT_RESOURCE = "src/shared/design/fonts/inter-400.woff2";
const ICON_SPRITE_RESOURCE = "src/shared/design/icons.svg";

Deno.test("built chrome extension - boots and executes without error", async () => {
  let missingDist = false;
  try {
    await Deno.stat(new URL("manifest.json", `file://${EXTENSION_DIR}`));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    missingDist = true;
  }
  assert(!missingDist, `dist/chrome/ not found — run \`deno task build\` first (${EXTENSION_DIR})`);

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const fixture = startFixtureServer();

  try {
    const serviceWorker = context.serviceWorkers()[0] ??
      await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const extensionId = new URL(serviceWorker.url()).host;
    assert(extensionId.length > 0, "expected the extension's service worker to expose an id");

    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`${page.url()}: ${error.message}`));

    await page.goto(`${fixture.base}/index.html`, { waitUntil: "load" });

    // ADR-0002's guarantee, asserted rather than trusted: with no static `content_scripts` entry,
    // an ordinary page load must leave no trace of the extension. A regression here would be a
    // manifest that silently reacquired standing access to every page.
    const readyBeforeGesture = await page.evaluate(() =>
      document.documentElement.dataset.pointAndShootContentReady
    );
    assertEquals(readyBeforeGesture, undefined, "content script ran without a user gesture");

    // Playwright exposes no way to click an extension's toolbar action, so the real gesture path
    // (`action.onClicked` → `scripting.executeScript`) cannot be driven from here; wave 3's
    // interaction tests cover it. What this does check is the half that can go wrong silently: the
    // *built* content bundle executes cleanly on a real page and sets its boot signal.
    await page.addScriptTag({ path: `${EXTENSION_DIR}content/content.js` });
    const contentReady = await page.evaluate(() =>
      document.documentElement.dataset.pointAndShootContentReady
    );
    assertEquals(contentReady, "true", "content script did not set its boot signal");

    // Injected twice by design — a second gesture on the same tab re-runs the file, and the guard in
    // `src/content/index.ts` is what keeps that from double-initialising wave 3's overlay.
    await page.addScriptTag({ path: `${EXTENSION_DIR}content/content.js` });
    assertEquals(
      await page.evaluate(() => document.documentElement.dataset.pointAndShootContentReady),
      "true",
      "re-injection clobbered the boot signal",
    );

    assertEquals(consoleErrors, [], "expected zero console/page errors during load");

    for (const resource of [FONT_RESOURCE, ICON_SPRITE_RESOURCE]) {
      const status = await page.evaluate(async (url) => {
        const response = await fetch(url);
        return response.status;
      }, `chrome-extension://${extensionId}/${resource}`);
      assertEquals(status, 200, `expected ${resource} to resolve through web_accessible_resources`);
    }
    await context.tracing.stop();
  } catch (error) {
    await Deno.mkdir(fromFileUrl(new URL("../../playwright-report/", import.meta.url)), {
      recursive: true,
    });
    await context.tracing.stop({ path: TRACE_PATH });
    throw error;
  } finally {
    await fixture.close();
    await context.close();
  }
});
