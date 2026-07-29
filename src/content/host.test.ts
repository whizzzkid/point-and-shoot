/// <reference lib="dom" />

import { assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const HOST_HARNESS = new URL("tests/e2e/host-harness.tsx", ROOT);

async function bundleHostHarness(): Promise<string> {
  try {
    const buildOutput = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(HOST_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = buildOutput.outputFiles?.[0];
    if (bundle === undefined) throw new Error("host test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("shadow host isolates component styles from an aggressive page stylesheet", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addStyleTag({
      content: `
        * {
          color: rgb(1, 2, 3) !important;
          display: none !important;
          font-family: serif !important;
        }
      `,
    });
    await page.addScriptTag({ content: await bundleHostHarness() });

    const isolation = await page.evaluate(() => {
      const test = (globalThis as unknown as {
        pointShootHostTest: {
          documentSheetCount: number;
          host: HTMLElement;
          root: ShadowRoot;
          shadowButton: HTMLButtonElement;
        };
      }).pointShootHostTest;
      const pageButton = document.querySelector<HTMLButtonElement>('[data-testid="light-action"]');
      if (pageButton === null) throw new Error("light fixture is missing its action");
      return {
        documentSheetCount: test.documentSheetCount,
        hostDisplay: getComputedStyle(test.host).display,
        hostShadowRoot: test.host.shadowRoot,
        pageButtonColor: getComputedStyle(pageButton).color,
        pageButtonBackground: getComputedStyle(pageButton).backgroundColor,
        rootSheetCount: test.root.adoptedStyleSheets.length,
        shadowButtonBackground: getComputedStyle(test.shadowButton).backgroundColor,
        shadowButtonColor: getComputedStyle(test.shadowButton).color,
        shadowButtonFont: getComputedStyle(test.shadowButton).fontFamily,
      };
    });

    assertEquals(isolation.hostShadowRoot, null);
    assertEquals(isolation.hostDisplay, "block");
    assertEquals(isolation.rootSheetCount, 3);
    assertEquals(isolation.documentSheetCount, 1);
    assertEquals(isolation.pageButtonColor, "rgb(1, 2, 3)");
    assertNotEquals(isolation.pageButtonBackground, isolation.shadowButtonBackground);
    assertEquals(isolation.shadowButtonColor, "rgb(255, 255, 255)");
    assertStringIncludes(isolation.shadowButtonFont, "Inter");

    const teardown = await page.evaluate(() => {
      const test = (globalThis as unknown as {
        pointShootHostTest: {
          destroy(): void;
          host: HTMLElement;
        };
      }).pointShootHostTest;
      test.destroy();
      return {
        documentSheetCount: document.adoptedStyleSheets.length,
        hostConnected: test.host.isConnected,
      };
    });
    assertEquals(teardown.hostConnected, false);
    assertEquals(teardown.documentSheetCount, 0);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
