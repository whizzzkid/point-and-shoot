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
  readonly actionLog: {
    copies: string[][];
    bundleDownloads: string[][];
    promptDownloads: string[][];
    backs: number;
  };
  mount(
    theme: "dark" | "light",
    sizeBudgetBytes?: number,
    fail?: boolean,
    pending?: boolean,
    archiveFails?: boolean,
  ): void;
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
    await page.getByText("checkout-review.md", { exact: true }).waitFor();
    assertEquals(await page.getByText("plan.md", { exact: true }).count(), 0);
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
    await page.getByRole("button", { name: "Download prompt" }).click();
    await page.getByText("Prompt download started.").waitFor();
    await page.getByRole("button", { name: "Download bundle" }).click();
    await page.getByText("Bundle download started.").waitFor();
    assertEquals(
      await page.evaluate(() => {
        const harness = (globalThis as unknown as {
          pointShootPlanViewTest: PlanViewHarness;
        }).pointShootPlanViewTest;
        return {
          copies: harness.actionLog.copies,
          bundleDownloads: harness.actionLog.bundleDownloads,
          promptDownloads: harness.actionLog.promptDownloads,
        };
      }),
      {
        copies: [["note-button"]],
        bundleDownloads: [["note-button"]],
        promptDownloads: [["note-button"]],
      },
    );

    await page.getByRole("button", { name: "Exclude all" }).click();
    assertEquals(await page.getByText("Bundle download started.").count(), 0);
    assertEquals(await page.getByRole("button", { name: "Copy prompt" }).isDisabled(), true);
    assertEquals(
      await page.getByRole("button", { name: "Download prompt" }).isDisabled(),
      true,
    );
    assertEquals(
      await page.getByRole("button", { name: "Download bundle" }).isDisabled(),
      true,
    );

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.unmount();
      harness.mount("dark", 1);
    });
    await page.getByRole("alert").getByText(
      "The selected bundle is above the 1 byte warning threshold.",
    )
      .waitFor();
    assertEquals(await page.getByRole("button", { name: "Copy prompt" }).isEnabled(), true);
    assertEquals(await page.getByRole("button", { name: "Download prompt" }).isEnabled(), true);
    assertEquals(await page.getByRole("button", { name: "Download bundle" }).isEnabled(), true);

    await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootPlanViewTest: PlanViewHarness;
      }).pointShootPlanViewTest;
      harness.unmount();
      harness.mount("dark", 2_000_000, false, false, true);
    });
    await page.getByRole("alert").getByText("Screenshot must be a base64 WebP data URL").waitFor();
    assertEquals(await page.getByRole("button", { name: "Copy prompt" }).isEnabled(), true);
    assertEquals(await page.getByRole("button", { name: "Download prompt" }).isEnabled(), true);
    assertEquals(await page.getByRole("button", { name: "Download bundle" }).isDisabled(), true);

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
    await page.getByRole("button", { name: "Download bundle" }).click();
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
    await page.getByText("Bundle download started.").waitFor();

    await page.setViewportSize({ height: 900, width: 600 });
    for (const name of ["Copy prompt", "Download prompt", "Download bundle"]) {
      await page.getByRole("button", { name }).focus();
      assertEquals(await page.getByRole("button", { name }).isVisible(), true);
    }
  } finally {
    await browser.close();
    await fixture.close();
  }
});
