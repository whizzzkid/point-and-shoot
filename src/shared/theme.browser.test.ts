/// <reference lib="dom" />

import { assertEquals, assertLessOrEqual } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page } from "playwright";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const THEME_HARNESS = new URL("tests/e2e/theme-harness.ts", ROOT);

async function bundleThemeHarness(): Promise<string> {
  try {
    const buildOutput = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(THEME_HARNESS)],
      format: "iife",
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = buildOutput.outputFiles?.[0];
    if (bundle === undefined) throw new Error("theme test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

async function readFixtureTheme(page: Page, path: string): Promise<{
  readonly sampleCount: number;
  readonly theme: "dark" | "light";
}> {
  await page.goto(path);
  await page.addScriptTag({ content: await bundleThemeHarness() });
  return await page.evaluate(() => {
    const test = (globalThis as unknown as {
      pointShootThemeTest: {
        sampleBottom(): {
          readonly sampleCount: number;
          readonly theme: "dark" | "light";
        };
      };
    }).pointShootThemeTest;
    return test.sampleBottom();
  });
}

Deno.test("sampleBackdrop - resolves bounded samples on the light and dark fixtures", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const light = await readFixtureTheme(page, `${fixture.base}/light.html`);
    const dark = await readFixtureTheme(page, `${fixture.base}/dark.html`);

    assertEquals(light.theme, "dark");
    assertEquals(dark.theme, "light");
    assertLessOrEqual(light.sampleCount, 5);
    assertLessOrEqual(dark.sampleCount, 5);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("sampleBackdrop - skips transparent layers and watchTheme debounces scroll", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleThemeHarness() });
    const outcomes = await page.evaluate(async () => {
      const panel = document.querySelector<HTMLElement>(".panel");
      if (panel === null) throw new Error("light fixture is missing its panel");
      const overlay = document.createElement("div");
      overlay.dataset.themeLayer = "";
      Object.assign(overlay.style, {
        background: "rgba(0, 0, 0, 0.1)",
        inset: "0",
        position: "absolute",
        zIndex: "1",
      });
      panel.style.position = "relative";
      panel.append(overlay);

      const test = (globalThis as unknown as {
        pointShootThemeTest: {
          readonly sampleCalls: number;
          readonly themes: readonly ("dark" | "light")[];
          sample(selector: string, ignoredSelector?: string): {
            readonly sampleCount: number;
            readonly theme: "dark" | "light";
          };
          startWatching(): void;
          stopWatching(): void;
        };
      }).pointShootThemeTest;
      const composited = test.sample(".panel");
      const sampled = test.sample(".panel", "[data-theme-layer]");
      test.startWatching();
      for (let index = 0; index < 6; index += 1) {
        globalThis.dispatchEvent(new Event("scroll"));
      }
      await new Promise((resolve) => setTimeout(resolve, 75));
      const watched = {
        sampleCalls: test.sampleCalls,
        themes: [...test.themes],
      };
      test.stopWatching();
      test.startWatching();
      globalThis.dispatchEvent(new Event("scroll"));
      test.stopWatching();
      await new Promise((resolve) => setTimeout(resolve, 75));
      const cancelledSampleCalls = test.sampleCalls;
      return { cancelledSampleCalls, composited, sampled, watched };
    });

    assertEquals(outcomes.composited.theme, "dark");
    assertEquals(outcomes.sampled.theme, "dark");
    assertEquals(outcomes.watched.sampleCalls, 2);
    assertEquals(outcomes.watched.themes, ["dark"]);
    assertEquals(outcomes.cancelledSampleCalls, 1);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
