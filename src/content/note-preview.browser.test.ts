/// <reference lib="dom" />

import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../", import.meta.url);
const HARNESS = new URL("tests/e2e/note-preview-harness.ts", ROOT);

interface PreviewHarness {
  clear(): boolean;
  destroy(): void;
  hostCount(): number;
  show(selectors: {
    readonly ariaRoleName?: { readonly name: string; readonly role: string };
    readonly cssPath: readonly string[];
    readonly reachable: true;
    readonly tagClasses: string;
    readonly testIds: readonly {
      readonly attribute: "data-testid" | "data-test" | "data-cy" | "id";
      readonly value: string;
    }[];
    readonly textSnippet: string;
    readonly xpath: readonly string[];
  }): boolean;
  staleClear(): boolean;
}

async function bundleHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(HARNESS)],
      format: "iife",
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("note preview harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("note preview resolves trust-order fallbacks and cleans up stale or navigated UI", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleHarness() });
    const result = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootNotePreviewTest: PreviewHarness;
      }).pointShootNotePreviewTest;
      const action = document.querySelector<HTMLElement>('[data-testid="light-action"]');
      if (action === null) throw new Error("light fixture is missing its action");
      const originalStyle = action.getAttribute("style");
      const base = {
        cssPath: ["[data-testid='light-action']"],
        reachable: true as const,
        tagClasses: "button",
        testIds: [],
        textSnippet: "Open capture",
        xpath: ["/html/body/div[1]/button"],
      };
      const stable = harness.show({
        ...base,
        cssPath: ["#stale"],
        testIds: [{ attribute: "data-testid", value: "light-action" }],
        xpath: ["/html/body/missing"],
      });
      const closedRoot = document.querySelector("[data-point-and-shoot-preview-host]")?.shadowRoot;
      const stalePreserved = harness.staleClear();
      const aria = harness.show({
        ...base,
        ariaRoleName: { name: action.textContent?.trim() ?? "", role: "button" },
        cssPath: ["#stale"],
        xpath: ["/html/body/missing"],
      });
      const css = harness.show(base);
      const stale = harness.show({
        ...base,
        cssPath: ["["],
        xpath: ["["],
      });
      const xpath = harness.show({
        ...base,
        cssPath: ["#stale"],
      });
      const unchangedStyle = action.getAttribute("style");
      return {
        aria,
        closedRoot,
        css,
        hostCount: harness.hostCount(),
        originalStyle,
        stable,
        stale,
        stalePreserved,
        unchangedStyle,
        xpath,
      };
    });
    assertEquals(result, {
      aria: true,
      closedRoot: null,
      css: true,
      hostCount: 1,
      originalStyle: null,
      stable: true,
      stale: false,
      stalePreserved: true,
      unchangedStyle: null,
      xpath: true,
    });

    await page.evaluate(() => {
      history.pushState({}, "", "?navigated=true");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("[data-point-and-shoot-preview-host]").length === 0
    );
    assertEquals(
      await page.evaluate(() => {
        const harness = (globalThis as unknown as {
          pointShootNotePreviewTest: PreviewHarness;
        }).pointShootNotePreviewTest;
        return harness.show({
          cssPath: ["[data-testid='light-action']"],
          reachable: true,
          tagClasses: "button",
          testIds: [],
          textSnippet: "Action on light",
          xpath: ["/html/body/div[1]/button"],
        });
      }),
      true,
    );
  } finally {
    await browser.close();
    await fixture.close();
  }
});
