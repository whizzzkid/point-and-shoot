/// <reference lib="dom" />

import { assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { type BrowserContext, chromium, type Page, type Worker } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";

const EXTENSION_DIR = fromFileUrl(new URL("../../dist/chrome/", import.meta.url));
const ACTION_STATE_POLL_INTERVAL_MILLISECONDS = 100;
const ACTION_STATE_TIMEOUT_MILLISECONDS = 5_000;
const HOST_COUNT_TIMEOUT_MILLISECONDS = 5_000;
const LISTENER_POLL_INTERVAL_MILLISECONDS = 25;
const LISTENER_READY_TIMEOUT_MILLISECONDS = 2_500;
const SERVICE_WORKER_TIMEOUT_MILLISECONDS = 10_000;

interface ActionState {
  readonly badgeText: string;
  readonly title: string;
}

interface ReadActionStateOptions {
  readonly waitForBadge?: boolean;
}

function readStoredZipEntries(archive: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength));
    entries.set(name, archive.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }

  return entries;
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
    await context.waitForEvent("serviceworker", { timeout: SERVICE_WORKER_TIMEOUT_MILLISECONDS });
  // CDP exposes the worker before its module has necessarily registered listeners. Triggering the
  // action in that window is a no-op, so synchronize on the exact readiness condition under test.
  const readinessDeadline = Date.now() + LISTENER_READY_TIMEOUT_MILLISECONDS;
  while (Date.now() < readinessDeadline) {
    const listenersReady = await serviceWorker.evaluate(() => {
      const extensionGlobal = globalThis as unknown as {
        readonly chrome: {
          readonly action: {
            readonly onClicked: { hasListeners(): boolean };
          };
          readonly commands: {
            readonly onCommand: { hasListeners(): boolean };
          };
        };
      };
      return extensionGlobal.chrome.action.onClicked.hasListeners() &&
        extensionGlobal.chrome.commands.onCommand.hasListeners();
    });
    if (listenersReady) {
      return {
        context,
        extensionId: new URL(serviceWorker.url()).host,
        serviceWorker,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, LISTENER_POLL_INTERVAL_MILLISECONDS));
  }
  await context.close();
  throw new Error(
    `extension activation listeners were not ready within ${LISTENER_READY_TIMEOUT_MILLISECONDS}ms`,
  );
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
      throw new Error(
        `no tab target found for ${page.url()}: ${
          JSON.stringify(targetInfos.map(({ targetId, type, url }) => ({ targetId, type, url })))
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

async function waitForHostCount(page: Page, expectedCount: number): Promise<void> {
  await page.waitForFunction(
    (count) => document.querySelectorAll("[data-point-and-shoot-host]").length === count,
    expectedCount,
    { timeout: HOST_COUNT_TIMEOUT_MILLISECONDS },
  );
}

async function readActiveActionState(
  serviceWorker: Worker,
  { waitForBadge = false }: ReadActionStateOptions = {},
): Promise<ActionState> {
  return await serviceWorker.evaluate(async (options) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly action: {
          getBadgeText(details: { readonly tabId: number }): Promise<string>;
          getTitle(details: { readonly tabId: number }): Promise<string>;
        };
        readonly tabs: {
          query(details: {
            readonly active: boolean;
            readonly currentWindow: boolean;
          }): Promise<readonly { readonly id?: number }[]>;
        };
      };
    };
    const tabId = (await extensionGlobal.chrome.tabs.query({
      active: true,
      currentWindow: true,
    }))[0]?.id;
    if (tabId === undefined) throw new Error("active tab has no id");

    const readActionState = async (): Promise<ActionState> => {
      const [badgeText, title] = await Promise.all([
        extensionGlobal.chrome.action.getBadgeText({ tabId }),
        extensionGlobal.chrome.action.getTitle({ tabId }),
      ]);
      return { badgeText, title };
    };
    const deadline = Date.now() + options.timeoutMilliseconds;
    do {
      const actionState = await readActionState();
      if (!options.waitForBadge || actionState.badgeText !== "") return actionState;
      await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMilliseconds));
    } while (Date.now() < deadline);

    return await readActionState();
  }, {
    pollIntervalMilliseconds: ACTION_STATE_POLL_INTERVAL_MILLISECONDS,
    timeoutMilliseconds: waitForBadge ? ACTION_STATE_TIMEOUT_MILLISECONDS : 0,
    waitForBadge,
  });
}

async function waitForCapturedNote(
  serviceWorker: Worker,
): Promise<{ readonly pageUrl: string; readonly screenshot: string }> {
  return await serviceWorker.evaluate(async ({ pollMilliseconds, timeoutMilliseconds }) => {
    const extensionGlobal = globalThis as unknown as {
      readonly chrome: {
        readonly storage: {
          readonly local: {
            get(key: string): Promise<Record<string, unknown>>;
          };
        };
      };
    };
    const openDatabase = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("point-and-shoot");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const deadline = Date.now() + timeoutMilliseconds;
    do {
      const stored = await extensionGlobal.chrome.storage.local.get("activeSessionId");
      const sessionId = stored.activeSessionId;
      if (typeof sessionId === "string") {
        const database = await openDatabase();
        try {
          const session = await new Promise<unknown>((resolve, reject) => {
            const request = database.transaction("sessions", "readonly")
              .objectStore("sessions")
              .get(sessionId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          if (typeof session === "object" && session !== null && "notes" in session) {
            const note = (session.notes as unknown[])[0];
            if (
              typeof note === "object" &&
              note !== null &&
              "pageUrl" in note &&
              "region" in note &&
              typeof note.pageUrl === "string" &&
              typeof note.region === "object" &&
              note.region !== null &&
              "screenshot" in note.region &&
              typeof note.region.screenshot === "string"
            ) {
              return {
                pageUrl: note.pageUrl,
                screenshot: note.region.screenshot,
              };
            }
          }
        } finally {
          database.close();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
    } while (Date.now() < deadline);
    const storage = await extensionGlobal.chrome.storage.local.get("activeSessionId");
    throw new Error(
      `captured note was not persisted within ${timeoutMilliseconds}ms: ${
        JSON.stringify({ storage })
      }`,
    );
  }, {
    pollMilliseconds: LISTENER_POLL_INTERVAL_MILLISECONDS,
    timeoutMilliseconds: ACTION_STATE_TIMEOUT_MILLISECONDS,
  });
}

Deno.test("browser action toggles one host and remounts cleanly after navigation", async () => {
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${fixture.base}/light.html`);

    await triggerExtensionAction(context, page, extensionId);
    try {
      await waitForHostCount(page, 1);
    } catch (error) {
      const pageState = await page.evaluate(() => ({
        contentReady: document.documentElement.dataset.pointAndShootContentReady,
        hostCount: document.querySelectorAll("[data-point-and-shoot-host]").length,
      }));
      const actionState = await readActiveActionState(serviceWorker);
      throw new Error(
        `first activation did not mount: ${JSON.stringify({ actionState, pageErrors, pageState })}`,
        { cause: error },
      );
    }
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 0);
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);

    await page.goto(`${fixture.base}/dark.html`);
    assertEquals(
      await page.locator("[data-point-and-shoot-host]").count(),
      0,
      "navigation left an orphaned host in the new document",
    );
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);
    assertEquals(
      await page.locator("[data-point-and-shoot-host]").getAttribute("data-theme"),
      "dark",
    );
    assertEquals(pageErrors, [], "activation logged a console or page error");
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("capture persists into the notes panel across a close and reopen", async () => {
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    const runtimeErrors: string[] = [];
    context.on("page", (browserPage) => {
      browserPage.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(`page: ${message.text()}`);
      });
      browserPage.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));
    });
    serviceWorker.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(`worker: ${message.text()}`);
    });
    const page = await context.newPage();
    const recordedUrl = `${fixture.base}/light.html?access_token=e2e-secret`;
    await page.goto(recordedUrl);
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);
    await page.getByTestId("light-action").click();

    let captured: Awaited<ReturnType<typeof waitForCapturedNote>>;
    try {
      captured = await waitForCapturedNote(serviceWorker);
    } catch (error) {
      throw new Error(`capture diagnostics: ${JSON.stringify({ runtimeErrors })}`, {
        cause: error,
      });
    }
    assertEquals(captured.pageUrl, recordedUrl);
    assertStringIncludes(captured.screenshot, "data:image/webp;base64,");

    const panelUrl = `chrome-extension://${extensionId}/sidepanel/sidepanel.html`;
    const panel = await context.newPage();
    await panel.goto(panelUrl);
    await panel.getByRole("heading", { name: "Untitled session" }).waitFor();
    const note = panel.locator("[data-note-id]");
    await note.waitFor();
    assertEquals(await note.locator("[data-recorded-url]").getAttribute("title"), recordedUrl);
    assertEquals(
      await note.getByRole("switch", { name: "Strip query when exporting" }).getAttribute(
        "aria-checked",
      ),
      "true",
    );

    await note.getByRole("button", { name: "Edit" }).click();
    await panel.getByRole("textbox", { name: "Note text" }).fill("Captured from the real overlay.");
    await panel.getByRole("button", { name: "Save changes" }).click();
    await panel.getByText("Captured from the real overlay.").waitFor();
    await panel.close();

    const reopenedPanel = await context.newPage();
    await reopenedPanel.goto(panelUrl);
    await reopenedPanel.getByText("Captured from the real overlay.").waitFor();
    await reopenedPanel.getByRole("button", { name: "Compile plan" }).click();
    await reopenedPanel.getByRole("heading", { name: "Compile plan" }).waitFor();
    const markdownPreview = await reopenedPanel.locator("[data-markdown-preview]").textContent();
    assertStringIncludes(markdownPreview ?? "", "Captured from the real overlay.");
    assertEquals(markdownPreview?.includes("access_token"), false);

    const downloadStarted = reopenedPanel.waitForEvent("download");
    await reopenedPanel.getByRole("button", { name: "Download for agent" }).click();
    const download = await downloadStarted;
    const downloadPath = await download.path();
    if (downloadPath === null) {
      throw new Error("agent bundle download did not produce a local file");
    }
    const entries = readStoredZipEntries(await Deno.readFile(downloadPath));
    assertEquals([...entries.keys()], [
      "session.json",
      "plan.md",
      "shots/note-01.webp",
    ]);
    const decoder = new TextDecoder();
    const exportedJson = decoder.decode(entries.get("session.json"));
    const exportedMarkdown = decoder.decode(entries.get("plan.md"));
    assertEquals(exportedJson.includes("e2e-secret"), false);
    assertEquals(exportedMarkdown.includes("e2e-secret"), false);
    assertStringIncludes(exportedMarkdown, "./shots/note-01.webp");
    assertEquals((entries.get("shots/note-01.webp")?.byteLength ?? 0) > 0, true);
    assertEquals(runtimeErrors, [], "capture or notes-panel runtime logged an error");
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("restricted-page activation exposes a clear browser-action message", async () => {
  await Deno.stat(join(EXTENSION_DIR, "manifest.json"));
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    const page = await context.newPage();
    await page.goto("chrome://extensions/");
    await triggerExtensionAction(context, page, extensionId);

    const actionState = await readActiveActionState(serviceWorker, { waitForBadge: true });

    assertEquals(actionState.badgeText, "!");
    assertStringIncludes(actionState.title, "unavailable on this page");
  } finally {
    await context.close();
  }
});
