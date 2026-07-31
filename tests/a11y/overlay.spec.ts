/// <reference lib="dom" />

/**
 * Audits the production injected overlay inside its closed shadow root.
 *
 * Named `.spec.ts` so the fast unit gate does not launch Chromium. Run through `deno task a11y`.
 *
 * @module
 */

import { assertEquals, assertGreaterOrEqual } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../fixtures/app/server.ts";
import { assertNoBlockingAxeViolations, installAxe, type SerializableAxeViolation } from "./axe.ts";
import { compositeColors, contrastRatio, parseCssColor } from "./contrast.ts";

const ROOT = new URL("../../", import.meta.url);
const OVERLAY_HARNESS = new URL("tests/a11y/overlay-harness.tsx", ROOT);
const THEMES = ["dark", "light"] as const;

interface OverlayA11yHarness {
  axeViolations(): Promise<readonly SerializableAxeViolation[]>;
  contrastSamples(): {
    readonly highlightBorder: string;
    readonly pageBackground: string;
    readonly targetBackground: string;
    readonly toolbarActionBackground: string;
    readonly toolbarActionForeground: string;
    readonly toolbarBackground: string;
    readonly toolbarIconForeground: string;
    readonly toolbarTextBackground: string;
    readonly toolbarTextForeground: string;
  };
  motionOffenders(): readonly {
    readonly animationDuration: string;
    readonly animationName: string;
    readonly target: string;
    readonly transitionDuration: string;
  }[];
  overlayCount(): number;
}

async function bundleOverlayHarness(): Promise<string> {
  try {
    const result = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(OVERLAY_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = result.outputFiles?.[0];
    if (bundle === undefined) {
      throw new Error("overlay accessibility harness emitted no JavaScript");
    }
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

async function prepareOverlay(
  page: Page,
  fixtureBase: string,
  theme: typeof THEMES[number],
  harnessSource: string,
  runtimeErrors: string[],
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${fixtureBase}/${theme}.html`);
  await page.evaluate((forcedTheme) => {
    const target = document.querySelector<HTMLElement>(".panel");
    if (target === null) throw new Error("contrast fixture panel is missing");
    target.dataset.a11yTarget = "";
    target.tabIndex = 0;
    target.focus();
    document.documentElement.dataset.a11yTheme = forcedTheme;
  }, theme);
  await installAxe(page);
  await page.addScriptTag({ content: harnessSource });
  try {
    await page.waitForFunction(
      () => {
        const harness = (globalThis as unknown as {
          readonly pointShootOverlayA11y?: OverlayA11yHarness;
        }).pointShootOverlayA11y;
        try {
          return harness?.contrastSamples().highlightBorder !== undefined;
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 5_000 },
    );
  } catch (error) {
    throw new Error(
      `${theme} overlay harness did not become ready: ${runtimeErrors.join("; ")}`,
      { cause: error },
    );
  }
}

Deno.test("overlay axe, contrast, Escape, and reduced motion pass in both themes", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  const harnessSource = await bundleOverlayHarness();
  try {
    for (const theme of THEMES) {
      const page = await browser.newPage({ viewport: { height: 800, width: 1_280 } });
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      try {
        await prepareOverlay(page, fixture.base, theme, harnessSource, runtimeErrors);
        const results = await page.evaluate(async () => {
          const harness = (globalThis as unknown as {
            readonly pointShootOverlayA11y: OverlayA11yHarness;
          }).pointShootOverlayA11y;
          return {
            contrast: harness.contrastSamples(),
            motionOffenders: harness.motionOffenders(),
            violations: await harness.axeViolations(),
          };
        });
        await assertNoBlockingAxeViolations(
          `${theme} injected overlay`,
          `overlay-${theme}`,
          results.violations,
        );

        const highlightRatio = contrastRatio(
          parseCssColor(results.contrast.highlightBorder),
          parseCssColor(results.contrast.targetBackground),
        );
        assertGreaterOrEqual(
          highlightRatio,
          3,
          `${theme} picker highlight does not meet WCAG AA non-text contrast`,
        );

        const toolbarSurface = compositeColors(
          parseCssColor(results.contrast.toolbarBackground),
          parseCssColor(results.contrast.pageBackground),
        );
        const toolbarTextSurface = compositeColors(
          parseCssColor(results.contrast.toolbarTextBackground),
          toolbarSurface,
        );
        const toolbarTextRatio = contrastRatio(
          parseCssColor(results.contrast.toolbarTextForeground),
          toolbarTextSurface,
        );
        assertGreaterOrEqual(
          toolbarTextRatio,
          4.5,
          `${theme} toolbar badge text contrast is ${toolbarTextRatio}`,
        );

        const toolbarActionSurface = compositeColors(
          parseCssColor(results.contrast.toolbarActionBackground),
          toolbarSurface,
        );
        const toolbarActionRatio = contrastRatio(
          parseCssColor(results.contrast.toolbarActionForeground),
          toolbarActionSurface,
        );
        assertGreaterOrEqual(
          toolbarActionRatio,
          4.5,
          `${theme} toolbar action contrast is ${toolbarActionRatio}`,
        );
        const toolbarIconRatio = contrastRatio(
          parseCssColor(results.contrast.toolbarIconForeground),
          toolbarSurface,
        );
        assertGreaterOrEqual(
          toolbarIconRatio,
          3,
          `${theme} toolbar icon contrast is ${toolbarIconRatio}`,
        );
        assertEquals(
          results.motionOffenders,
          [],
          `${theme} overlay retains reduced-motion effects`,
        );

        await page.keyboard.press("Enter");
        await page.keyboard.press("Escape");
        assertEquals(
          await page.evaluate(() =>
            (globalThis as unknown as {
              readonly pointShootOverlayA11y: OverlayA11yHarness;
            }).pointShootOverlayA11y.overlayCount()
          ),
          0,
          `${theme} picker did not exit from its pinned keyboard state`,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await fixture.close();
  }
});
