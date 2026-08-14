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
  readonly pausedAt: string | null | undefined;
  readonly name: string | undefined;
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
    if (selectedId === undefined) {
      return {
        activeId,
        displayId,
        endedAt: undefined,
        pausedAt: undefined,
        name: undefined,
      };
    }
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
      const pausedAt = typeof record === "object" && record !== null && "pausedAt" in record
        ? (record as { readonly pausedAt: string | null | undefined }).pausedAt
        : undefined;
      const name = typeof record === "object" && record !== null && "name" in record
        ? (record as { readonly name: string }).name
        : undefined;
      return { activeId, displayId, endedAt, pausedAt, name };
    } finally {
      database.close();
    }
  }, sessionId);
}

Deno.test("browser toolbar starts, counts, pauses, and resumes the same session", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();
  const fixture = startFixtureServer();

  try {
    await runWithFailureTrace(context, "session-action-lifecycle", async () => {
      const page = await context.newPage();
      await page.goto(`${fixture.base}/light.html`);
      const tabId = await tabIdForPage(context, page);

      // First click: start.
      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 1);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "0",
          title: "Point and Shoot — Pause session (0 notes)",
        }),
        { badgeText: "0", title: "Point and Shoot — Pause session (0 notes)" },
      );
      const started = await readStoredSession(serviceWorker);
      assertEquals(started.activeId, started.displayId);
      assertEquals(started.endedAt, null);

      // Capture a note so the badge shows a note count.
      await page.getByTestId("light-action").click();
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "1",
          title: "Point and Shoot — Pause session (1 note)",
        }),
        { badgeText: "1", title: "Point and Shoot — Pause session (1 note)" },
      );

      // Second click: pause — badge and session pointer must survive; only pausedAt flips.
      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 0);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "1",
          title: "Point and Shoot — Resume session (1 note)",
        }),
        { badgeText: "1", title: "Point and Shoot — Resume session (1 note)" },
      );
      const paused = await readStoredSession(serviceWorker, started.activeId);
      assertEquals(paused.activeId, started.activeId);
      assertEquals(paused.displayId, started.activeId);
      assertEquals(paused.endedAt, null);
      assertNotEquals(paused.pausedAt, null);
      assertNotEquals(paused.pausedAt, undefined);

      // Third click: resume — same session id, overlay back, pausedAt cleared.
      await triggerExtensionAction(context, page, extensionId);
      await waitForHostCount(page, 1);
      const resumed = await readStoredSession(serviceWorker, started.activeId);
      assertEquals(resumed.activeId, started.activeId);
      assertEquals(resumed.endedAt, null);
      assertEquals(resumed.pausedAt, null);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "1",
          title: "Point and Shoot — Pause session (1 note)",
        }),
        { badgeText: "1", title: "Point and Shoot — Pause session (1 note)" },
      );
    });
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("browser toolbar names a fresh session from the active tab and current time", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();
  const fixture = startFixtureServer();

  try {
    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html`);

    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);
    const started = await readStoredSession(serviceWorker);

    assertEquals(
      /^Fixture: light page-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(started.name ?? ""),
      true,
    );
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
        pausedAt: undefined,
        name: undefined,
      });
    });
  } finally {
    await context.close();
  }
});
