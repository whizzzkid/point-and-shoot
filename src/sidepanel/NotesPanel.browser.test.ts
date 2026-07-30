/// <reference lib="dom" />

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { type Note, SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const NOTES_PANEL_HARNESS = new URL("tests/e2e/notes-panel-harness.tsx", ROOT);

interface NotesPanelHarness {
  mount(theme: "dark" | "light", sizeBudgetBytes?: number): void;
  mountWithLoadError(theme: "dark" | "light", message: string): void;
  mountWithSaveError(theme: "dark" | "light", message: string): void;
  seed(session: Session): Promise<void>;
  setTheme(theme: "dark" | "light"): void;
  unmount(): void;
}

function makeNote(
  id: string,
  pageUrl: string,
  text: string,
  tagClasses: string,
): Note {
  return {
    createdAt: "2026-07-28T12:00:00.000Z",
    elements: [{
      selectors: {
        cssPath: [`#${id}`],
        reachable: true,
        tagClasses,
        testIds: [],
        textSnippet: text,
        xpath: [`//*[@id='${id}']`],
      },
      styleDigest: null,
    }],
    id,
    pageTitle: pageUrl.includes("checkout") ? "Checkout" : "Pricing",
    pageUrl,
    region: {
      box: { height: 50, width: 100, x: 10, y: 20 },
      screenshot: "data:image/webp;base64,V0VCUA==",
      truncated: id === "note-3",
      viewport: { height: 600, width: 800 },
    },
    text,
  };
}

const SESSION: Session = {
  createdAt: "2026-07-28T12:00:00.000Z",
  endedAt: null,
  id: "session-1",
  name: "Checkout review",
  notes: [
    makeNote(
      "note-1",
      "https://example.com/checkout?access_token=secret",
      "Button is misaligned.",
      "button.primary",
    ),
    makeNote("note-2", "https://example.com/pricing", "Price wraps.", "section.pricing"),
    makeNote(
      "note-3",
      "https://example.com/checkout?access_token=other",
      "Label is clipped.",
      "label.field",
    ),
  ],
  schemaVersion: SCHEMA_VERSION,
};

async function bundleNotesPanelHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(NOTES_PANEL_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("notes panel test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("notes panel reviews and persists a captured session in both themes", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { height: 600, width: 900 } });
    await page.goto(`${fixture.base}/notes-panel-test.html`);
    await page.addScriptTag({ content: await bundleNotesPanelHarness() });
    await page.evaluate(async (session) => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      await harness.seed(session);
      harness.mount("dark", 100);
    }, SESSION);

    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    assertEquals(await page.locator("[data-page-key]").count(), 2);
    assertEquals(
      await page.locator("[data-note-id]").evaluateAll((notes) =>
        notes.map((note) => note.getAttribute("data-note-id"))
      ),
      ["note-1", "note-3"],
    );
    assertEquals(
      await page.locator('[data-note-id="note-1"] [data-recorded-url]').getAttribute("title"),
      SESSION.notes[0]?.pageUrl,
    );
    assertEquals(
      await page.locator('[data-note-id="note-1"] [data-xpath]').getAttribute("title"),
      "//*[@id='note-1']",
    );
    assertEquals(
      await page.locator("[data-note-id] .ps-capture-minimap__region").count(),
      0,
      "a region screenshot must not draw a second page-relative selection box over its crop",
    );
    assertEquals(
      await page.locator('[data-note-id="note-1"]')
        .getByRole("switch", { name: "Strip query when exporting" })
        .getAttribute("aria-checked"),
      "true",
    );
    assertEquals(
      await page.locator("[data-export-budget]").getAttribute("data-over-budget"),
      "true",
    );
    await page.getByRole("button", { name: "Compile plan" }).click();
    await page.getByRole("heading", { name: "Compile plan" }).waitFor();
    await page.getByRole("button", { name: "Back to notes" }).click();
    await page.getByRole("heading", { name: "Checkout review" }).waitFor();

    const darkBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      harness.setTheme("light");
    });
    const lightBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    assertNotEquals(lightBackground, darkBackground);

    await page.locator('[data-note-id="note-1"]').getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("textbox", { name: "Note text" });
    await editor.fill("Button needs eight pixels more inset.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Button needs eight pixels more inset.").waitFor();

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      harness.unmount();
      harness.mount("light");
    });
    await page.getByText("Button needs eight pixels more inset.").waitFor();

    await page.locator('[data-note-id="note-3"]').getByRole("button", { name: "Move up" }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("[data-note-id]")]
        .map((note) => note.getAttribute("data-note-id"))
        .join(",") === "note-3,note-1"
    );
    assertEquals(
      await page.locator("[data-note-id]").evaluateAll((notes) =>
        notes.map((note) => note.getAttribute("data-note-id"))
      ),
      ["note-3", "note-1"],
    );

    await page.locator('[data-note-id="note-1"]').getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete note?" }).waitFor();
    await page.getByRole("button", { name: "Delete note" }).click();
    await page.locator('[data-note-id="note-1"]').waitFor({ state: "detached" });
    assertEquals(await page.locator('[data-note-id="note-1"]').count(), 0);

    await page.evaluate(async (session) => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      await harness.seed({ ...session, notes: [] });
      harness.unmount();
      harness.mount("dark");
    }, SESSION);
    await page.getByText("No notes yet. Highlight anything on the page to start one.").waitFor();

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      harness.unmount();
      harness.mountWithLoadError("dark", "The active session is unreadable.");
    });
    await page.getByRole("alert").getByText("The active session is unreadable.").waitFor();

    await page.evaluate(async (session) => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      await harness.seed(session);
      harness.unmount();
      harness.mountWithSaveError("light", "Storage quota is full.");
    }, SESSION);
    await page.getByText("Button is misaligned.").waitFor();
    await page.locator('[data-note-id="note-1"]').getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Note text" }).fill("This change must not persist.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("alert").getByText("Storage quota is full.").waitFor();
    assertEquals(await page.getByText("Button is misaligned.").count(), 1);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("notes panel reloads when a session becomes available while it is open", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { height: 600, width: 900 } });
    await page.goto(`${fixture.base}/notes-panel-test.html`);
    await page.addScriptTag({ content: await bundleNotesPanelHarness() });
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      harness.mount("dark");
    });
    await page.getByRole("heading", { exact: true, name: "Notes" }).waitFor();

    await page.evaluate(async (session) => {
      const harness = (globalThis as unknown as {
        pointShootNotesPanelTest: NotesPanelHarness;
      }).pointShootNotesPanelTest;
      await harness.seed(session);
    }, SESSION);

    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    assertEquals(await page.getByText("Current session").count(), 1);
  } finally {
    await fixture.close();
    await browser.close();
  }
});
