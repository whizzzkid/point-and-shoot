/// <reference lib="dom" />

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const OPTIONS_HARNESS = new URL("tests/e2e/options-harness.tsx", ROOT);

interface OptionsHarness {
  readonly actionLog: { clears: number; shortcutSettings: number };
  failNextSaves(count?: number): void;
  mount(theme: "dark" | "light"): void;
  reset(): void;
  unmount(): void;
}

async function bundleOptionsHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(OPTIONS_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("options test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("options round-trip every setting and confirm destructive clearing", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { height: 700, width: 900 } });
    await page.goto(`${fixture.base}/notes-panel-test.html`);
    await page.addScriptTag({ content: await bundleOptionsHarness() });
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootOptionsTest: OptionsHarness;
      }).pointShootOptionsTest;
      harness.reset();
      harness.mount("dark");
    });

    await page.getByRole("heading", { name: "Settings" }).waitFor();
    const darkBackground = await page.evaluate(() =>
      getComputedStyle(document.querySelector("main")!).backgroundColor
    );
    await page.getByLabel("Theme").selectOption("light");
    await page.getByRole("switch", { name: "Framework component hints" }).click();
    await page.getByRole("tab", { name: "Capture" }).click();
    await page.getByLabel("Screenshot quality").selectOption("0.85");
    await page.getByLabel("Maximum screenshot dimension").selectOption("2048");
    await page.getByRole("tab", { name: "Export & privacy" }).click();
    await page.getByLabel("Export warning threshold").selectOption("8000000");
    await page.getByRole("switch", { name: "Strip sensitive query strings" }).click();
    await page.getByText("Saved.").waitFor();

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootOptionsTest: OptionsHarness;
      }).pointShootOptionsTest;
      harness.unmount();
      harness.mount("dark");
    });
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    await page.waitForFunction(() =>
      (document.querySelector("select") as HTMLSelectElement | null)?.value === "light"
    );
    const lightBackground = await page.evaluate(() =>
      getComputedStyle(document.querySelector("main")!).backgroundColor
    );
    assertNotEquals(lightBackground, darkBackground);
    assertEquals(await page.getByLabel("Theme").inputValue(), "light");
    assertEquals(
      await page.getByRole("switch", { name: "Framework component hints" }).getAttribute(
        "aria-checked",
      ),
      "true",
    );
    await page.getByRole("tab", { name: "Capture" }).click();
    assertEquals(await page.getByLabel("Screenshot quality").inputValue(), "0.85");
    assertEquals(await page.getByLabel("Maximum screenshot dimension").inputValue(), "2048");
    await page.getByRole("tab", { name: "Export & privacy" }).click();
    assertEquals(await page.getByLabel("Export warning threshold").inputValue(), "8000000");
    assertEquals(
      await page.getByRole("switch", { name: "Strip sensitive query strings" }).getAttribute(
        "aria-checked",
      ),
      "false",
    );

    await page.getByRole("tab", { name: "Shortcuts" }).click();
    await page.getByText("Command+Shift+P").waitFor();
    await page.getByRole("button", { name: "Manage browser shortcuts" }).click();
    await page.getByRole("tab", { name: "Data" }).click();
    await page.getByRole("button", { name: "Clear all sessions" }).click();
    await page.getByRole("dialog", { name: "Clear all sessions?" }).waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();
    assertEquals(
      await page.getByRole("dialog", { name: "Clear all sessions?" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Clear all sessions" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Clear all sessions" }).click();
    await page.getByText("All sessions cleared.").waitFor();
    assertEquals(
      await page.evaluate(() => {
        const harness = (globalThis as unknown as {
          pointShootOptionsTest: OptionsHarness;
        }).pointShootOptionsTest;
        return harness.actionLog;
      }),
      { clears: 1, shortcutSettings: 1 },
    );

    await page.getByRole("tab", { name: "General" }).click();
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootOptionsTest: OptionsHarness;
      }).pointShootOptionsTest;
      harness.failNextSaves();
    });
    await page.getByLabel("Theme").selectOption("dark");
    await page.getByRole("alert").getByText("Settings could not be saved.").waitFor();
    assertEquals(await page.getByLabel("Theme").inputValue(), "light");

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootOptionsTest: OptionsHarness;
      }).pointShootOptionsTest;
      harness.failNextSaves(2);
    });
    await page.getByLabel("Theme").selectOption("dark");
    await page.getByLabel("Theme").selectOption("auto");
    await page.getByRole("alert").getByText("Settings could not be saved.").waitFor();
    assertEquals(await page.getByLabel("Theme").inputValue(), "light");
  } finally {
    await browser.close();
    await fixture.close();
  }
});
