/// <reference lib="dom" />

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const CAPTURE_UI_HARNESS = new URL("tests/e2e/capture-ui-harness.tsx", ROOT);
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

interface CaptureUiHarness {
  begin(): void;
  finish(): Promise<string | undefined>;
  overlap(): Promise<{
    readonly afterBothComplete: string;
    readonly afterFirstCompletes: string;
    readonly whileBothActive: string;
  }>;
  request(response: unknown): Promise<{
    readonly capture?: unknown;
    readonly code?: string;
    readonly displayAfterRequest: string;
    readonly displayDuringRequest: string;
    readonly message: unknown;
    readonly ok: boolean;
  }>;
  state(): { readonly captureReady: boolean; readonly display: string };
}

async function bundleCaptureUiHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(CAPTURE_UI_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("capture UI test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

async function pixelFingerprint(page: Page, bytes: Uint8Array): Promise<string> {
  return await page.evaluate(
    async ({ encoded, offsetBasis, prime }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(encoded)], { type: "image/png" }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("could not create screenshot canvas context");
        context.drawImage(bitmap, 0, 0);
        let hash = offsetBasis;
        for (const byte of context.getImageData(0, 0, bitmap.width, bitmap.height).data) {
          hash = Math.imul(hash ^ byte, prime);
        }
        return `${bitmap.width}x${bitmap.height}:${hash >>> 0}`;
      } finally {
        bitmap.close();
      }
    },
    { encoded: [...bytes], offsetBasis: FNV_OFFSET_BASIS, prime: FNV_PRIME },
  );
}

Deno.test("captureWithoutOverlay excludes extension pixels and restores them", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 700 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${fixture.base}/index.html`);
    await page.waitForTimeout(100);
    await page.addScriptTag({ content: await bundleCaptureUiHarness() });
    await page.waitForTimeout(50);
    const visibleOverlay = await page.screenshot();
    const manuallyHidden = await page.evaluate(async () => {
      const host = document.querySelector<HTMLElement>("[data-point-and-shoot-host]");
      if (host === null) throw new Error("capture UI host was not mounted");
      host.style.setProperty("display", "none", "important");
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      return getComputedStyle(host).display;
    });
    assertEquals(manuallyHidden, "none");
    const baseline = await page.screenshot();
    await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>("[data-point-and-shoot-host]");
      if (host === null) throw new Error("capture UI host was not mounted");
      host.style.removeProperty("display");
    });
    assertNotEquals(
      await pixelFingerprint(page, visibleOverlay),
      await pixelFingerprint(page, baseline),
    );

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      harness.begin();
    });
    await page.waitForFunction(() => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      return harness.state().captureReady;
    });
    const hidden = await page.screenshot();
    assertEquals(
      await pixelFingerprint(page, hidden),
      await pixelFingerprint(page, baseline),
    );

    const restored = await page.evaluate(async () => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      const result = await harness.finish();
      return { result, state: harness.state() };
    });
    assertEquals(restored.result, "captured");
    assertEquals(restored.state.display, "block");

    const capture = {
      box: { height: 40, width: 30, x: 10, y: 20 },
      screenshot: "data:image/webp;base64,V0VCUA==",
      truncated: false,
      viewport: { height: 700, width: 1_000 },
    };
    const requested = await page.evaluate(async (response) => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      return await harness.request(response);
    }, { capture, ok: true });
    assertEquals(requested, {
      capture,
      displayAfterRequest: "block",
      displayDuringRequest: "none",
      message: {
        devicePixelRatio: 1,
        region: { height: 40, width: 30, x: 10, y: 20 },
        type: "point-and-shoot:capture-region",
        viewport: { height: 700, width: 1_000 },
      },
      ok: true,
    });

    const denied = await page.evaluate(async () => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      return await harness.request({
        error: { code: "permission-denied", message: "Active-tab access is required." },
        ok: false,
      });
    });
    assertEquals(denied.code, "permission-denied");
    assertEquals(denied.displayDuringRequest, "none");
    assertEquals(denied.displayAfterRequest, "block");

    const overlap = await page.evaluate(async () => {
      const harness = (globalThis as unknown as {
        pointShootCaptureUiTest: CaptureUiHarness;
      }).pointShootCaptureUiTest;
      return await harness.overlap();
    });
    assertEquals(overlap, {
      afterBothComplete: "block",
      afterFirstCompletes: "none",
      whileBothActive: "none",
    });
  } finally {
    await browser.close();
    await fixture.close();
  }
});
