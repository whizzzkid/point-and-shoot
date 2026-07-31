/// <reference lib="dom" />

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const POPUP_HARNESS = new URL("tests/e2e/popup-harness.tsx", ROOT);

interface PopupHarness {
  readonly actionLog: { notes: number; options: number; starts: number; toggles: number };
  mount(theme: "dark" | "light", hasSession: boolean, fail?: boolean): void;
  unmount(): void;
}

async function bundlePopupHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(POPUP_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("popup test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("popup launches every session action and renders both themes", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { height: 560, width: 380 } });
    await page.goto(`${fixture.base}/notes-panel-test.html`);
    await page.addScriptTag({ content: await bundlePopupHarness() });
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPopupTest: PopupHarness;
      }).pointShootPopupTest;
      harness.mount("dark", true);
    });

    await page.getByRole("heading", { name: "Checkout review" }).waitFor();
    await page.getByLabel("Version 0.1.0").waitFor();
    assertEquals(await page.getByLabel("Version 0.1.0").textContent(), "v0.1.0");
    await page.getByText("2 notes").waitFor();
    const overlay = page.getByRole("switch", { name: "Overlay on this tab" });
    assertEquals(await overlay.getAttribute("aria-checked"), "false");
    const darkBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    await overlay.click();
    assertEquals(await overlay.getAttribute("aria-checked"), "true");
    await page.getByRole("button", { name: "Open notes panel" }).click();
    await page.getByRole("button", { name: "Open options" }).click();
    assertEquals(
      await page.evaluate(() => {
        const harness = (globalThis as unknown as {
          pointShootPopupTest: PopupHarness;
        }).pointShootPopupTest;
        return harness.actionLog;
      }),
      { notes: 1, options: 1, starts: 0, toggles: 1 },
    );

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPopupTest: PopupHarness;
      }).pointShootPopupTest;
      harness.unmount();
      harness.mount("light", false);
    });
    await page.getByRole("heading", { name: "No active session" }).waitFor();
    const lightBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    assertNotEquals(lightBackground, darkBackground);
    await page.getByRole("button", { name: "Start session" }).click();
    await page.getByRole("heading", { name: "Untitled session" }).waitFor();
    assertEquals(await overlay.getAttribute("aria-checked"), "true");

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPopupTest: PopupHarness;
      }).pointShootPopupTest;
      harness.unmount();
      harness.mount("dark", false, true);
    });
    await page.getByRole("button", { name: "Start session" }).click();
    await page.getByRole("alert").getByText("The session could not start.").waitFor();
  } finally {
    await browser.close();
    await fixture.close();
  }
});
