/// <reference lib="dom" />

/**
 * Runs axe-core against every extension-owned page surface.
 *
 * Named `.spec.ts` so the fast unit gate does not launch Chromium. Run through `deno task a11y`.
 *
 * @module
 */

import type { Worker } from "playwright";
import { startGalleryServer } from "../../src/ui/gallery/server.ts";
import { EXPORT_FIXTURE_SESSION } from "../../src/shared/serialize/fixture.ts";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../../src/shared/settings.ts";
import { launchExtension, openExtensionPage } from "../e2e/extension-fixture.ts";
import { scanPageWithAxe } from "./axe.ts";

async function seedExtension(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(
    async ({ session, settings, settingsKey }) => {
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
        [settingsKey]: settings,
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
    },
    {
      session: EXPORT_FIXTURE_SESSION,
      settings: { ...DEFAULT_SETTINGS, themeOverride: "light" as const },
      settingsKey: SETTINGS_STORAGE_KEY,
    },
  );
}

Deno.test("axe reports no serious or critical violations in the component gallery", async () => {
  const gallery = await startGalleryServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(gallery.url);
    await page.getByRole("heading", { name: "Point and Shoot component gallery" }).waitFor();
    await scanPageWithAxe(page, "component gallery", "gallery");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("axe reports no serious or critical violations in every extension page", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    await seedExtension(serviceWorker);

    const popup = await openExtensionPage(context, extensionId, "popup/popup.html");
    await popup.getByRole("heading", { name: EXPORT_FIXTURE_SESSION.name }).waitFor();
    await scanPageWithAxe(popup, "popup", "popup");

    const options = await openExtensionPage(context, extensionId, "options/options.html");
    await options.getByRole("heading", { name: "Settings" }).waitFor();
    await scanPageWithAxe(options, "options", "options");

    const sidePanel = await openExtensionPage(context, extensionId, "sidepanel/sidepanel.html");
    await sidePanel.getByRole("heading", { name: EXPORT_FIXTURE_SESSION.name }).waitFor();
    await scanPageWithAxe(sidePanel, "notes panel", "notes-panel");

    await sidePanel.getByRole("button", { name: "Compile plan" }).click();
    await sidePanel.getByRole("heading", { name: "Compile plan" }).waitFor();
    await scanPageWithAxe(sidePanel, "plan view", "plan-view");
  } finally {
    await context.close();
  }
});
