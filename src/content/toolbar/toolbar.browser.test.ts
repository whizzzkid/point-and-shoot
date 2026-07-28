/// <reference lib="dom" />

import { assertEquals, assertGreaterOrEqual, assertLessOrEqual } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../../build/preact.ts";
import { startFixtureServer } from "../../../tests/fixtures/app/server.ts";
import type { PlacementRect } from "./placement.ts";

const ROOT = new URL("../../../", import.meta.url);
const TOOLBAR_HARNESS = new URL("tests/e2e/toolbar-harness.tsx", ROOT);
const VIEWPORT = { width: 1_000, height: 600 };

interface ToolbarHarness {
  choose(label: string): Promise<{
    readonly activeLabel: string | null | undefined;
    readonly labels: readonly (string | null | undefined)[];
    readonly noteCount: string | null | undefined;
    readonly sendDisabled: boolean | undefined;
    readonly sendVariant: string | undefined;
  }>;
  controls(): {
    readonly activeLabel: string | null | undefined;
    readonly labels: readonly (string | null | undefined)[];
    readonly noteCount: string | null | undefined;
    readonly sendDisabled: boolean | undefined;
    readonly sendVariant: string | undefined;
  };
  destroy(): void;
  place(selection?: PlacementRect, composer?: PlacementRect): Promise<PlacementRect>;
  stickyHeaderRect(): PlacementRect;
}

async function bundleToolbarHarness(): Promise<string> {
  try {
    const buildOutput = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(TOOLBAR_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = buildOutput.outputFiles?.[0];
    if (bundle === undefined) throw new Error("toolbar test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

function overlaps(first: PlacementRect, second: PlacementRect): boolean {
  return first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top;
}

Deno.test("floating toolbar - browser geometry clears quadrants, sticky chrome, and composer", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`${fixture.base}/tall.html`);
    await page.addScriptTag({ content: await bundleToolbarHarness() });
    const outcomes = await page.evaluate(async (selections) => {
      const harness = (globalThis as unknown as {
        pointShootToolbarTest: ToolbarHarness;
      }).pointShootToolbarTest;
      const stickyHeader = harness.stickyHeaderRect();
      const placements = [];
      for (const selection of selections) {
        placements.push({
          selection,
          stickyHeader,
          toolbar: await harness.place(selection),
        });
      }
      const composer = { left: 230, top: 490, width: 540, height: 86 };
      const selection = { left: 700, top: 24, width: 276, height: 180 };
      return {
        composer,
        composerPlacement: await harness.place(selection, composer),
        placements,
        selection,
      };
    }, [
      { left: 40, top: 80, width: 200, height: 140 },
      { left: 760, top: 80, width: 200, height: 140 },
      { left: 40, top: 430, width: 320, height: 140 },
      { left: 640, top: 430, width: 320, height: 140 },
    ]);

    for (const { selection, stickyHeader, toolbar } of outcomes.placements) {
      assertEquals(
        overlaps(toolbar, selection),
        false,
        `toolbar overlaps selection: ${JSON.stringify({ selection, toolbar })}`,
      );
      assertEquals(
        overlaps(toolbar, stickyHeader),
        false,
        `toolbar overlaps sticky header: ${JSON.stringify({ stickyHeader, toolbar })}`,
      );
      assertGreaterOrEqual(toolbar.left, 24);
      assertGreaterOrEqual(toolbar.top, 24);
      assertLessOrEqual(toolbar.left + toolbar.width, VIEWPORT.width - 24);
      assertLessOrEqual(toolbar.top + toolbar.height, VIEWPORT.height - 24);
    }
    assertEquals(overlaps(outcomes.composerPlacement, outcomes.selection), false);
    assertEquals(overlaps(outcomes.composerPlacement, outcomes.composer), false);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("floating toolbar - approved controls expose one pressed tool and disabled send", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`${fixture.base}/tall.html`);
    await page.addScriptTag({ content: await bundleToolbarHarness() });
    const states = await page.evaluate(async () => {
      const harness = (globalThis as unknown as {
        pointShootToolbarTest: ToolbarHarness;
      }).pointShootToolbarTest;
      await harness.place();
      return {
        initial: harness.controls(),
        screenshot: await harness.choose("Screenshot"),
      };
    });

    assertEquals(states.initial, {
      activeLabel: "Select",
      labels: ["Select", "Screenshot", "Note", "Send to agent"],
      noteCount: "0 notes",
      sendDisabled: true,
      sendVariant: "primary",
    });
    assertEquals(states.screenshot.activeLabel, "Screenshot");
  } finally {
    await browser.close();
    await fixture.close();
  }
});
