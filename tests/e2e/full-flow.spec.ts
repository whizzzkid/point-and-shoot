/// <reference lib="dom" />

/**
 * Drives the real built Chromium extension through the complete user flows.
 *
 * Named `.spec.ts`, not `.test.ts`, so the fast `deno task test` gate does not discover this
 * browser tier. Run with `deno task e2e:full`.
 *
 * @module
 */

import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";
import type { BrowserContext, Locator, Page, Worker } from "playwright";
import { CAPTURE_REGION_MESSAGE, isCaptureRegionResponse } from "../../src/shared/messages.ts";
import { type Session, validateSession } from "../../src/shared/schema.ts";
import { createExportArchive } from "../../src/shared/serialize/zip.ts";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../../src/shared/settings.ts";
import { startFixtureServer } from "../fixtures/app/server.ts";
import {
  launchExtension,
  openExtensionPage,
  readSessionPointers,
  readStoredZipEntries,
  runWithFailureTrace,
  tabIdForPage,
  triggerExtensionAction,
  waitForActionState,
  waitForHostCount,
  waitForStoredSession,
} from "./extension-fixture.ts";

const FIRST_NOTE = "The save action needs clearer visual hierarchy.";
const SECOND_NOTE = "The dark-page action needs a stronger focus treatment.";
const ORDINARY_SESSION_NAME = /^Fixture: ordinary page-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

function validatedSession(candidate: unknown): Session {
  const result = validateSession(candidate);
  if (!result.valid) {
    throw new Error(`production session validation failed: ${JSON.stringify(result.error)}`);
  }
  return result.session;
}

async function forceLightTheme(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(
    async ({ key, settings }) => {
      const extensionGlobal = globalThis as unknown as {
        readonly chrome: {
          readonly storage: {
            readonly local: {
              set(items: Record<string, unknown>): Promise<void>;
            };
          };
        };
      };
      await extensionGlobal.chrome.storage.local.set({ [key]: settings });
    },
    {
      key: SETTINGS_STORAGE_KEY,
      settings: { ...DEFAULT_SETTINGS, themeOverride: "light" as const },
    },
  );
}

async function startSession(
  context: BrowserContext,
  page: Page,
  extensionId: string,
  serviceWorker: Worker,
): Promise<string> {
  await triggerExtensionAction(context, page, extensionId);
  await waitForHostCount(page, 1);
  const tabId = await tabIdForPage(context, page);
  await waitForActionState(serviceWorker, tabId, {
    badgeText: "0",
    title: "Point and Shoot — End session (0 notes)",
  });
  const pointers = await readSessionPointers(serviceWorker);
  if (pointers.activeId === undefined) throw new Error("toolbar action did not start a session");
  validatedSession(await waitForStoredSession(serviceWorker, 0, pointers.activeId));
  return pointers.activeId;
}

async function endSession(
  context: BrowserContext,
  page: Page,
  extensionId: string,
  serviceWorker: Worker,
  sessionId: string,
  expectedNoteCount: number,
): Promise<Session> {
  await triggerExtensionAction(context, page, extensionId);
  await waitForHostCount(page, 0);
  const pointers = await readSessionPointers(serviceWorker);
  assertEquals(pointers.activeId, undefined);
  assertEquals(pointers.displayId, sessionId);
  const session = validatedSession(
    await waitForStoredSession(serviceWorker, expectedNoteCount, sessionId),
  );
  assertNotEquals(session.endedAt, null);
  return session;
}

async function resumeSession(
  context: BrowserContext,
  page: Page,
  extensionId: string,
): Promise<void> {
  const popup = await openExtensionPage(context, extensionId, "popup/popup.html");
  await popup.getByRole("heading", { name: ORDINARY_SESSION_NAME }).waitFor();
  await page.bringToFront();
  await popup.getByRole("button", { name: "Resume session" }).evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await waitForHostCount(page, 1);
  await popup.close();
}

async function savePendingCapture(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.activeElement?.matches("[data-point-and-shoot-host]") === true
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
}

async function capture(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await locator.click();
  await savePendingCapture(locator.page());
}

async function editVisibleNote(panel: Page, text: string): Promise<void> {
  const note = panel.locator("[data-note-id]").first();
  await note.getByRole("button", { name: "Edit" }).click();
  await panel.getByRole("textbox", { name: "Note text" }).fill(text);
  await panel.getByRole("button", { name: "Save changes" }).click();
  await panel.getByText(text).waitFor();
}

async function downloadEntries(panel: Page): Promise<Map<string, Uint8Array>> {
  const downloadStarted = panel.waitForEvent("download");
  await panel.getByRole("button", { name: "Download bundle" }).click();
  const download = await downloadStarted;
  const path = await download.path();
  if (path === null) throw new Error("agent bundle download did not produce a local file");
  return readStoredZipEntries(await Deno.readFile(path));
}

function assertMarkdownImagesResolve(
  markdown: string,
  entries: ReadonlyMap<string, Uint8Array>,
  expectedReferenceCount: number,
): void {
  const references = [...markdown.matchAll(/\[[^\]]*\]\((?<target>[^)]+)\)/g)]
    .map((match) => match.groups?.target)
    .filter((target): target is string => target?.startsWith("./") === true);
  const expectedReferences = [...entries.keys()]
    .filter((path) => path.startsWith("shots/") && path.endsWith(".webp"))
    .map((path) => `./${path}`);
  assertEquals(
    expectedReferences.length,
    expectedReferenceCount,
    "ZIP screenshot count did not match exported notes",
  );
  assertEquals(
    references,
    expectedReferences,
    "Markdown screenshot references did not match the ZIP entries",
  );
}

interface FixtureCaptureCase {
  readonly path: string;
  readonly target: (page: Page) => Promise<void>;
  readonly verify: (session: Session) => void;
}

function reachableTestId(session: Session): string | undefined {
  const selectors = session.notes[0]?.elements[0]?.selectors;
  return selectors?.testIds[0]?.value;
}

const FIXTURE_CASES: readonly FixtureCaptureCase[] = [
  {
    path: "index.html",
    target: (page) => capture(page.getByTestId("save-note")),
    verify: (session) => assertEquals(reachableTestId(session), "save-note"),
  },
  {
    path: "light.html",
    target: (page) => capture(page.getByTestId("light-action")),
    verify: (session) => assertEquals(reachableTestId(session), "light-action"),
  },
  {
    path: "dark.html",
    target: (page) => capture(page.getByTestId("dark-action")),
    verify: (session) => assertEquals(reachableTestId(session), "dark-action"),
  },
  {
    path: "tall.html",
    target: (page) => capture(page.getByTestId("over-tall-region")),
    verify: (session) => {
      assertEquals(reachableTestId(session), "over-tall-region");
      assertEquals(session.notes[0]?.region.truncated, true);
    },
  },
  {
    path: "iframe.html",
    target: async (page) => {
      const frame = page.getByTestId("cross-origin-frame");
      await frame.waitFor();
      const box = await frame.boundingBox();
      if (box === null) throw new Error("cross-origin frame has no visible bounds");
      const target = { x: box.x + 24, y: box.y + 24 };
      await page.mouse.move(target.x, target.y);
      await page.mouse.click(target.x, target.y);
      await savePendingCapture(page);
    },
    verify: (session) => {
      const selectors = session.notes[0]?.elements[0]?.selectors;
      assertEquals(selectors?.reachable, false);
      if (selectors?.reachable !== false) throw new Error("cross-origin selector was reachable");
      assertEquals(selectors.unreachable, "cross-origin-iframe");
    },
  },
  {
    path: "frame-content.html",
    target: (page) => capture(page.getByTestId("frame-button")),
    verify: (session) => assertEquals(reachableTestId(session), "frame-button"),
  },
  {
    path: "shadow.html",
    target: (page) => capture(page.getByTestId("closed-shadow-host")),
    verify: (session) => assertEquals(reachableTestId(session), "closed-shadow-host"),
  },
  {
    path: "canvas.html",
    target: (page) => capture(page.getByTestId("drawn-canvas")),
    verify: (session) => assertEquals(reachableTestId(session), "drawn-canvas"),
  },
  {
    path: "firefox-boot.html",
    target: (page) => capture(page.getByRole("heading", { name: "Fixture: Firefox boot check" })),
    verify: (session) => assertStringIncludes(session.notes[0]?.pageTitle ?? "", "Firefox boot"),
  },
];

Deno.test("full flow captures two pages in one validated export bundle", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    await runWithFailureTrace(context, "full-flow-multi-page", async () => {
      await forceLightTheme(serviceWorker);
      const page = await context.newPage();
      await page.goto(`${fixture.base}/index.html`);
      const sessionId = await startSession(context, page, extensionId, serviceWorker);

      await capture(page.getByTestId("save-note"));
      const firstCapture = validatedSession(
        await waitForStoredSession(serviceWorker, 1, sessionId),
      );
      assertEquals(firstCapture.notes[0]?.pageUrl, `${fixture.base}/index.html`);

      await page.goto(`${fixture.base}/dark.html`);
      await resumeSession(context, page, extensionId);
      await capture(page.getByTestId("dark-action"));
      const secondCapture = validatedSession(
        await waitForStoredSession(serviceWorker, 2, sessionId),
      );
      assertEquals(secondCapture.id, sessionId);
      assertEquals(secondCapture.notes.map((note) => note.pageUrl), [
        `${fixture.base}/index.html`,
        `${fixture.base}/dark.html`,
      ]);

      const panel = await openExtensionPage(context, extensionId, "sidepanel/sidepanel.html");
      await panel.getByRole("heading", { name: ORDINARY_SESSION_NAME }).waitFor();
      await editVisibleNote(panel, FIRST_NOTE);
      await panel.locator("[data-page-key]").filter({ hasText: "Fixture: dark page" }).click();
      const darkNoteCard = panel.locator("[data-note-id]").first();
      await page.bringToFront();
      await darkNoteCard.dispatchEvent("pointerenter");
      await page.waitForFunction(() =>
        document.querySelectorAll("[data-point-and-shoot-preview-host]").length === 1
      );
      await darkNoteCard.dispatchEvent("pointerleave");
      await page.waitForFunction(() =>
        document.querySelectorAll("[data-point-and-shoot-preview-host]").length === 0
      );
      await darkNoteCard.evaluate((element) => (element as HTMLElement).focus());
      await page.waitForFunction(() =>
        document.querySelectorAll("[data-point-and-shoot-preview-host]").length === 1
      );
      await panel.locator(".ps-notes-header").evaluate((element) =>
        (element as HTMLElement).focus()
      );
      await darkNoteCard.evaluate((element) => (element as HTMLElement).blur());
      await page.waitForFunction(() =>
        document.querySelectorAll("[data-point-and-shoot-preview-host]").length === 0
      );
      await editVisibleNote(panel, SECOND_NOTE);
      await panel.getByRole("button", { name: "Compile plan" }).click();
      await panel.getByRole("heading", { name: "Compile plan" }).waitFor();

      const entries = await downloadEntries(panel);
      assertEquals([...entries.keys()], [
        "session.json",
        "plan.md",
        "shots/note-01.webp",
        "shots/note-02.webp",
      ]);
      const decoder = new TextDecoder();
      const exported = validatedSession(
        JSON.parse(decoder.decode(entries.get("session.json"))),
      );
      assertEquals(exported.id, sessionId);
      assertEquals(exported.notes.map((note) => note.text), [FIRST_NOTE, SECOND_NOTE]);
      const markdown = decoder.decode(entries.get("plan.md"));
      assertStringIncludes(markdown, FIRST_NOTE);
      assertStringIncludes(markdown, SECOND_NOTE);
      assertMarkdownImagesResolve(markdown, entries, exported.notes.length);
    });
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("session survives a real Chromium restart before end and fresh start", async () => {
  const fixture = startFixtureServer();
  const profile = await Deno.makeTempDir({ prefix: "point-and-shoot-w4-lifecycle-" });
  let firstLaunch = await launchExtension(profile);
  try {
    let sessionId = "";
    await runWithFailureTrace(
      firstLaunch.context,
      "full-flow-lifecycle-before-restart",
      async () => {
        await forceLightTheme(firstLaunch.serviceWorker);
        const page = await firstLaunch.context.newPage();
        await page.goto(`${fixture.base}/light.html`);
        sessionId = await startSession(
          firstLaunch.context,
          page,
          firstLaunch.extensionId,
          firstLaunch.serviceWorker,
        );
        await capture(page.getByTestId("light-action"));
        validatedSession(await waitForStoredSession(firstLaunch.serviceWorker, 1, sessionId));
      },
    );
    await firstLaunch.context.close();

    firstLaunch = await launchExtension(profile);
    await runWithFailureTrace(
      firstLaunch.context,
      "full-flow-lifecycle-after-restart",
      async () => {
        const page = await firstLaunch.context.newPage();
        await page.goto(`${fixture.base}/light.html`);
        await page.bringToFront();
        const tabId = await tabIdForPage(firstLaunch.context, page);
        assertEquals(
          await waitForActionState(firstLaunch.serviceWorker, tabId, {
            badgeText: "1",
            title: "Point and Shoot — End session (1 note)",
          }),
          {
            badgeText: "1",
            title: "Point and Shoot — End session (1 note)",
          },
        );
        const resumedPointers = await readSessionPointers(firstLaunch.serviceWorker);
        assertEquals(resumedPointers.activeId, sessionId);
        const resumed = validatedSession(
          await waitForStoredSession(firstLaunch.serviceWorker, 1, sessionId),
        );
        assertEquals(resumed.endedAt, null);

        const panel = await openExtensionPage(
          firstLaunch.context,
          firstLaunch.extensionId,
          "sidepanel/sidepanel.html",
        );
        await panel.getByRole("heading", { name: resumed.name, exact: true }).waitFor();
        const notes = panel.locator("[data-note-id]");
        await notes.first().waitFor();
        assertEquals(await notes.count(), 1);
        await panel.close();

        await endSession(
          firstLaunch.context,
          page,
          firstLaunch.extensionId,
          firstLaunch.serviceWorker,
          sessionId,
          1,
        );
        const freshId = await startSession(
          firstLaunch.context,
          page,
          firstLaunch.extensionId,
          firstLaunch.serviceWorker,
        );
        assertNotEquals(freshId, sessionId);
      },
    );
  } finally {
    await firstLaunch.context.close();
    await fixture.close();
    await Deno.remove(profile, { recursive: true });
  }
});

Deno.test("every HTML fixture is a real capture target", async () => {
  const fixture = startFixtureServer();
  try {
    for (const fixtureCase of FIXTURE_CASES) {
      const { context, extensionId, serviceWorker } = await launchExtension();
      try {
        await runWithFailureTrace(
          context,
          `full-flow-fixture-${fixtureCase.path.replace(".html", "")}`,
          async () => {
            await forceLightTheme(serviceWorker);
            const page = await context.newPage();
            await page.goto(`${fixture.base}/${fixtureCase.path}`);
            const sessionId = await startSession(context, page, extensionId, serviceWorker);
            await fixtureCase.target(page);
            const session = validatedSession(
              await waitForStoredSession(serviceWorker, 1, sessionId),
            );
            assertEquals(session.notes[0]?.pageUrl, `${fixture.base}/${fixtureCase.path}`);
            fixtureCase.verify(session);
          },
        );
      } catch (error) {
        throw new Error(`fixture capture failed for ${fixtureCase.path}`, { cause: error });
      } finally {
        await context.close();
      }
    }
  } finally {
    await fixture.close();
  }
});

Deno.test("capture without an activeTab gesture returns permission-denied", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    await runWithFailureTrace(context, "full-flow-permission-denied", async () => {
      await forceLightTheme(serviceWorker);
      const page = await context.newPage();
      await page.goto(`${fixture.base}/light.html`);
      const popup = await openExtensionPage(context, extensionId, "popup/popup.html");
      await page.bringToFront();
      const response = await popup.evaluate(async (request) => {
        const extensionGlobal = globalThis as unknown as {
          readonly chrome: {
            readonly runtime: {
              sendMessage(message: unknown): Promise<unknown>;
            };
          };
        };
        return await extensionGlobal.chrome.runtime.sendMessage(request);
      }, {
        devicePixelRatio: 1,
        region: { height: 40, width: 80, x: 20, y: 20 },
        type: CAPTURE_REGION_MESSAGE,
        viewport: { height: 720, width: 1_280 },
      });
      assert(isCaptureRegionResponse(response));
      assertEquals(response, {
        error: {
          code: "permission-denied",
          message:
            "Capture needs an active-tab permission granted by a toolbar or keyboard gesture.",
        },
        ok: false,
      });
      assertEquals(await readSessionPointers(serviceWorker), {
        activeId: undefined,
        displayId: undefined,
      });
    });
  } finally {
    await fixture.close();
    await context.close();
  }
});

Deno.test("quota failure, empty note, zero-note export, and restricted page stay safe", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    await runWithFailureTrace(context, "full-flow-sad-paths", async () => {
      await forceLightTheme(serviceWorker);
      const page = await context.newPage();
      await page.goto(`${fixture.base}/light.html`);
      const sessionId = await startSession(context, page, extensionId, serviceWorker);

      const emptyPanel = await openExtensionPage(
        context,
        extensionId,
        "sidepanel/sidepanel.html",
      );
      await emptyPanel.getByRole("heading", { name: "No notes yet" }).waitFor();
      assertEquals(await emptyPanel.getByRole("button", { name: "Compile plan" }).count(), 0);
      assertEquals(await emptyPanel.getByRole("button", { name: "Download bundle" }).count(), 0);
      await emptyPanel.close();

      await serviceWorker.evaluate(() => {
        const state = globalThis as unknown as {
          pointAndShootOriginalPut?: typeof IDBObjectStore.prototype.put;
        };
        state.pointAndShootOriginalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (
          _value: unknown,
          _key?: IDBValidKey,
        ): IDBRequest<IDBValidKey> {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        };
      });
      await capture(page.getByTestId("light-action"));
      const afterQuotaFailure = validatedSession(
        await waitForStoredSession(serviceWorker, 0, sessionId),
      );
      assertEquals(afterQuotaFailure.notes, []);

      await serviceWorker.evaluate(() => {
        const state = globalThis as unknown as {
          pointAndShootOriginalPut?: typeof IDBObjectStore.prototype.put;
        };
        if (state.pointAndShootOriginalPut === undefined) {
          throw new Error("quota fault did not retain the original IndexedDB put");
        }
        IDBObjectStore.prototype.put = state.pointAndShootOriginalPut;
        delete state.pointAndShootOriginalPut;
      });
      await page.keyboard.press("Escape");
      await waitForHostCount(page, 0);
      await resumeSession(context, page, extensionId);
      await capture(page.getByTestId("light-action"));
      const emptyNoteSession = validatedSession(
        await waitForStoredSession(serviceWorker, 1, sessionId),
      );
      assertEquals(emptyNoteSession.notes[0]?.text, "");

      const panel = await openExtensionPage(context, extensionId, "sidepanel/sidepanel.html");
      await panel.getByRole("button", { name: "Compile plan" }).click();
      await panel.getByRole("heading", { name: "Compile plan" }).waitFor();
      assertStringIncludes(
        await panel.locator("[data-markdown-preview]").textContent() ?? "",
        "_No note text was provided._",
      );
      await panel.getByRole("button", { name: "Exclude all" }).click();
      assertStringIncludes(
        await panel.locator("[data-markdown-preview]").textContent() ?? "",
        "0 notes captured.",
      );
      assertEquals(await panel.getByRole("button", { name: "Copy prompt" }).isDisabled(), true);
      assertEquals(
        await panel.getByRole("button", { name: "Download bundle" }).isDisabled(),
        true,
      );
      const zeroNoteEntries = readStoredZipEntries(
        createExportArchive(emptyNoteSession, { includedNoteIds: new Set() }),
      );
      assertEquals([...zeroNoteEntries.keys()], ["session.json", "plan.md"]);
      const zeroNoteExport = validatedSession(
        JSON.parse(new TextDecoder().decode(zeroNoteEntries.get("session.json"))),
      );
      assertEquals(zeroNoteExport.notes, []);
      assertStringIncludes(
        new TextDecoder().decode(zeroNoteEntries.get("plan.md")),
        "0 notes captured.",
      );
      await panel.getByRole("button", { name: "Include all" }).click();
      const entries = await downloadEntries(panel);
      const exported = validatedSession(
        JSON.parse(new TextDecoder().decode(entries.get("session.json"))),
      );
      assertEquals(exported.notes[0]?.text, "");
      await panel.close();
      await endSession(context, page, extensionId, serviceWorker, sessionId, 1);

      await page.goto("chrome://extensions/");
      await page.bringToFront();
      const tabId = await tabIdForPage(context, page);
      await triggerExtensionAction(context, page, extensionId);
      assertEquals(
        await waitForActionState(serviceWorker, tabId, {
          badgeText: "!",
          title: "Point and Shoot — unavailable on this page",
        }),
        {
          badgeText: "!",
          title: "Point and Shoot — unavailable on this page",
        },
      );
      assertEquals((await readSessionPointers(serviceWorker)).activeId, undefined);
    });
  } finally {
    await fixture.close();
    await context.close();
  }
});
