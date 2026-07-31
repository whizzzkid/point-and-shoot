/// <reference lib="dom" />

import { assert, assertEquals } from "@std/assert";
import type { Locator, Page } from "playwright";

const DEFAULT_TAB_LIMIT = 40;

/**
 * Presses Tab until a target receives focus without synthesizing pointer input.
 *
 * @param page Playwright page receiving keyboard input.
 * @param target Locator for the expected focus target.
 * @param maximumTabs Bound that turns a broken tab order into an actionable failure.
 * @returns Number of Tab presses used.
 */
export async function tabTo(
  page: Page,
  target: Locator,
  maximumTabs = DEFAULT_TAB_LIMIT,
): Promise<number> {
  for (let count = 1; count <= maximumTabs; count += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return count;
  }
  throw new Error(`target did not receive focus within ${maximumTabs} Tab presses`);
}

/**
 * Asserts that the document retains a visible, viewport-contained keyboard focus indicator.
 *
 * @param page Playwright page whose active element is inspected.
 * @returns Nothing after the focus contract passes.
 */
export async function assertVisibleKeyboardFocus(page: Page): Promise<void> {
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return { indicator: false, tag: null, visible: false };
    }
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    const outlineVisible = style.outlineStyle !== "none" &&
      Number.parseFloat(style.outlineWidth) > 0;
    const shadowVisible = style.boxShadow !== "none";
    return {
      indicator: outlineVisible || shadowVisible,
      tag: active.tagName,
      visible: rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth,
    };
  });

  assert(focus.tag !== null && focus.tag !== "BODY", "keyboard focus was lost to the document");
  assertEquals(focus.visible, true, `focused ${focus.tag} is not visible in the viewport`);
  assertEquals(focus.indicator, true, `focused ${focus.tag} has no visible focus indicator`);
}

/**
 * Installs counters for physical pointer input before a keyboard-only flow.
 *
 * @param page Playwright page receiving the flow.
 * @returns Nothing after listeners are installed.
 */
export async function trackPointerInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = { count: 0 };
    for (const type of ["mousedown", "pointerdown", "touchstart"]) {
      addEventListener(type, () => {
        state.count += 1;
      }, { capture: true });
    }
    (globalThis as unknown as { pointShootPointerInput: typeof state }).pointShootPointerInput =
      state;
  });
}

/**
 * Reads how many physical pointer events occurred during a tracked flow.
 *
 * @param page Tracked Playwright page.
 * @returns Physical pointer-event count.
 */
export async function pointerInputCount(page: Page): Promise<number> {
  return await page.evaluate(() =>
    (globalThis as unknown as {
      readonly pointShootPointerInput?: { readonly count: number };
    }).pointShootPointerInput?.count ?? 0
  );
}
