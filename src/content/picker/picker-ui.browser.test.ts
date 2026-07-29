/// <reference lib="dom" />

import { assertEquals, assertGreater } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../../build/preact.ts";
import { startFixtureServer } from "../../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../../", import.meta.url);
const PICKER_UI_HARNESS = new URL("tests/e2e/picker-ui-harness.tsx", ROOT);

interface PickerUiSummary {
  readonly activeLabel: string | null | undefined;
  readonly latestCount: number;
  readonly latestKind: string | undefined;
  readonly latestReason: string | undefined;
  readonly overlayCount: number;
  readonly preview:
    | {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    }
    | undefined;
  readonly primaryCount: number;
}

interface PickerUiHarness {
  reenter(): Promise<void>;
  reset(): void;
  summary(): PickerUiSummary;
}

async function bundlePickerUiHarness(): Promise<string> {
  try {
    const buildOutput = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(PICKER_UI_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = buildOutput.outputFiles?.[0];
    if (bundle === undefined) throw new Error("picker UI test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("element picker highlights, pins, drags, and Escape removes every overlay", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 900 } });
    await page.goto(`${fixture.base}/index.html`);
    await page.addScriptTag({ content: await bundlePickerUiHarness() });
    const target = page.locator("#ambiguous-classes .card").nth(2);
    const targetRect = await target.boundingBox();
    if (targetRect === null) throw new Error("ambiguous fixture target has no box");
    const originalStyle = await target.getAttribute("style");

    await page.mouse.move(
      targetRect.x + targetRect.width / 2,
      targetRect.y + targetRect.height / 2,
    );
    await page.waitForTimeout(30);
    const hover = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(hover.overlayCount, 1);
    assertGreater(hover.preview?.width ?? 0, 0);
    assertEquals(await target.getAttribute("style"), originalStyle);

    await page.mouse.click(
      targetRect.x + targetRect.width / 2,
      targetRect.y + targetRect.height / 2,
    );
    const pinned = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(pinned.latestKind, "elements");
    assertEquals(pinned.latestCount, 1);
    assertEquals(pinned.primaryCount, 1);
    const pinnedPreview = pinned.preview;
    const otherTargetRect = await page.locator("#ambiguous-classes .card").nth(0).boundingBox();
    if (otherTargetRect === null) throw new Error("other ambiguous target has no box");
    await page.mouse.move(
      otherTargetRect.x + otherTargetRect.width / 2,
      otherTargetRect.y + otherTargetRect.height / 2,
    );
    const afterMove = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(afterMove.preview, pinnedPreview);

    await page.keyboard.press("Escape");
    const escaped = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(escaped.overlayCount, 0);
    assertEquals(escaped.preview, undefined);
    assertEquals(escaped.activeLabel, undefined);

    await page.evaluate(async () => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      harness.reset();
      await harness.reenter();
    });
    const reentered = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(reentered.activeLabel, "Select");
    const row = page.locator("#without-identity .row");
    const rowRect = await row.boundingBox();
    if (rowRect === null) throw new Error("identity-free row has no box");
    await page.keyboard.down("Shift");
    await page.mouse.move(rowRect.x + 2, rowRect.y + 2);
    await page.mouse.down();
    await page.mouse.move(rowRect.x + rowRect.width - 2, rowRect.y + rowRect.height - 2);
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const dragged = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(dragged.latestKind, "elements");
    assertGreater(dragged.latestCount, 1);
    assertEquals(dragged.primaryCount, 1);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("element picker supports keyboard-only traversal and confirmation", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 900 } });
    await page.goto(`${fixture.base}/index.html`);
    await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>("#without-identity .row");
      if (row === null) throw new Error("identity-free row is missing");
      row.tabIndex = 0;
      row.focus();
    });
    await page.addScriptTag({ content: await bundlePickerUiHarness() });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    const confirmed = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(confirmed.latestKind, "elements");
    assertEquals(confirmed.latestCount, 1);
    assertEquals(confirmed.primaryCount, 1);
    assertGreater(confirmed.preview?.width ?? 0, 0);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("element picker reports a cross-origin iframe instead of silently selecting it", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 900 } });
    await page.goto(`${fixture.base}/iframe.html`);
    await page.addScriptTag({ content: await bundlePickerUiHarness() });
    const frameRect = await page.locator('[data-testid="cross-origin-frame"]').boundingBox();
    if (frameRect === null) throw new Error("cross-origin frame has no box");
    await page.mouse.move(
      frameRect.x + frameRect.width / 2,
      frameRect.y + frameRect.height / 2,
    );
    await page.mouse.click(
      frameRect.x + frameRect.width / 2,
      frameRect.y + frameRect.height / 2,
    );
    await page.waitForTimeout(30);

    const result = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(result.latestKind, "unreachable");
    assertEquals(result.latestReason, "cross-origin-iframe");
    await page.keyboard.press("Escape");
    const escaped = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerUiTest: PickerUiHarness;
      }).pointShootPickerUiTest;
      return harness.summary();
    });
    assertEquals(escaped.overlayCount, 0);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
