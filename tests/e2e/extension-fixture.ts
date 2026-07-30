/// <reference lib="dom" />

/**
 * Shared Playwright fixture for real Chromium extension tests.
 *
 * @module
 */

import { fromFileUrl, join } from "@std/path";
import { type BrowserContext, chromium, type Page, type Worker } from "playwright";

/** Absolute path to the built Chromium extension loaded by every E2E flow. */
export const EXTENSION_DIR = fromFileUrl(new URL("../../dist/chrome/", import.meta.url));

const TRACE_DIRECTORY = fromFileUrl(new URL("../../playwright-report/", import.meta.url));
const POLL_INTERVAL_MILLISECONDS = 25;
const LISTENER_READY_TIMEOUT_MILLISECONDS = 2_500;
const SERVICE_WORKER_TIMEOUT_MILLISECONDS = 10_000;
const STATE_TIMEOUT_MILLISECONDS = 5_000;

/** One launched persistent Chromium context and its real extension worker identity. */
export interface ExtensionLaunch {
  readonly context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
  readonly extensionId: string;
  readonly serviceWorker: Worker;
}

/** Durable session pointers stored outside IndexedDB by the extension. */
export interface SessionPointers {
  readonly activeId: string | undefined;
  readonly displayId: string | undefined;
}

/** Toolbar badge and tooltip state for one browser tab. */
export interface ActionState {
  readonly badgeText: string;
  readonly title: string;
}

/**
 * Launches the real built extension in a persistent Chromium context.
 *
 * @param userDataDir Profile directory. An empty string asks Playwright for a temporary profile.
 * @returns The context, extension id, and listener-ready service worker.
 */
export async function launchExtension(userDataDir = ""): Promise<ExtensionLaunch> {
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    acceptDownloads: true,
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  const serviceWorker = context.serviceWorkers()[0] ??
    await context.waitForEvent("serviceworker", { timeout: SERVICE_WORKER_TIMEOUT_MILLISECONDS });
  const readinessDeadline = Date.now() + LISTENER_READY_TIMEOUT_MILLISECONDS;

  while (Date.now() < readinessDeadline) {
    const listenersReady = await serviceWorker.evaluate(() => {
      const extensionGlobal = globalThis as unknown as {
        readonly chrome: {
          readonly commands: {
            readonly onCommand: { hasListeners(): boolean };
          };
          readonly runtime: {
            readonly onMessage: { hasListeners(): boolean };
          };
        };
      };
      return extensionGlobal.chrome.commands.onCommand.hasListeners() &&
        extensionGlobal.chrome.runtime.onMessage.hasListeners();
    });
    if (listenersReady) {
      return {
        context,
        extensionId: new URL(serviceWorker.url()).host,
        serviceWorker,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MILLISECONDS));
  }

  await context.close();
  throw new Error(
    `extension listeners were not ready within ${LISTENER_READY_TIMEOUT_MILLISECONDS}ms`,
  );
}

/**
 * Triggers the extension toolbar action against a foreground page through Chromium DevTools.
 *
 * @param context Persistent Chromium context owning the tab.
 * @param page Foreground tab receiving the action.
 * @param extensionId Loaded extension id.
 * @returns Nothing after Chromium has dispatched the gesture.
 */
export async function triggerExtensionAction(
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
      throw new Error(
        `no tab target found for ${page.url()}: ${
          JSON.stringify(targetInfos.map(({ targetId, type, url }) => ({
            targetId,
            type,
            url,
          })))
        }`,
      );
    }
    await browserSession.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: tabTarget.targetId,
    });
  } finally {
    await browserSession.detach();
  }
}

/**
 * Opens an extension-owned page in the persistent Chromium context.
 *
 * @param context Chromium context containing the extension.
 * @param extensionId Loaded extension id.
 * @param path Path below the extension origin.
 * @returns The loaded extension page.
 */
export async function openExtensionPage(
  context: BrowserContext,
  extensionId: string,
  path: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${path}`);
  return page;
}

/**
 * Waits until the inspected page contains the expected number of extension hosts.
 *
 * @param page Inspected fixture page.
 * @param expectedCount Expected closed-shadow host count.
 * @returns Nothing once the count matches.
 */
export async function waitForHostCount(page: Page, expectedCount: number): Promise<void> {
  await page.waitForFunction(
    (count) => document.querySelectorAll("[data-point-and-shoot-host]").length === count,
    expectedCount,
    { timeout: STATE_TIMEOUT_MILLISECONDS },
  );
}

/**
 * Reads the current durable session pointers from extension-local storage.
 *
 * @param serviceWorker Real extension service worker.
 * @returns Active and displayed session ids when present.
 */
export async function readSessionPointers(serviceWorker: Worker): Promise<SessionPointers> {
  return await serviceWorker.evaluate(async () => {
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
    return {
      activeId: typeof stored.activeSessionId === "string" ? stored.activeSessionId : undefined,
      displayId: typeof stored.displaySessionId === "string" ? stored.displaySessionId : undefined,
    };
  });
}

/**
 * Waits for and reads one raw session record from the extension's IndexedDB store.
 *
 * @param serviceWorker Real extension service worker.
 * @param expectedNoteCount Required note count before returning.
 * @param sessionId Optional explicit record id; defaults to the active or displayed pointer.
 * @returns The unknown stored value for production validation by the caller.
 */
export async function waitForStoredSession(
  serviceWorker: Worker,
  expectedNoteCount: number,
  sessionId?: string,
): Promise<unknown> {
  return await serviceWorker.evaluate(
    async ({ expectedNoteCount, pollInterval, requestedId, timeout }) => {
      const extensionGlobal = globalThis as unknown as {
        readonly chrome: {
          readonly storage: {
            readonly local: {
              get(keys: readonly string[]): Promise<Record<string, unknown>>;
            };
          };
        };
      };
      const deadline = Date.now() + timeout;
      do {
        const stored = await extensionGlobal.chrome.storage.local.get([
          "activeSessionId",
          "displaySessionId",
        ]);
        const selectedId = requestedId ??
          (typeof stored.activeSessionId === "string"
            ? stored.activeSessionId
            : typeof stored.displaySessionId === "string"
            ? stored.displaySessionId
            : undefined);
        if (selectedId !== undefined) {
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
            if (
              typeof record === "object" &&
              record !== null &&
              "notes" in record &&
              Array.isArray(record.notes) &&
              record.notes.length === expectedNoteCount
            ) {
              return record;
            }
          } finally {
            database.close();
          }
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } while (Date.now() < deadline);
      throw new Error(
        `session did not reach ${expectedNoteCount} notes within ${timeout}ms`,
      );
    },
    {
      expectedNoteCount,
      pollInterval: POLL_INTERVAL_MILLISECONDS,
      requestedId: sessionId,
      timeout: STATE_TIMEOUT_MILLISECONDS,
    },
  );
}

/**
 * Resolves the browser tab id for a foreground page.
 *
 * @param context Persistent Chromium context owning the page.
 * @param page Page whose tab id is required.
 * @returns Chromium's integer tab id.
 */
export async function tabIdForPage(context: BrowserContext, page: Page): Promise<number> {
  await page.bringToFront();
  const serviceWorker = context.serviceWorkers()[0];
  if (serviceWorker === undefined) throw new Error("extension service worker is unavailable");
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
    const id = (await extensionGlobal.chrome.tabs.query({
      active: true,
      currentWindow: true,
    }))[0]?.id;
    if (id === undefined) throw new Error("active tab has no id");
    return id;
  });
}

/**
 * Waits for a tab's browser-action badge and tooltip to match.
 *
 * @param serviceWorker Real extension service worker.
 * @param tabId Browser tab id.
 * @param expected Expected badge and tooltip state.
 * @returns The matching action state.
 */
export async function waitForActionState(
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
      if (observed.badgeText === expected.badgeText && observed.title === expected.title) {
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

/**
 * Reads the uncompressed local entries from the project's deterministic ZIP format.
 *
 * @param archive Store-only ZIP bytes.
 * @returns Entry names mapped to their uncompressed bytes.
 */
export function readStoredZipEntries(archive: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= view.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.byteLength) throw new Error("ZIP local entry exceeds archive bounds");
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength));
    entries.set(name, archive.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

/**
 * Runs one browser flow with tracing and writes its replay archive only on failure.
 *
 * @param context Chromium context to trace.
 * @param traceName Stable filename stem under `playwright-report/`.
 * @param operation Browser flow to execute.
 * @returns The operation result.
 */
export async function runWithFailureTrace<T>(
  context: BrowserContext,
  traceName: string,
  operation: () => Promise<T>,
): Promise<T> {
  await context.tracing.start({ screenshots: true, snapshots: true });
  try {
    const result = await operation();
    await context.tracing.stop();
    return result;
  } catch (error) {
    await Deno.mkdir(TRACE_DIRECTORY, { recursive: true });
    await context.tracing.stop({ path: join(TRACE_DIRECTORY, `${traceName}-trace.zip`) });
    throw error;
  }
}
