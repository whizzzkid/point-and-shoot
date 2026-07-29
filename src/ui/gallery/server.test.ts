/// <reference lib="dom" />

import { assertEquals, assertStringIncludes } from "@std/assert";
import { chromium } from "playwright";
import { startGalleryServer } from "./server.ts";

const COMPONENT_NAMES = [
  "Badge",
  "Button",
  "CaptureMinimap",
  "Card",
  "Checkbox",
  "Dialog",
  "Icon",
  "IconButton",
  "Input",
  "Select",
  "Switch",
  "Tabs",
  "Tag",
  "Toast",
  "Tooltip",
] as const;

const STATE_COMPONENTS = {
  default: [
    "Badge",
    "Button",
    "CaptureMinimap",
    "Card",
    "Checkbox",
    "Dialog",
    "Icon",
    "IconButton",
    "Input",
    "Select",
    "Switch",
    "Tabs",
    "Tag",
    "Toast",
    "Tooltip",
  ],
  hover: [
    "Button",
    "CaptureMinimap",
    "Checkbox",
    "IconButton",
    "Input",
    "Select",
    "Switch",
    "Tabs",
    "Tag",
    "Tooltip",
  ],
  focus: [
    "Button",
    "CaptureMinimap",
    "Checkbox",
    "IconButton",
    "Input",
    "Select",
    "Switch",
    "Tabs",
    "Tag",
    "Tooltip",
  ],
  active: ["Button", "Checkbox", "IconButton", "Switch", "Tabs"],
  disabled: ["Button", "Checkbox"],
  error: ["Badge", "Input", "Toast"],
  loading: ["Button", "CaptureMinimap"],
  empty: ["Card"],
} as const;

Deno.test("gallery server - serves the Point and Shoot component gallery", async () => {
  const gallery = await startGalleryServer();

  try {
    const response = await fetch(gallery.url);
    assertEquals(response.status, 200);
    assertStringIncludes(await response.text(), "Point and Shoot component gallery");
  } finally {
    await gallery.close();
  }
});

Deno.test("gallery server - handles browser chrome and unknown resources", async () => {
  const gallery = await startGalleryServer();

  try {
    const favicon = await fetch(`${gallery.url}/favicon.ico`);
    assertEquals(favicon.status, 204);

    const missing = await fetch(`${gallery.url}/missing`);
    assertEquals(missing.status, 404);
    assertEquals(await missing.text(), "Not found\n");
  } finally {
    await gallery.close();
  }
});

Deno.test("Switch toggles once for one activation", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const toggle = page.getByRole("switch", { name: "Capture framework component names" });

    await toggle.click();

    assertEquals(await toggle.getAttribute("aria-checked"), "true");
    assertEquals(
      await page.getByTestId("switch-change-count").textContent(),
      "1",
    );
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Dialog traps focus and restores the opener when closed", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const opener = page.getByRole("button", { name: "Open dialog" });

    await opener.click();

    const dialog = page.getByRole("dialog", { name: "Send plan to agent?" });
    await dialog.waitFor();
    assertEquals(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Close dialog",
    );

    await page.keyboard.press("Shift+Tab");
    assertEquals(
      await page.evaluate(() => document.activeElement?.textContent),
      "Send plan",
    );

    await page.keyboard.press("Tab");
    assertEquals(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Close dialog",
    );

    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.waitForFunction(() => document.activeElement?.textContent === "Open dialog");
    assertEquals(
      await page.evaluate(() => document.activeElement?.textContent),
      "Open dialog",
    );
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Select is keyboard-reachable and propagates a changed option", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const harness = page.locator(".gallery-harness");
    const select = harness.getByRole("combobox", { name: "Target agent", exact: true });

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    assertEquals(await page.evaluate(() => document.activeElement?.tagName), "SELECT");
    await select.selectOption("cursor");
    assertEquals(await select.inputValue(), "cursor");
    assertEquals(await page.getByTestId("select-value").textContent(), "cursor");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Toast auto-dismisses and reports one close", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(7_000);
    await page.goto(gallery.url);
    const harness = page.locator(".gallery-harness");
    const staticToast = page.locator(
      '[data-theme="dark"] .gallery-grid [data-component="Toast"]',
    )
      .getByRole("status");

    await harness.getByRole("button", { name: "Show toast" }).click();

    const toast = harness.getByRole("status").filter({ hasText: "Note saved with screenshot" });
    assertStringIncludes((await toast.textContent()) ?? "", "Note saved with screenshot");
    await toast.waitFor({ state: "hidden" });
    await staticToast.waitFor({ state: "hidden" });
    assertEquals(await page.getByTestId("toast-close-count").textContent(), "1");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Tabs move selection and focus with arrow keys", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const harness = page.locator(".gallery-harness");
    const notesTab = harness.getByRole("tab", { name: "Notes" });
    const planTab = harness.getByRole("tab", { name: "Plan" });
    const settingsTab = harness.getByRole("tab", { name: "Settings" });

    await notesTab.focus();
    await page.keyboard.press("ArrowRight");
    assertEquals(await planTab.getAttribute("aria-selected"), "true");
    assertEquals(await page.evaluate(() => document.activeElement?.textContent), "Plan");

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assertEquals(await settingsTab.getAttribute("aria-selected"), "true");
    assertEquals(await page.getByTestId("tabs-value").textContent(), "Settings");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("gallery renders every component in both themes", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    await page.getByRole("heading", { name: "Point and Shoot component gallery" }).waitFor();

    for (const theme of ["dark", "light"]) {
      for (const component of COMPONENT_NAMES) {
        assertEquals(
          await page.locator(
            `[data-theme="${theme}"] .gallery-grid [data-component="${component}"]`,
          ).count(),
          1,
          `${component} is missing from the ${theme} gallery`,
        );
      }
    }
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("gallery renders every applicable component-state combination", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);

    for (const theme of ["dark", "light"]) {
      for (const [state, expectedComponents] of Object.entries(STATE_COMPONENTS)) {
        const stateGroup = page.locator(
          `[data-theme="${theme}"] [data-state="${state}"]`,
        );
        const renderedComponents = await stateGroup.locator("[data-component]")
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("data-component")).sort()
          );

        assertEquals(
          renderedComponents,
          [...expectedComponents].sort(),
          `${state} has an incomplete component matrix in the ${theme} gallery`,
        );
      }
    }
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("gallery keeps review-state Toast specimens visible", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(7_000);
    await page.goto(gallery.url);
    await page.waitForTimeout(5_500);

    for (const theme of ["dark", "light"]) {
      for (const state of ["default", "error"]) {
        const toast = page.locator(
          `[data-theme="${theme}"] [data-state="${state}"] [data-component="Toast"]`,
        );
        assertEquals(
          await toast.getByRole(state === "error" ? "alert" : "status").count(),
          1,
          `${state} Toast disappeared from the ${theme} gallery`,
        );
      }
    }
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Input and Checkbox propagate controlled values", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const input = page.getByRole("textbox", { name: "Behavior note" });
    const checkbox = page.getByRole("checkbox", { name: "Behavior DOM context" });

    await input.fill("The spacing is inconsistent.");
    await checkbox.click();

    assertEquals(
      await page.getByTestId("input-value").textContent(),
      "The spacing is inconsistent.",
    );
    assertEquals(await checkbox.isChecked(), true);
    assertEquals(await page.getByTestId("checkbox-value").textContent(), "true");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Button fires once while disabled Button and pressed IconButton expose their state", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const action = page.getByRole("button", { name: "Run component action" });
    const disabled = page.getByRole("button", { name: "Unavailable component action" });
    const activeTool = page.getByRole("button", { name: "Active component tool" });

    await action.click();

    assertEquals(await page.getByTestId("button-click-count").textContent(), "1");
    assertEquals(await disabled.isDisabled(), true);
    assertEquals(await activeTool.getAttribute("aria-pressed"), "true");
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Tag removal and Tooltip keyboard visibility are observable", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const darkTheme = page.locator('[data-theme="dark"]');
    const specimenGrid = darkTheme.locator(".gallery-grid");

    await specimenGrid.locator('[data-component="Tag"]').getByRole("button", {
      name: "Remove tag",
    }).click();
    assertStringIncludes(
      (await specimenGrid.locator('[data-component="Tag"]').textContent()) ?? "",
      "Tag removed",
    );

    const tooltipSpecimen = specimenGrid.locator('[data-component="Tooltip"]');
    const tooltipWrapper = tooltipSpecimen.locator(".ps-tooltip");
    const tooltipTrigger = tooltipSpecimen.getByRole("button", {
      name: "dark tooltip trigger",
    });
    assertEquals(await tooltipWrapper.getAttribute("aria-describedby"), null);
    await tooltipTrigger.focus();
    const tooltip = tooltipSpecimen.locator('[role="tooltip"]');
    assertEquals(await tooltip.getAttribute("aria-hidden"), "false");
    assertEquals(
      await tooltipWrapper.getAttribute("aria-describedby"),
      await tooltip.getAttribute("id"),
    );
    assertEquals(await tooltip.textContent(), "Capture region");
    await page.keyboard.press("Escape");
    assertEquals(await tooltip.getAttribute("aria-hidden"), "true");
    assertEquals(await tooltipWrapper.getAttribute("aria-describedby"), null);
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("Icon uses the vendored sprite and clipped CaptureMinimap exposes its warning", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.goto(gallery.url);
    const darkTheme = page.locator('[data-theme="dark"]');
    const iconUse = darkTheme.locator('[data-component="Icon"] use').first();
    const capture = darkTheme.getByRole("img", { name: "dark clipped captured region" });

    assertEquals(
      await iconUse.getAttribute("href"),
      "/src/shared/design/icons.svg#icon-camera",
    );
    assertStringIncludes((await capture.textContent()) ?? "", "Clipped");
    assertEquals(
      await capture.locator("img").getAttribute("src"),
      "/gallery-capture.png",
    );
  } finally {
    await browser.close();
    await gallery.close();
  }
});
