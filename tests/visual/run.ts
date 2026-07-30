/// <reference lib="dom" />

/**
 * Captures and compares every shipped extension surface in both forced themes.
 *
 * Run on Linux with `deno task visual:update` to intentionally replace committed baselines.
 * Ordinary `deno task visual` runs leave actual, expected, and diff artifacts under
 * `playwright-report/visual/` when a comparison exceeds the settled tolerance.
 *
 * @module
 */

import { fromFileUrl, join } from "@std/path";
import { chromium, type Page } from "playwright";
import { startGalleryServer } from "../../src/ui/gallery/server.ts";
import {
  captureWave3Shots,
  shotOutputPath,
  type Wave3ShotTheme,
  WAVE_3_SHOT_SURFACES,
  WAVE_3_SHOT_THEMES,
} from "../wave-3-shots.ts";
import { compareVisualSnapshot } from "./compare.ts";

const BASELINE_DIRECTORY = fromFileUrl(new URL("./baselines/", import.meta.url));
const REPORT_DIRECTORY = "playwright-report/visual";
const ACTUAL_DIRECTORY = `${REPORT_DIRECTORY}/actual`;
const DIFF_ARTIFACT_DIRECTORY = `${REPORT_DIRECTORY}/diffs`;
const GALLERY_VIEWPORT = { height: 800, width: 1_280 };
const MAXIMUM_DIFF_PIXEL_RATIO = 0.001;

const SURFACES = ["gallery", ...WAVE_3_SHOT_SURFACES] as const;
type Surface = typeof SURFACES[number];

interface SnapshotComparisonOptions {
  readonly update: boolean;
}

function snapshotName(surface: Surface, theme: Wave3ShotTheme): string {
  return `${surface}-${theme}`;
}

function outputPath(surface: Surface, theme: Wave3ShotTheme): string {
  return surface === "gallery"
    ? join(ACTUAL_DIRECTORY, `${snapshotName(surface, theme)}.png`)
    : shotOutputPath(surface, theme, ACTUAL_DIRECTORY);
}

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function captureGallery(): Promise<void> {
  const browser = await chromium.launch();
  const gallery = await startGalleryServer();
  try {
    const page = await browser.newPage({ viewport: GALLERY_VIEWPORT });
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(gallery.url, { waitUntil: "load" });
    await waitForFonts(page);
    for (const theme of WAVE_3_SHOT_THEMES) {
      const galleryTheme = page.locator(`.gallery-theme[data-theme="${theme}"]`);
      await galleryTheme.waitFor({ state: "visible" });
      await galleryTheme.screenshot({
        animations: "disabled",
        path: outputPath("gallery", theme),
      });
    }
    if (runtimeErrors.length > 0) {
      throw new Error(`component gallery logged errors:\n${runtimeErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
    await gallery.close();
  }
}

async function compareSnapshots(options: SnapshotComparisonOptions): Promise<void> {
  const failures: string[] = [];
  for (const surface of SURFACES) {
    for (const theme of WAVE_3_SHOT_THEMES) {
      const name = snapshotName(surface, theme);
      try {
        const result = await compareVisualSnapshot({
          actualPath: outputPath(surface, theme),
          artifactDirectory: DIFF_ARTIFACT_DIRECTORY,
          baselinePath: join(BASELINE_DIRECTORY, `${name}.png`),
          maxDiffPixelRatio: MAXIMUM_DIFF_PIXEL_RATIO,
          snapshotName: name,
          update: options.update,
        });
        console.log(
          `${options.update ? "updated" : "matched"} ${name}: ` +
            `${result.diffPixels}/${result.totalPixels} pixels differ`,
        );
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`visual regression failures:\n${failures.join("\n")}`);
  }
}

async function main(): Promise<void> {
  const unknownArguments = Deno.args.filter((argument) => argument !== "--update");
  if (unknownArguments.length > 0) {
    throw new Error(`unknown visual test arguments: ${unknownArguments.join(", ")}`);
  }
  const update = Deno.args.includes("--update");
  await Deno.remove(REPORT_DIRECTORY, { recursive: true }).catch((error: unknown) => {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  });
  await Deno.mkdir(ACTUAL_DIRECTORY, { recursive: true });
  await captureWave3Shots(ACTUAL_DIRECTORY);
  await captureGallery();
  await compareSnapshots({ update });
}

if (import.meta.main) {
  await main();
}
