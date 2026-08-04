/// <reference lib="dom" />

/**
 * Captures every shipped extension surface in both forced themes for review.
 *
 * The script drives the built Chromium extension rather than static replicas: extension pages load
 * their production bundles and fonts, while the injected toolbar runs inside its production closed
 * shadow root. Theme attributes are forced only at the rendered surface root so the image matrix is
 * deterministic.
 *
 * @module
 */

import { fromFileUrl } from "@std/path";
import { type BrowserContext, chromium, type Locator, type Page, type Worker } from "playwright";
import { type PlacementRect, placeToolbar } from "../src/content/toolbar/placement.ts";
import { EXPORT_FIXTURE_SESSION } from "../src/shared/serialize/fixture.ts";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../src/shared/settings.ts";
import { startFixtureServer } from "./fixtures/app/server.ts";

const EXTENSION_DIR = fromFileUrl(new URL("../dist/chrome/", import.meta.url));
const DEFAULT_OUTPUT_DIRECTORY = "docs/assets/wave-3";
const SERVICE_WORKER_TIMEOUT_MILLISECONDS = 10_000;
const SURFACE_READY_TIMEOUT_MILLISECONDS = 5_000;

/** Extension surfaces that must appear in the visual review set. */
export const WAVE_3_SHOT_SURFACES = [
  "toolbar",
  "notes",
  "plan",
  "popup",
  "options",
] as const;

/** Forced design-system themes captured for every extension surface. */
export const WAVE_3_SHOT_THEMES = ["dark", "light"] as const;

/** One visible extension surface captured by this script. */
export type Wave3ShotSurface = typeof WAVE_3_SHOT_SURFACES[number];

/** One deterministic theme captured by this script. */
export type Wave3ShotTheme = typeof WAVE_3_SHOT_THEMES[number];

/**
 * Returns the output path for one surface/theme pair.
 *
 * @param surface Extension surface being captured.
 * @param theme Forced theme used by the capture.
 * @param outputDirectory Directory receiving the PNG.
 * @returns Path for the surface and theme PNG.
 */
export function shotOutputPath(
  surface: Wave3ShotSurface,
  theme: Wave3ShotTheme,
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
): string {
  return `${outputDirectory}/${surface}-${theme}.png`;
}

interface ToolbarBoundsEvidence {
  readonly case: string;
  readonly overlap: false;
  readonly selection: PlacementRect;
  readonly toolbar: PlacementRect;
}

function overlaps(first: PlacementRect, second: PlacementRect): boolean {
  return first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top;
}

async function writeToolbarBoundsEvidence(outputDirectory: string): Promise<void> {
  const viewport = { height: 600, left: 0, top: 0, width: 1_000 };
  const selections = [
    { case: "top-left", selection: { height: 140, left: 40, top: 80, width: 200 } },
    { case: "top-right", selection: { height: 140, left: 760, top: 80, width: 200 } },
    { case: "bottom-left", selection: { height: 140, left: 40, top: 430, width: 320 } },
    { case: "bottom-right", selection: { height: 140, left: 640, top: 430, width: 320 } },
  ] as const;
  const evidence: ToolbarBoundsEvidence[] = selections.map(({ case: name, selection }) => {
    const toolbar = placeToolbar({
      collisionGap: 12,
      edgeGap: 24,
      selection,
      toolbar: { height: 56, width: 480 },
      viewport,
    }).rect;
    if (overlaps(toolbar, selection)) {
      throw new Error(`toolbar overlaps the ${name} selection`);
    }
    return { case: name, overlap: false, selection, toolbar };
  });
  await Deno.writeTextFile(
    `${outputDirectory}/toolbar-bounds.json`,
    `${JSON.stringify({ evidence, viewport }, null, 2)}\n`,
  );
}

async function launchExtension(): Promise<{
  readonly context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
  readonly extensionId: string;
  readonly serviceWorker: Worker;
}> {
  const context = await chromium.launchPersistentContext("", {
    acceptDownloads: true,
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  const serviceWorker = context.serviceWorkers()[0] ??
    await context.waitForEvent("serviceworker", {
      timeout: SERVICE_WORKER_TIMEOUT_MILLISECONDS,
    });
  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
  };
}

async function seedExtension(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async ({ session, settings }) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly storage: {
          readonly local: {
            set(items: Record<string, unknown>): Promise<void>;
          };
        };
      };
    };
    await extensionGlobal.chrome.storage.local.set({
      activeSessionId: session.id,
      displaySessionId: session.id,
      settings,
    });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("point-and-shoot", 1);
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
    session: EXPORT_FIXTURE_SESSION,
    settings: DEFAULT_SETTINGS,
  });
}

async function setTheme(serviceWorker: Worker, theme: Wave3ShotTheme): Promise<void> {
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, themeOverride: theme };
  await serviceWorker.evaluate(async (nextSettings) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly storage: {
          readonly local: {
            set(items: Record<string, unknown>): Promise<void>;
          };
        };
      };
    };
    await extensionGlobal.chrome.storage.local.set({ settings: nextSettings });
  }, settings);
}

async function installHeadlessSidePanelStub(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(() => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly sidePanel?: {
          readonly open?: (options: { readonly tabId: number }) => Promise<void>;
        };
      };
    };
    if (typeof extensionGlobal.chrome.sidePanel?.open === "function") return;
    // Playwright's headless Chromium omits sidePanel even though the shipped browser exposes it.
    Object.defineProperty(extensionGlobal.chrome, "sidePanel", {
      configurable: true,
      value: {
        open(_options: { readonly tabId: number }): Promise<void> {
          return Promise.resolve();
        },
      },
    });
  });
}

async function triggerExtensionAction(
  context: BrowserContext,
  page: Page,
  extensionId: string,
): Promise<void> {
  await page.bringToFront();
  const browser = context.browser();
  if (browser === null) throw new Error("persistent Chromium context has no browser");
  const browserSession = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await browserSession.send("Target.getTargets", {
      filter: [{ type: "tab" }],
    });
    const tabTarget = targetInfos.find((target) =>
      target.type === "tab" && target.url === page.url()
    );
    if (tabTarget === undefined) {
      throw new Error(`toolbar screenshot has no tab target for ${page.url()}`);
    }
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: tabTarget.targetId,
    });
  } finally {
    await browserSession.detach();
  }
}

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function captureLocator(
  locator: Locator,
  page: Page,
  outputPath: string,
): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: SURFACE_READY_TIMEOUT_MILLISECONDS });
  await waitForFonts(page);
  await locator.screenshot({ animations: "disabled", path: outputPath });
  console.log(`wrote ${outputPath}`);
}

async function prepareToolbarFixture(page: Page, fixtureBase: string, theme: Wave3ShotTheme) {
  await page.setViewportSize({ height: 800, width: 1_280 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${fixtureBase}/${theme}.html`);
  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".panel");
    const button = panel?.querySelector<HTMLElement>("button");
    if (panel === null || panel === undefined || button === null || button === undefined) {
      throw new Error("toolbar screenshot fixture has no panel button");
    }
    Object.assign(panel.style, {
      bottom: "24px",
      left: "50%",
      margin: "0",
      position: "fixed",
      transform: "translateX(-50%)",
      width: "420px",
    });
    Object.assign(button.style, {
      display: "block",
      marginInline: "auto",
      width: "220px",
    });
  });
}

async function captureToolbar(
  context: BrowserContext,
  extensionId: string,
  serviceWorker: Worker,
  fixtureBase: string,
  theme: Wave3ShotTheme,
  outputDirectory: string,
): Promise<void> {
  await setTheme(serviceWorker, theme);
  const page = await context.newPage();
  try {
    await prepareToolbarFixture(page, fixtureBase, theme);
    await triggerExtensionAction(context, page, extensionId);
    await page.waitForFunction(
      (expectedTheme) =>
        document.querySelector("[data-point-and-shoot-host]")?.getAttribute("data-theme") ===
          expectedTheme,
      theme,
      { timeout: SURFACE_READY_TIMEOUT_MILLISECONDS },
    );

    const target = page.locator(`button[data-testid="${theme}-action"]`);
    const targetBox = await target.boundingBox();
    if (targetBox === null) throw new Error("toolbar screenshot target has no layout box");
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
    );
    await page.waitForTimeout(100);
    await waitForFonts(page);
    const outputPath = shotOutputPath("toolbar", theme, outputDirectory);
    await page.screenshot({ animations: "disabled", path: outputPath });
    console.log(`wrote ${outputPath}`);
  } finally {
    await page.close();
  }
}

async function capturePopup(
  context: BrowserContext,
  extensionId: string,
  theme: Wave3ShotTheme,
  outputDirectory: string,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ height: 560, width: 420 });
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    await page.locator(".ps-popup").evaluate((element, selectedTheme) => {
      (element as HTMLElement).dataset.theme = selectedTheme;
    }, theme);
    await captureLocator(
      page.locator(".ps-popup"),
      page,
      shotOutputPath("popup", theme, outputDirectory),
    );
  } finally {
    await page.close();
  }
}

async function captureNotesAndPlan(
  context: BrowserContext,
  extensionId: string,
  theme: Wave3ShotTheme,
  outputDirectory: string,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ height: 820, width: 1_100 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    await page.locator(".ps-notes-panel").evaluate((element, selectedTheme) => {
      (element as HTMLElement).dataset.theme = selectedTheme;
    }, theme);
    await captureLocator(
      page.locator(".ps-notes-panel"),
      page,
      shotOutputPath("notes", theme, outputDirectory),
    );

    await page.getByRole("button", { name: "Compile plan" }).click();
    await page.getByRole("heading", { name: "Compile plan" }).waitFor();
    await page.locator(".ps-plan-view").evaluate((element, selectedTheme) => {
      (element as HTMLElement).dataset.theme = selectedTheme;
    }, theme);
    await captureLocator(
      page.locator(".ps-plan-view"),
      page,
      shotOutputPath("plan", theme, outputDirectory),
    );
  } finally {
    await page.close();
  }
}

async function captureOptions(
  context: BrowserContext,
  extensionId: string,
  serviceWorker: Worker,
  theme: Wave3ShotTheme,
  outputDirectory: string,
): Promise<void> {
  await setTheme(serviceWorker, theme);
  const page = await context.newPage();
  try {
    await page.setViewportSize({ height: 760, width: 1_100 });
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    await page.waitForFunction(
      (expectedTheme) =>
        document.querySelector(".ps-options")?.getAttribute("data-theme") === expectedTheme,
      theme,
      { timeout: SURFACE_READY_TIMEOUT_MILLISECONDS },
    );
    await captureLocator(
      page.locator(".ps-options"),
      page,
      shotOutputPath("options", theme, outputDirectory),
    );
  } finally {
    await page.close();
  }
}

function trackRuntimeErrors(
  context: BrowserContext,
  serviceWorker: Worker,
  runtimeErrors: string[],
): void {
  context.on("page", (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => runtimeErrors.push(`${page.url()}: ${error.message}`));
  });
  serviceWorker.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`service worker: ${message.text()}`);
  });
}

async function captureThemeShots(
  fixtureBase: string,
  outputDirectory: string,
  runtimeErrors: string[],
  theme: Wave3ShotTheme,
): Promise<void> {
  const { context, extensionId, serviceWorker } = await launchExtension();
  trackRuntimeErrors(context, serviceWorker, runtimeErrors);
  try {
    await installHeadlessSidePanelStub(serviceWorker);
    await captureToolbar(
      context,
      extensionId,
      serviceWorker,
      fixtureBase,
      theme,
      outputDirectory,
    );
    await seedExtension(serviceWorker);
    await captureNotesAndPlan(context, extensionId, theme, outputDirectory);
    await capturePopup(context, extensionId, theme, outputDirectory);
    await captureOptions(context, extensionId, serviceWorker, theme, outputDirectory);
  } finally {
    await context.close();
  }
}

/**
 * Captures every extension surface into one output directory.
 *
 * @param outputDirectory Directory receiving PNGs and toolbar placement evidence.
 * @returns Nothing after the browser and fixture server close.
 */
export async function captureWave3Shots(
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
): Promise<void> {
  await Deno.stat(`${EXTENSION_DIR}/manifest.json`);
  await Deno.mkdir(outputDirectory, { recursive: true });
  await writeToolbarBoundsEvidence(outputDirectory);
  const fixture = startFixtureServer();
  const runtimeErrors: string[] = [];
  try {
    for (const theme of WAVE_3_SHOT_THEMES) {
      // A fresh profile prevents the second toolbar action from ending the first theme's session.
      await captureThemeShots(fixture.base, outputDirectory, runtimeErrors, theme);
    }
    if (runtimeErrors.length > 0) {
      throw new Error(`Extension screenshot surfaces logged errors:\n${runtimeErrors.join("\n")}`);
    }
  } finally {
    await fixture.close();
  }
}

if (import.meta.main) {
  await captureWave3Shots();
}
