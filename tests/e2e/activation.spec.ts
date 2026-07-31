/// <reference lib="dom" />

import { assertEquals, assertStringIncludes } from "@std/assert";
import { type BrowserContext, type Page, type Worker } from "playwright";
import { startFixtureServer } from "../fixtures/app/server.ts";
import {
  launchExtension,
  openExtensionPage,
  readSessionPointers,
  readStoredZipEntries,
  triggerExtensionAction,
  waitForHostCount,
} from "./extension-fixture.ts";

const ACTION_STATE_POLL_INTERVAL_MILLISECONDS = 100;
const ACTION_STATE_TIMEOUT_MILLISECONDS = 5_000;
const LISTENER_POLL_INTERVAL_MILLISECONDS = 25;
const AGENT_TRIAL_NOTE =
  "This button looks like unstyled browser chrome. Give it a clear light-theme background, " +
  "border, and hover treatment.";

Deno.test("Escape dismisses capture UI while preserving the active session for resume", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto(`${fixture.base}/index.html`);
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);
    const before = await readSessionPointers(serviceWorker);
    if (before.activeId === undefined) throw new Error("session did not start");

    await page.keyboard.press("Escape");
    await waitForHostCount(page, 0);
    assertEquals((await readSessionPointers(serviceWorker)).activeId, before.activeId);

    const popup = await openExtensionPage(context, extensionId, "popup/popup.html");
    await page.bringToFront();
    await popup.getByRole("button", { name: "Resume session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    assertEquals((await readSessionPointers(serviceWorker)).activeId, before.activeId);
    await popup.close();
  } finally {
    await context.close();
    await fixture.close();
  }
});

interface ActionState {
  readonly badgeText: string;
  readonly title: string;
}

interface ReadActionStateOptions {
  readonly waitForBadge?: boolean;
}

async function openExtensionPopup(
  context: BrowserContext,
  page: Page,
  extensionId: string,
): Promise<Page> {
  await triggerExtensionAction(context, page, extensionId);
  return await openExtensionPage(context, extensionId, "popup/popup.html");
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

async function waitForComponentHints(
  serviceWorker: Worker,
  expectedNoteCount: number,
): Promise<readonly unknown[]> {
  return await serviceWorker.evaluate(
    async ({ expectedCount, pollMilliseconds, timeoutMilliseconds }) => {
      const extensionGlobal = globalThis as unknown as {
        readonly chrome: {
          readonly storage: {
            readonly local: {
              get(key: string): Promise<Record<string, unknown>>;
            };
          };
        };
      };
      const deadline = Date.now() + timeoutMilliseconds;
      do {
        const stored = await extensionGlobal.chrome.storage.local.get("activeSessionId");
        const sessionId = stored.activeSessionId;
        if (typeof sessionId === "string") {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("point-and-shoot");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            const session = await new Promise<unknown>((resolve, reject) => {
              const request = database.transaction("sessions", "readonly")
                .objectStore("sessions")
                .get(sessionId);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            if (typeof session === "object" && session !== null && "notes" in session) {
              const notes = session.notes as unknown[];
              if (notes.length >= expectedCount) {
                return notes.map((note) => {
                  if (typeof note !== "object" || note === null || !("elements" in note)) {
                    return null;
                  }
                  const element = (note.elements as unknown[])[0];
                  return typeof element === "object" &&
                      element !== null &&
                      "componentHint" in element
                    ? element.componentHint
                    : null;
                });
              }
            }
          } finally {
            database.close();
          }
        }
        await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
      } while (Date.now() < deadline);
      throw new Error(`expected ${expectedCount} captured notes before timeout`);
    },
    {
      expectedCount: expectedNoteCount,
      pollMilliseconds: LISTENER_POLL_INTERVAL_MILLISECONDS,
      timeoutMilliseconds: ACTION_STATE_TIMEOUT_MILLISECONDS,
    },
  );
}

async function installReactProbeMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="light-action"]');
    if (element === null) throw new Error("light action fixture is missing");
    const ReactCheckoutButton = function ReactCheckoutButton(): void {};
    Object.defineProperty(element, "__reactFiber$e2e", {
      configurable: true,
      value: {
        _debugSource: {
          fileName: "/workspace/src/checkout/ReactCheckoutButton.tsx",
          lineNumber: 17,
        },
        return: {
          elementType: ReactCheckoutButton,
          return: null,
        },
        type: "button",
      },
    });
  });
}

Deno.test("toolbar popup toggles one host and remounts cleanly after navigation", async () => {
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

    const popup = await openExtensionPopup(context, page, extensionId);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
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
    const overlay = popup.getByRole("switch", { name: "Overlay on this tab" });
    await popup.waitForFunction(() =>
      document.querySelector(".ps-popup-overlay-toggle .ps-switch")?.getAttribute(
        "aria-checked",
      ) === "true"
    );
    await page.bringToFront();
    await overlay.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 0);
    await popup.waitForFunction(() =>
      document.querySelector(".ps-popup-overlay-toggle .ps-switch")?.getAttribute(
        "aria-checked",
      ) === "false"
    );
    await page.bringToFront();
    await overlay.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    await popup.close();

    await page.goto(`${fixture.base}/dark.html`);
    assertEquals(
      await page.locator("[data-point-and-shoot-host]").count(),
      0,
      "navigation left an orphaned host in the new document",
    );
    const reopenedPopup = await openExtensionPopup(context, page, extensionId);
    await reopenedPopup.getByRole("heading", { name: "Untitled session" }).waitFor();
    await page.bringToFront();
    await reopenedPopup.getByRole("button", { name: "Resume session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
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

Deno.test("framework hint setting gates real main-world capture evidence", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html?probe=off`);
    await installReactProbeMarker(page);
    const popup = await openExtensionPopup(context, page, extensionId);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    await page.getByTestId("light-action").click();
    assertEquals(await waitForComponentHints(serviceWorker, 1), [null]);
    await popup.close();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options/options.html`);
    await options.getByRole("heading", { name: "Settings" }).waitFor();
    await options.getByRole("switch", { name: "Framework component hints" }).click();
    await options.getByText("Saved.").waitFor();
    await options.close();

    await page.goto(`${fixture.base}/light.html?probe=on`);
    await installReactProbeMarker(page);
    const resumedPopup = await openExtensionPopup(context, page, extensionId);
    await resumedPopup.getByRole("heading", { name: "Untitled session" }).waitFor();
    await page.bringToFront();
    await resumedPopup.getByRole("button", { name: "Resume session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    await page.getByTestId("light-action").click();

    assertEquals(await waitForComponentHints(serviceWorker, 2), [
      null,
      {
        file: "/workspace/src/checkout/ReactCheckoutButton.tsx",
        framework: "react",
        line: 17,
        name: "ReactCheckoutButton",
      },
    ]);
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("capture persists into the notes panel across a close and reopen", async () => {
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
    const popup = await openExtensionPopup(context, page, extensionId);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
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
    await panel.getByRole("textbox", { name: "Note text" }).fill(AGENT_TRIAL_NOTE);
    await panel.getByRole("button", { name: "Save changes" }).click();
    await panel.getByText(AGENT_TRIAL_NOTE).waitFor();
    await panel.close();

    const reopenedPanel = await context.newPage();
    await reopenedPanel.goto(panelUrl);
    await reopenedPanel.getByText(AGENT_TRIAL_NOTE).waitFor();
    await reopenedPanel.getByRole("button", { name: "Compile plan" }).click();
    await reopenedPanel.getByRole("heading", { name: "Compile plan" }).waitFor();
    const markdownPreview = await reopenedPanel.locator("[data-markdown-preview]").textContent();
    assertStringIncludes(markdownPreview ?? "", AGENT_TRIAL_NOTE);
    assertEquals(markdownPreview?.includes("access_token"), false);

    const downloadStarted = reopenedPanel.waitForEvent("download");
    await reopenedPanel.getByRole("button", { name: "Download bundle" }).click();
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

Deno.test("popup extension page starts a session and controls a granted tab", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId } = await launchExtension();

  try {
    const runtimeErrors: string[] = [];
    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html`);
    const popup = await openExtensionPopup(context, page, extensionId);
    popup.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    popup.on("pageerror", (error) => runtimeErrors.push(error.message));
    assertEquals(popup.url(), `chrome-extension://${extensionId}/popup/popup.html`);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();

    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    await popup.getByRole("heading", { name: "Untitled session" }).waitFor();
    const overlay = popup.getByRole("switch", { name: "Overlay on this tab" });
    assertEquals(await overlay.getAttribute("aria-checked"), "true");

    await page.bringToFront();
    await overlay.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 0);
    await popup.waitForFunction(() =>
      document.querySelector(".ps-popup-overlay-toggle .ps-switch")?.getAttribute(
        "aria-checked",
      ) === "false"
    );
    assertEquals(await overlay.getAttribute("aria-checked"), "false");

    const optionsOpened = context.waitForEvent("page");
    await popup.getByRole("button", { name: "Open options" }).click();
    const options = await optionsOpened;
    await options.waitForLoadState();
    assertEquals(
      options.url(),
      `chrome-extension://${extensionId}/options/options.html`,
    );
    assertEquals(runtimeErrors, [], "popup runtime logged an error");
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("options persist every setting and update a mounted overlay theme", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId } = await launchExtension();

  try {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options/options.html`);
    await options.getByRole("heading", { name: "Settings" }).waitFor();
    await options.getByLabel("Theme").selectOption("dark");
    await options.getByText("Saved.").waitFor();

    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.evaluate(() => {
      const state = globalThis as unknown as { firstPointShootTheme?: string };
      const observer = new MutationObserver(() => {
        const host = document.querySelector<HTMLElement>("[data-point-and-shoot-host]");
        if (host === null || state.firstPointShootTheme !== undefined) return;
        const theme = host.dataset.theme;
        if (theme === undefined) return;
        state.firstPointShootTheme = theme;
        observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
    const popup = await openExtensionPopup(context, page, extensionId);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await waitForHostCount(page, 1);
    assertEquals(
      await page.locator("[data-point-and-shoot-host]").getAttribute("data-theme"),
      "dark",
    );
    assertEquals(
      await page.evaluate(() =>
        (globalThis as unknown as { firstPointShootTheme?: string }).firstPointShootTheme
      ),
      "dark",
    );

    await options.bringToFront();
    await options.getByLabel("Theme").selectOption("light");
    await options.getByText("Saved.").waitFor();
    await page.waitForFunction(() =>
      document.querySelector("[data-point-and-shoot-host]")?.getAttribute("data-theme") === "light"
    );
    await options.getByRole("switch", { name: "Framework component hints" }).click();
    await options.getByText("Saved.").waitFor();
    await options.getByRole("tab", { name: "Capture" }).click();
    await options.getByLabel("Screenshot quality").selectOption("0.85");
    await options.getByText("Saved.").waitFor();
    await options.getByLabel("Maximum screenshot dimension").selectOption("2048");
    await options.getByText("Saved.").waitFor();
    await options.getByRole("tab", { name: "Export & privacy" }).click();
    await options.getByLabel("Export warning threshold").selectOption("8000000");
    await options.getByText("Saved.").waitFor();
    await options.getByRole("switch", { name: "Strip sensitive query strings" }).click();
    await options.getByText("Saved.").waitFor();

    await options.reload();
    await options.getByRole("heading", { name: "Settings" }).waitFor();
    await options.waitForFunction(() =>
      (document.querySelector("select") as HTMLSelectElement | null)?.value === "light"
    );
    assertEquals(await options.getByLabel("Theme").inputValue(), "light");
    assertEquals(
      await options.getByRole("switch", { name: "Framework component hints" }).getAttribute(
        "aria-checked",
      ),
      "true",
    );
    await options.getByRole("tab", { name: "Capture" }).click();
    assertEquals(await options.getByLabel("Screenshot quality").inputValue(), "0.85");
    assertEquals(await options.getByLabel("Maximum screenshot dimension").inputValue(), "2048");
    await options.getByRole("tab", { name: "Export & privacy" }).click();
    assertEquals(await options.getByLabel("Export warning threshold").inputValue(), "8000000");
    assertEquals(
      await options.getByRole("switch", { name: "Strip sensitive query strings" }).getAttribute(
        "aria-checked",
      ),
      "false",
    );
    await options.getByRole("tab", { name: "Shortcuts" }).click();
    const shortcut = options.locator(".ps-options-shortcut");
    await shortcut.waitFor();
    assertEquals((await shortcut.textContent())?.trim() === "Not assigned", false);
    const shortcutSettingsOpened = context.waitForEvent("page");
    await options.getByRole("button", { name: "Manage browser shortcuts" }).click();
    const shortcutSettings = await shortcutSettingsOpened;
    await shortcutSettings.waitForLoadState();
    assertEquals(shortcutSettings.url(), "chrome://extensions/shortcuts");

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await panel.getByRole("heading", { name: "Untitled session" }).waitFor();
    await panel.getByText(/of 8\.00 MB/).waitFor();

    await options.bringToFront();
    await options.getByRole("tab", { name: "Data" }).click();
    await options.getByRole("button", { name: "Clear all sessions" }).click();
    await options.getByRole("dialog").getByRole("button", { name: "Clear all sessions" }).click();
    await options.getByText("All sessions cleared.").waitFor();
    await panel.reload();
    await panel.getByRole("heading", { name: "No notes yet" }).waitFor();
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("restricted-page activation exposes a clear browser-action message", async () => {
  const { context, extensionId, serviceWorker } = await launchExtension();

  try {
    const page = await context.newPage();
    await page.goto("chrome://extensions/");
    const popup = await openExtensionPopup(context, page, extensionId);
    await popup.getByRole("heading", { name: "No active session" }).waitFor();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Start session" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await popup.getByRole("alert").getByText(
      "Point & Shoot is unavailable on this page.",
    ).waitFor();

    const actionState = await readActiveActionState(serviceWorker, { waitForBadge: true });

    assertEquals(actionState.badgeText, "!");
    assertStringIncludes(actionState.title, "unavailable on this page");
  } finally {
    await context.close();
  }
});
