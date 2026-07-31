/// <reference lib="dom" />

/**
 * Verifies focus trapping, restoration, and non-interference.
 *
 * Named `.spec.ts` so the fast unit gate does not launch Chromium. Run through `deno task a11y`.
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { chromium } from "playwright";
import { startGalleryServer } from "../../src/ui/gallery/server.ts";
import {
  launchExtension,
  triggerExtensionAction,
  waitForHostCount,
} from "../e2e/extension-fixture.ts";
import {
  assertVisibleKeyboardFocus,
  pointerInputCount,
  tabTo,
  trackPointerInput,
} from "./browser.ts";
import { startFixtureServer } from "../fixtures/app/server.ts";

Deno.test("dialog traps focus and restores its keyboard trigger", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(gallery.url);
    const opener = page.getByRole("button", { name: "Open dialog" });
    await tabTo(page, opener);
    await assertVisibleKeyboardFocus(page);

    await page.keyboard.press("Enter");
    const close = page.getByRole("button", { name: "Close dialog" });
    await close.waitFor();
    assertEquals(await close.evaluate((element) => element === document.activeElement), true);
    await assertVisibleKeyboardFocus(page);

    await page.keyboard.press("Shift+Tab");
    const send = page.getByRole("button", { name: "Send plan" });
    assertEquals(await send.evaluate((element) => element === document.activeElement), true);
    await assertVisibleKeyboardFocus(page);

    await page.keyboard.press("Tab");
    assertEquals(await close.evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("Escape");
    await close.waitFor({ state: "detached" });
    assertEquals(await opener.evaluate((element) => element === document.activeElement), true);
    await assertVisibleKeyboardFocus(page);
  } finally {
    await browser.close();
    await gallery.close();
  }
});

Deno.test("mounting the production overlay preserves host-page focus", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await trackPointerInput(page);
    const target = page.getByTestId("light-action");
    await tabTo(page, target);
    await assertVisibleKeyboardFocus(page);

    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);

    assertEquals(await target.evaluate((element) => element === document.activeElement), true);
    await assertVisibleKeyboardFocus(page);
    assertEquals(await pointerInputCount(page), 0);
  } finally {
    await context.close();
    await fixture.close();
  }
});
