/// <reference lib="dom" />

import { fromFileUrl } from "@std/path";
import { Buffer } from "node:buffer";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page, type Worker } from "playwright";
import { PNG } from "pngjs";
import type { Session } from "../src/shared/schema.ts";
import { EXPORT_FIXTURE_SESSION } from "../src/shared/serialize/fixture.ts";
import { DEFAULT_SETTINGS } from "../src/shared/settings.ts";
import { startFixtureServer } from "../tests/fixtures/app/server.ts";

const SERVICE_WORKER_TIMEOUT_MILLISECONDS = 10_000;
const SURFACE_READY_TIMEOUT_MILLISECONDS = 5_000;
const STORE_VIEWPORT = { height: 800, width: 1_280 } as const;

interface PreviewHarness {
  show(selectors: {
    readonly cssPath: readonly string[];
    readonly reachable: true;
    readonly tagClasses: string;
    readonly testIds: readonly {
      readonly attribute: "data-testid";
      readonly value: string;
    }[];
    readonly textSnippet: string;
    readonly xpath: readonly string[];
  }): boolean;
}

/**
 * Removes every query and fragment from the representative session used in public screenshots.
 *
 * @param session - Representative session whose private-shaped URL data must not be published.
 * @returns A new session whose note URLs are safe to display in store artwork.
 */
export function storeScreenshotSession(session: Session): Session {
  return {
    ...session,
    notes: session.notes.map((note) => {
      const pageUrl = new URL(note.pageUrl);
      pageUrl.search = "";
      pageUrl.hash = "";
      return { ...note, pageUrl: pageUrl.href };
    }),
  };
}

async function extensionWorker(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): Promise<Worker> {
  return context.serviceWorkers()[0] ??
    await context.waitForEvent("serviceworker", {
      timeout: SERVICE_WORKER_TIMEOUT_MILLISECONDS,
    });
}

async function seedExtension(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async ({ session, settings }) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly storage: {
          readonly local: { set(items: Record<string, unknown>): Promise<void> };
        };
      };
    };
    await extensionGlobal.chrome.storage.local.set({
      activeSessionId: session.id,
      displaySessionId: session.id,
      settings,
    });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      // Track the DB version in `src/shared/store.ts:DB_VERSION`; store-screenshot generation
      // runs after the extension boots and upgrades its store, so opening at a stale version
      // throws `VersionError`.
      const request = indexedDB.open("point-and-shoot", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("sessions")) {
          request.result.createObjectStore("sessions", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("sessions", "readwrite");
        transaction.objectStore("sessions").put(session);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, {
    session: storeScreenshotSession(EXPORT_FIXTURE_SESSION),
    settings: { ...DEFAULT_SETTINGS, themeOverride: "dark" },
  });
}

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => await document.fonts.ready);
}

function encodeOpaquePng(bytes: Uint8Array): Uint8Array {
  const image = PNG.sync.read(Buffer.from(bytes));
  for (let offset = 3; offset < image.data.length; offset += 4) image.data[offset] = 255;
  return PNG.sync.write(image, {
    colorType: 2,
    inputColorType: 6,
    inputHasAlpha: true,
  });
}

async function capturePage(page: Page, output: URL): Promise<void> {
  await waitForFonts(page);
  const bytes = await page.screenshot({ animations: "disabled", type: "png" });
  await Deno.writeFile(output, encodeOpaquePng(bytes));
}

async function captureNotesAndPlan(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  extensionId: string,
  outputDirectory: URL,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(STORE_VIEWPORT);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    await page.locator(".ps-notes-panel").evaluate((element) => {
      (element as HTMLElement).dataset.theme = "dark";
    });
    await capturePage(page, new URL("02-notes-review.png", outputDirectory));

    await page.getByRole("button", { name: "Compile plan" }).click();
    await page.getByRole("heading", { name: "Compile plan" }).waitFor();
    await page.locator(".ps-plan-view").evaluate((element) => {
      (element as HTMLElement).dataset.theme = "dark";
    });
    await capturePage(page, new URL("04-compiled-plan.png", outputDirectory));
  } finally {
    await page.close();
  }
}

async function captureOptions(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  extensionId: string,
  outputDirectory: URL,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(STORE_VIEWPORT);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    await page.waitForFunction(
      () => document.querySelector(".ps-options")?.getAttribute("data-theme") === "dark",
      undefined,
      { timeout: SURFACE_READY_TIMEOUT_MILLISECONDS },
    );
    const privacyTab = page.getByRole("tab", { name: "Export & privacy" });
    await privacyTab.click();
    await page.getByRole("heading", { exact: true, name: "Export & privacy" }).waitFor();
    await page.getByRole("switch", { name: "Strip sensitive query strings" }).waitFor();
    if (await privacyTab.getAttribute("aria-selected") !== "true") {
      throw new Error("Export & privacy tab was not active before store capture");
    }
    await capturePage(page, new URL("05-privacy-settings.png", outputDirectory));
  } finally {
    await page.close();
  }
}

async function bundlePreviewHarness(root: URL): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(root),
      bundle: true,
      entryPoints: [fromFileUrl(new URL("tests/e2e/note-preview-harness.ts", root))],
      format: "iife",
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("note preview harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

async function captureNotePreview(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  fixtureBase: string,
  root: URL,
  outputDirectory: URL,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(STORE_VIEWPORT);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${fixtureBase}/index.html`);
    await page.addScriptTag({ content: await bundlePreviewHarness(root) });
    const didShow = await page.evaluate(() => {
      const harness = (globalThis as unknown as { pointShootNotePreviewTest: PreviewHarness })
        .pointShootNotePreviewTest;
      return harness.show({
        cssPath: ["[data-testid='save-note']"],
        reachable: true,
        tagClasses: "button",
        testIds: [{ attribute: "data-testid", value: "save-note" }],
        textSnippet: "Save note",
        xpath: ["/html/body/section[1]/div/button[1]"],
      });
    });
    if (!didShow) throw new Error("note preview fixture did not resolve its target");
    await capturePage(page, new URL("03-note-hover-highlight.png", outputDirectory));
  } finally {
    await page.close();
  }
}

/**
 * Captures the five ordered product screenshots used by both browser-store listings.
 *
 * @param root - Repository root containing the built extension and fixture sources.
 * @param outputDirectory - Directory receiving exact 1280x800 opaque PNG screenshots.
 * @returns Nothing after the browser profile and fixture server close.
 * @throws {Error} When the extension, fixture, or preview surface fails to load.
 */
export async function captureStoreScreenshots(root: URL, outputDirectory: URL): Promise<void> {
  const extensionDirectory = fromFileUrl(new URL("dist/chrome/", root));
  await Deno.stat(new URL("dist/chrome/manifest.json", root));
  const fixture = startFixtureServer();
  try {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionDirectory}`,
        `--load-extension=${extensionDirectory}`,
      ],
    });
    try {
      const serviceWorker = await extensionWorker(context);
      await seedExtension(serviceWorker);
      const extensionId = new URL(serviceWorker.url()).host;
      const toolbarBytes = await Deno.readFile(
        new URL("tests/visual/baselines/toolbar-dark.png", root),
      );
      await Deno.writeFile(
        new URL("01-capture-toolbar.png", outputDirectory),
        encodeOpaquePng(toolbarBytes),
      );
      await captureNotesAndPlan(context, extensionId, outputDirectory);
      await captureNotePreview(context, fixture.base, root, outputDirectory);
      await captureOptions(context, extensionId, outputDirectory);
    } finally {
      await context.close();
    }
  } finally {
    await fixture.close();
  }
}
