/// <reference lib="dom" />

import { assertEquals, assertGreater } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium, type Page } from "playwright";
import { preactResolverPlugin } from "../../../build/preact.ts";
import { startFixtureServer } from "../../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../../", import.meta.url);
const PICKER_HARNESS = new URL("tests/e2e/picker-harness.ts", ROOT);

interface PickerHarness {
  capture(selector: string): {
    readonly primary: boolean;
    readonly reachable: boolean;
    readonly tagClasses: string;
    readonly textSnippet: string;
    readonly width: number | undefined;
  };
  captureClosedInterior(): {
    readonly reachable: boolean;
    readonly styleDigest: unknown;
    readonly unreachable: string | undefined;
  };
  collect(
    rect: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    },
    primarySelector?: string,
  ): {
    readonly count: number;
    readonly identities: readonly string[];
    readonly primaryCount: number;
  };
  navigate(selector: string, direction: "parent" | "child" | "next" | "previous"): string;
  resolve(x: number, y: number): {
    readonly identity?: string;
    readonly kind: string;
    readonly reason?: string;
  };
}

async function bundlePickerHarness(): Promise<string> {
  try {
    const buildOutput = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(PICKER_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = buildOutput.outputFiles?.[0];
    if (bundle === undefined) throw new Error("picker test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

async function loadHarness(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.addScriptTag({ content: await bundlePickerHarness() });
}

Deno.test("picker engine captures ambiguous and identity-free elements with live evidence", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 900 } });
    await loadHarness(page, `${fixture.base}/index.html`);
    const captures = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerTest: PickerHarness;
      }).pointShootPickerTest;
      return {
        ambiguous: harness.capture("#ambiguous-classes .card:nth-child(3)"),
        identityFree: harness.capture("#without-identity em"),
      };
    });

    assertEquals(captures.ambiguous.primary, true);
    assertEquals(captures.ambiguous.reachable, true);
    assertEquals(captures.ambiguous.textSnippet, "Third card");
    assertGreater(captures.ambiguous.width ?? 0, 0);
    assertEquals(captures.identityFree.tagClasses, "em");
    assertEquals(captures.identityFree.reachable, true);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("picker engine traverses by keyboard and caps drag captures in DOM order", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 900 } });
    await loadHarness(page, `${fixture.base}/index.html`);
    const state = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerTest: PickerHarness;
      }).pointShootPickerTest;
      const row = document.querySelector("#without-identity .row");
      if (row === null) throw new Error("fixture row is missing");
      const rect = row.getBoundingClientRect();
      const crowded = document.createElement("section");
      crowded.style.display = "grid";
      crowded.style.gridTemplateColumns = "repeat(6, 1fr)";
      for (let index = 0; index < 30; index++) {
        const button = document.createElement("button");
        button.dataset.testid = `drag-${String(index).padStart(2, "0")}`;
        button.textContent = `Drag ${index}`;
        crowded.append(button);
      }
      const hidden = document.createElement("span");
      hidden.dataset.testid = "zero-box";
      hidden.style.display = "none";
      crowded.append(hidden);
      document.body.append(crowded);
      const crowdedRect = crowded.getBoundingClientRect();
      return {
        child: harness.navigate("#without-identity .row", "child"),
        next: harness.navigate("#without-identity span", "next"),
        parent: harness.navigate("#without-identity span", "parent"),
        previous: harness.navigate("#without-identity em", "previous"),
        rowCapture: harness.collect(
          { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          "#without-identity em",
        ),
        crowdedCapture: harness.collect({
          left: crowdedRect.left,
          top: crowdedRect.top,
          width: crowdedRect.width,
          height: crowdedRect.height,
        }),
      };
    });

    assertEquals(state.child, "Untagged label");
    assertEquals(state.next, "Emphasised run of text");
    assertEquals(state.parent, "Untagged label Emphasised run of text In-page link");
    assertEquals(state.previous, "Untagged label");
    assertEquals(state.rowCapture.primaryCount, 1);
    assertEquals(state.crowdedCapture.count, 25);
    assertEquals(state.crowdedCapture.primaryCount, 1);
    assertEquals(state.crowdedCapture.identities.includes("zero-box"), false);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("picker engine preserves closed-root, cross-origin, and canvas limitations", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1_000, height: 800 } });
    await loadHarness(page, `${fixture.base}/shadow.html`);
    const shadow = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerTest: PickerHarness;
      }).pointShootPickerTest;
      const host = document.querySelector<HTMLElement>("#open-host");
      const button = host?.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="open-shadow-button"]',
      );
      if (button === null || button === undefined) {
        throw new Error("open shadow fixture button is missing");
      }
      const rect = button.getBoundingClientRect();
      return {
        closed: harness.captureClosedInterior(),
        open: harness.resolve(rect.left + rect.width / 2, rect.top + rect.height / 2),
      };
    });
    assertEquals(shadow.closed, {
      reachable: false,
      styleDigest: null,
      unreachable: "closed-shadow-root",
    });
    assertEquals(shadow.open, { identity: "open-shadow-button", kind: "element" });

    await loadHarness(page, `${fixture.base}/iframe.html`);
    const crossOrigin = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerTest: PickerHarness;
      }).pointShootPickerTest;
      const frame = document.querySelector<HTMLIFrameElement>('[data-testid="cross-origin-frame"]');
      if (frame === null) throw new Error("cross-origin frame is missing");
      const rect = frame.getBoundingClientRect();
      return harness.resolve(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    assertEquals(crossOrigin, { kind: "unreachable", reason: "cross-origin-iframe" });

    await loadHarness(page, `${fixture.base}/canvas.html`);
    const canvas = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPickerTest: PickerHarness;
      }).pointShootPickerTest;
      return harness.capture('[data-testid="drawn-canvas"]');
    });
    assertEquals(canvas.reachable, true);
    assertEquals(canvas.textSnippet, "");
    assertGreater(canvas.width ?? 0, 0);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
