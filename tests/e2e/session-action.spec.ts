/// <reference lib="dom" />

/**
 * Drives the real built Chromium extension through the browser toolbar action. This focused tier
 * proves the product-level session toggle and badge/tooltip contract before the full-flow suite expands the same
 * flow into multi-page capture and export coverage.
 *
 * Run with `deno task e2e:session`.
 *
 * @module
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import type { Worker } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";
import {
  launchExtension,
  runWithFailureTrace,
  tabIdForPage,
  triggerExtensionAction,
  waitForActionState,
  waitForHostCount,
} from "./extension-fixture.ts";

interface StoredSessionState {
  readonly activeId: string | undefined;
  readonly displayId: string | undefined;
  readonly endedAt: string | null | undefined;
}

async function readStoredSession(
  serviceWorker: Worker,
  sessionId?: string,
): Promise<StoredSessionState> {
  return await serviceWorker.evaluate(async (requestedSessionId) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly storage: {
          readonly local: {
            get(keys: readonly string[]): Promise<Record<string, unknown>>;
          };
        };
      };
    };
    const stored = await extensionGlobal.chrome.storage.local.get([
      "activeSessionId",
      "displaySessionId",
    ]);
    const activeId = typeof stored.activeSessionId === "string"
      ? stored.activeSessionId
      : undefined;
    const displayId = typeof stored.displaySessionId === "string"
      ? stored.displaySessionId
      : undefined;
    const selectedId = requestedSessionId ?? activeId;
    if (selectedId === undefined) return { activeId, displayId, endedAt: undefined };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("point-and-shoot");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<unknown>((resolve, reject) => {
        const request = database.transaction("sessions", "readonly")
          .objectStore("sessions")
          .get(selectedId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const endedAt = typeof record === "object" && record !== null && "endedAt" in record
        ? (record as { readonly endedAt: string | null }).endedAt
        : undefined;
      return { activeId, displayId, endedAt };
    } finally {
      database.close();
    }
  }, sessionId);
}

Deno.test("browser toolbar starts, counts, ends, and starts a fresh session", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();
  const fixture = startFixtureServer();

  try {
    await runWithFailureTrace(context, "session-action-lifecycle", async () => {
      const page = await context.newPage();
      await page.goto(`${fixture.base}/light.html`);
      const tabId = await tabIdForPage(context, page);

      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 1);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "0",
          title: "Point and Shoot — End session (0 notes)",
        }),
        { badgeText: "0", title: "Point and Shoot — End session (0 notes)" },
      );
      const started = await readStoredSession(serviceWorker);
      assertEquals(started.activeId, started.displayId);
      assertEquals(started.endedAt, null);

      await page.getByTestId("light-action").click();
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "1",
          title: "Point and Shoot — End session (1 note)",
        }),
        { badgeText: "1", title: "Point and Shoot — End session (1 note)" },
      );

      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 0);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "",
          title: "Point and Shoot — Start session",
        }),
        { badgeText: "", title: "Point and Shoot — Start session" },
      );
      const ended = await readStoredSession(serviceWorker, started.activeId);
      assertEquals(ended.activeId, undefined);
      assertEquals(ended.displayId, started.activeId);
      assertNotEquals(ended.endedAt, null);
      assertNotEquals(ended.endedAt, undefined);

      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 1);
      const fresh = await readStoredSession(serviceWorker);
      assertNotEquals(fresh.activeId, started.activeId);
      assertEquals(fresh.activeId, fresh.displayId);
      assertEquals(fresh.endedAt, null);
    });
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("browser toolbar refuses to start a session on a restricted page", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    await runWithFailureTrace(context, "session-action-restricted", async () => {
      const page = await context.newPage();
      await page.goto("chrome://extensions/");
      const tabId = await tabIdForPage(context, page);

      await triggerExtensionAction(context, page, extensionId);

      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "!",
          title: "Point and Shoot — unavailable on this page",
        }),
        { badgeText: "!", title: "Point and Shoot — unavailable on this page" },
      );
      assertEquals(await readStoredSession(serviceWorker), {
        activeId: undefined,
        displayId: undefined,
        endedAt: undefined,
      });
    });
  } finally {
    await context.close();
  }
});
