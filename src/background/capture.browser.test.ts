/// <reference lib="dom" />

import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page } from "playwright";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";
import type { CaptureRegionInput } from "./capture.ts";

const ROOT = new URL("../../", import.meta.url);
const CAPTURE_IMAGE_HARNESS = new URL("tests/e2e/capture-image-harness.ts", ROOT);
const DEVICE_PIXEL_RATIO = 2;
const MAXIMUM_WEBP_BYTES = 500_000;
const VIEWPORT = { height: 600, width: 800 };
const FIXTURE_PAGES = [
  "index.html",
  "shadow.html",
  "iframe.html",
  "canvas.html",
  "tall.html",
  "dark.html",
  "light.html",
] as const;

interface CaptureImageInspection {
  readonly box: CaptureRegionInput["region"];
  readonly byteLength: number;
  readonly height: number;
  readonly mediaType: string;
  readonly screenshotPrefix: string;
  readonly truncated: boolean;
  readonly viewport: CaptureRegionInput["viewport"];
  readonly width: number;
}

interface CaptureImageHarness {
  inspect(
    screenshot: string,
    input: CaptureRegionInput,
  ): Promise<CaptureImageInspection>;
}

async function bundleCaptureImageHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(CAPTURE_IMAGE_HARNESS)],
      format: "iife",
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("capture image test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

function pngDataUrl(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    let binary = "";
    for (const byte of bytes.subarray(offset, offset + chunkSize)) {
      binary += String.fromCharCode(byte);
    }
    chunks.push(binary);
  }
  return `data:image/png;base64,${btoa(chunks.join(""))}`;
}

async function inspectCapture(
  page: Page,
  input: CaptureRegionInput,
): Promise<CaptureImageInspection> {
  const screenshot = pngDataUrl(await page.screenshot({ scale: "device", type: "png" }));
  return await page.evaluate(
    ({ captureInput, source }) => {
      const captureHarness = (globalThis as unknown as {
        pointShootCaptureImageTest: CaptureImageHarness;
      }).pointShootCaptureImageTest;
      return captureHarness.inspect(source, captureInput);
    },
    { captureInput: input, source: screenshot },
  );
}

Deno.test("captureRegion crops every Chromium fixture at device scale", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const context = await browser.newContext({
      deviceScaleFactor: DEVICE_PIXEL_RATIO,
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    const harness = await bundleCaptureImageHarness();
    const input: CaptureRegionInput = {
      devicePixelRatio: DEVICE_PIXEL_RATIO,
      region: { height: 500, width: 700, x: 50, y: 40 },
      viewport: VIEWPORT,
    };
    for (const name of FIXTURE_PAGES) {
      await page.goto(`${fixture.base}/${name}`, { waitUntil: "load" });
      await page.waitForTimeout(50);
      await page.addScriptTag({ content: harness });
      const result = await inspectCapture(page, input);

      assertEquals(result.width, 1_024, name);
      assertEquals(result.height, 731, name);
      assertEquals(result.mediaType, "image/webp", name);
      assertEquals(result.screenshotPrefix, "data:image/webp;base64,", name);
      assert(result.byteLength > 100, `${name} produced an implausibly empty WebP`);
      assert(
        result.byteLength < MAXIMUM_WEBP_BYTES,
        `${name} exceeded the ${MAXIMUM_WEBP_BYTES}-byte WebP budget`,
      );
    }

    await page.goto(`${fixture.base}/tall.html`, { waitUntil: "load" });
    await page.addScriptTag({ content: harness });
    const tall = await inspectCapture(page, {
      devicePixelRatio: DEVICE_PIXEL_RATIO,
      region: { height: 2_400, width: VIEWPORT.width, x: 0, y: 0 },
      viewport: VIEWPORT,
    });
    assertEquals(tall.box, { height: VIEWPORT.height, width: VIEWPORT.width, x: 0, y: 0 });
    assertEquals(tall.viewport, VIEWPORT);
    assertEquals(tall.truncated, true);
    assertEquals({ height: tall.height, width: tall.width }, { height: 768, width: 1_024 });
  } finally {
    await browser.close();
    await fixture.close();
  }
});
