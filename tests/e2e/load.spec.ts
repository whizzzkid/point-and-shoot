/// <reference lib="dom" />

/**
 * Loads the real built `dist/chrome/` extension into Chromium via Playwright and asserts it is a
 * working extension, not just a plausible-looking directory: the service worker boots, the content
 * script executes on an ordinary page, nothing logs a console or page error, every exposed asset
 * resolves through a dynamic `web_accessible_resources` URL, and the stable URL form is rejected.
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

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { chromium } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";

const EXTENSION_DIR = fromFileUrl(new URL("../../dist/chrome/", import.meta.url));

/** Written only on failure — CI uploads this directory so a red run ships a replayable trace. */
const TRACE_PATH = fromFileUrl(
  new URL("../../playwright-report/e2e-smoke-trace.zip", import.meta.url),
);

/** Every file currently exposed through the manifest's two web-accessible resource patterns. */
const WEB_ACCESSIBLE_RESOURCES = [
  "src/shared/design/fonts/space-grotesk-400.woff2",
  "src/shared/design/fonts/space-grotesk-500.woff2",
  "src/shared/design/fonts/space-grotesk-600.woff2",
  "src/shared/design/fonts/space-grotesk-700.woff2",
  "src/shared/design/fonts/inter-400.woff2",
  "src/shared/design/fonts/inter-500.woff2",
  "src/shared/design/fonts/inter-600.woff2",
  "src/shared/design/fonts/inter-700.woff2",
  "src/shared/design/fonts/jetbrains-mono-400.woff2",
  "src/shared/design/fonts/jetbrains-mono-500.woff2",
  "src/shared/design/fonts/jetbrains-mono-600.woff2",
  "src/shared/design/icons.svg",
] as const;

Deno.test("built chrome extension - boots and executes without error", async () => {
  let missingDist = false;
  try {
    await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    missingDist = true;
  }
  assert(!missingDist, `dist/chrome/ not found — run \`deno task build\` first (${EXTENSION_DIR})`);

  // The empty `userDataDir` is Playwright's documented request for a throwaway profile directory,
  // not a path that falls back to the cwd — so no profile state leaks between runs.
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

    for (const resource of WEB_ACCESSIBLE_RESOURCES) {
      const staticUrl = `chrome-extension://${extensionId}/${resource}`;
      const dynamicUrl = await serviceWorker.evaluate((resourcePath) => {
        const extensionGlobal = globalThis as unknown as {
          readonly chrome: { readonly runtime: { getURL(path: string): string } };
        };
        return extensionGlobal.chrome.runtime.getURL(resourcePath);
      }, resource);
      assertNotEquals(
        new URL(dynamicUrl).host,
        extensionId,
        `expected ${resource} to use a session-scoped extension id`,
      );

      const staticStatus = await page.evaluate(async (url) => {
        try {
          return (await fetch(url)).status;
        } catch {
          return null;
        }
      }, staticUrl);
      assertNotEquals(staticStatus, 200, `expected the stable URL for ${resource} to be rejected`);

      const dynamicStatus = await page.evaluate(
        async (url) => (await fetch(url)).status,
        dynamicUrl,
      );
      assertEquals(
        dynamicStatus,
        200,
        `expected ${resource} to resolve through its dynamic web-accessible URL`,
      );
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
