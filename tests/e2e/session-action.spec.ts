/// <reference lib="dom" />

/**
 * Drives the real built Chromium extension through the browser toolbar action. This focused tier
 * proves the product-level session toggle and badge/tooltip contract before W4.1 expands the same
 * flow into multi-page capture and export coverage.
 *
 * Run with `deno task build && deno task e2e:session`.
 *
 * @module
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { type BrowserContext, chromium, type Page, type Worker } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";

const EXTENSION_DIR = fromFileUrl(new URL("../../dist/chrome/", import.meta.url));
const TRACE_DIRECTORY = fromFileUrl(new URL("../../playwright-report/", import.meta.url));
const LIFECYCLE_TRACE_PATH = fromFileUrl(
  new URL("../../playwright-report/session-action-lifecycle-trace.zip", import.meta.url),
);
const RESTRICTED_TRACE_PATH = fromFileUrl(
  new URL("../../playwright-report/session-action-restricted-trace.zip", import.meta.url),
);
const POLL_INTERVAL_MILLISECONDS = 50;
const STATE_TIMEOUT_MILLISECONDS = 5_000;

interface ActionState {
  readonly badgeText: string;
  readonly title: string;
}

interface StoredSessionState {
  readonly activeId: string | undefined;
  readonly displayId: string | undefined;
  readonly endedAt: string | null | undefined;
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
    if (tabTarget === undefined) throw new Error(`no browser tab target found for ${page.url()}`);
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: tabTarget.targetId,
    });
  } finally {
    await browserSession.detach();
  }
}

async function activeTabId(serviceWorker: Worker): Promise<number> {
  return await serviceWorker.evaluate(async () => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly tabs: {
          query(details: {
            readonly active: boolean;
            readonly currentWindow: boolean;
          }): Promise<readonly { readonly id?: number }[]>;
        };
      };
    };
    const tab = (await extensionGlobal.chrome.tabs.query({
      active: true,
      currentWindow: true,
    }))[0];
    if (tab?.id === undefined) throw new Error("active tab has no id");
    return tab.id;
  });
}

async function waitForActionState(
  serviceWorker: Worker,
  tabId: number,
  expected: ActionState,
): Promise<ActionState> {
  return await serviceWorker.evaluate(async ({ expected, pollInterval, tabId, timeout }) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly action: {
          getBadgeText(details: { readonly tabId: number }): Promise<string>;
          getTitle(details: { readonly tabId: number }): Promise<string>;
        };
      };
    };
    const deadline = Date.now() + timeout;
    const observed = { badgeText: "", title: "" };
    do {
      [observed.badgeText, observed.title] = await Promise.all([
        extensionGlobal.chrome.action.getBadgeText({ tabId }),
        extensionGlobal.chrome.action.getTitle({ tabId }),
      ]);
      if (
        observed.badgeText === expected.badgeText &&
        observed.title === expected.title
      ) {
        return observed;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } while (Date.now() < deadline);
    return observed;
  }, {
    expected,
    pollInterval: POLL_INTERVAL_MILLISECONDS,
    tabId,
    timeout: STATE_TIMEOUT_MILLISECONDS,
  });
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
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
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
    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html`);
    const tabId = await activeTabId(serviceWorker);

    await triggerExtensionAction(context, page, extensionId);
    await page.waitForFunction(
      () => document.querySelectorAll("[data-point-and-shoot-host]").length === 1,
    );
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
    await page.waitForFunction(
      () => document.querySelectorAll("[data-point-and-shoot-host]").length === 0,
    );
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
    await page.waitForFunction(
      () => document.querySelectorAll("[data-point-and-shoot-host]").length === 1,
    );
    const fresh = await readStoredSession(serviceWorker);
    assertNotEquals(fresh.activeId, started.activeId);
    assertEquals(fresh.activeId, fresh.displayId);
    assertEquals(fresh.endedAt, null);
    await context.tracing.stop();
  } catch (error) {
    await Deno.mkdir(TRACE_DIRECTORY, { recursive: true });
    await context.tracing.stop({ path: LIFECYCLE_TRACE_PATH });
    throw error;
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("browser toolbar refuses to start a session on a restricted page", async () => {
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const serviceWorker = context.serviceWorkers()[0] ??
    await context.waitForEvent("serviceworker", { timeout: 10_000 });
  const extensionId = new URL(serviceWorker.url()).host;

  try {
    const page = await context.newPage();
    await page.goto("chrome://extensions/");
    const tabId = await activeTabId(serviceWorker);

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
    await context.tracing.stop();
  } catch (error) {
    await Deno.mkdir(TRACE_DIRECTORY, { recursive: true });
    await context.tracing.stop({ path: RESTRICTED_TRACE_PATH });
    throw error;
  } finally {
    await context.close();
  }
});
