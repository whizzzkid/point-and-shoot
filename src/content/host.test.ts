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

Deno.test("shadow host follows the fullscreen element and restores its viewport parent", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleHostHarness() });

    const state = await page.evaluate(() => {
      const test = (globalThis as unknown as {
        pointShootHostTest: {
          destroy(): void;
          host: HTMLElement;
        };
      }).pointShootHostTest;
      const fullscreenSurface = document.createElement("div");
      document.body.append(fullscreenSurface);
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: fullscreenSurface,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
      const fullscreen = {
        parented: test.host.parentElement === fullscreenSurface,
        position: test.host.style.getPropertyValue("position"),
      };

      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: null,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
      const restored = {
        parented: test.host.parentElement === document.documentElement,
        position: test.host.style.getPropertyValue("position"),
      };
      test.destroy();
      return { fullscreen, restored };
    });

    assertEquals(state, {
      fullscreen: { parented: true, position: "absolute" },
      restored: { parented: true, position: "fixed" },
    });
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("shadow host rejects an invalid inline icon sprite without leaking page state", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleHostHarness() });

    const result = await page.evaluate(() => {
      const test = (globalThis as unknown as {
        pointShootHostTest: {
          invalidSpriteResult(): {
            readonly hostCount: number;
            readonly message: string;
            readonly sheetCount: number;
          };
        };
      }).pointShootHostTest;
      return test.invalidSpriteResult();
    });

    assertEquals(result, {
      hostCount: 0,
      message: "shadow host received an invalid icon sprite",
      sheetCount: 0,
    });
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("shadow host rejects sprite parsing in a document without a window", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleHostHarness() });

    const message = await page.evaluate(() => {
      const test = (globalThis as unknown as {
        pointShootHostTest: {
          detachedDocumentSpriteResult(): string;
        };
      }).pointShootHostTest;
      return test.detachedDocumentSpriteResult();
    });

    assertEquals(message, "shadow host cannot parse the icon sprite");
  } finally {
    await browser.close();
    await fixture.close();
  }
});
