/// <reference lib="dom" />

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../../build/preact.ts";
import { startFixtureServer } from "../../../tests/fixtures/app/server.ts";

const ROOT = new URL("../../../", import.meta.url);
const PLAN_VIEW_HARNESS = new URL("tests/e2e/plan-view-harness.tsx", ROOT);

interface PlanViewHarness {
  readonly actionLog: { copies: string[][]; downloads: string[][]; backs: number };
  mount(theme: "dark" | "light", sizeBudgetBytes?: number, fail?: boolean, pending?: boolean): void;
  resolveActions(): void;
  setTheme(theme: "dark" | "light"): void;
  unmount(): void;
}

async function bundlePlanViewHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(PLAN_VIEW_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("plan view test harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("plan view previews, filters, and delivers an export in both themes", async () => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();
  try {
    const page = await browser.newPage({ viewport: { height: 760, width: 1100 } });
    await page.goto(`${fixture.base}/notes-panel-test.html`);
    await page.addScriptTag({ content: await bundlePlanViewHarness() });
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.mount("dark");
    });

    await page.getByRole("heading", { name: "Compile plan" }).waitFor();
    const preview = page.locator("[data-markdown-preview]");
    await preview.getByText("The primary action is pushed against the card edge.").waitFor();
    assertEquals((await preview.textContent())?.includes("access_token"), false);
    assertEquals(await page.getByRole("checkbox").count(), 2);
    await page.getByText("Sensitive query parameters are stripped by default.").waitFor();
    await page.getByText("screenshots, page URLs, DOM text, selectors, and computed styles")
      .waitFor();
    assertEquals(
      await page.locator("[data-export-budget]").getAttribute("data-over-budget"),
      "false",
    );

    const darkBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.setTheme("light");
    });
    const lightBackground = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    assertNotEquals(lightBackground, darkBackground);

    await page.getByRole("checkbox", { name: "Include Order summary" }).uncheck();
    assertEquals((await preview.textContent())?.includes("total wraps"), false);
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await page.getByText("Prompt copied.").waitFor();
    await page.getByRole("button", { name: "Download for agent" }).click();
    await page.getByText("Agent bundle download started.").waitFor();
    assertEquals(
      await page.evaluate(() => {
        const harness = (globalThis as unknown as {
          pointShootPlanViewTest: PlanViewHarness;
        }).pointShootPlanViewTest;
        return {
          copies: harness.actionLog.copies,
          downloads: harness.actionLog.downloads,
        };
      }),
      {
        copies: [["note-button"]],
        downloads: [["note-button"]],
      },
    );

    await page.getByRole("button", { name: "Exclude all" }).click();
    assertEquals(await page.getByText("Agent bundle download started.").count(), 0);
    assertEquals(await page.getByRole("button", { name: "Copy prompt" }).isDisabled(), true);
    assertEquals(
      await page.getByRole("button", { name: "Download for agent" }).isDisabled(),
      true,
    );

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.unmount();
      harness.mount("dark", 1);
    });
    await page.getByRole("alert").getByText("The selected bundle is over the 1 byte limit.")
      .waitFor();
    assertEquals(await page.getByRole("button", { name: "Copy prompt" }).isDisabled(), true);

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.unmount();
      harness.mount("light", 2_000_000, true);
    });
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await page.getByRole("alert").getByText("Clipboard access was denied.").waitFor();

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.unmount();
      harness.mount("dark", 2_000_000, false, true);
    });
    await page.getByRole("button", { name: "Download for agent" }).click();
    assertEquals(
      await page.getByRole("checkbox", { name: "Include Checkout" }).isDisabled(),
      true,
    );
    assertEquals(await page.getByRole("button", { name: "Exclude all" }).isDisabled(), true);
    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.resolveActions();
    });
    await page.getByText("Agent bundle download started.").waitFor();
  } finally {
    await browser.close();
    await fixture.close();
  }
});
