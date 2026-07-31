/// <reference lib="dom" />

/**
 * Drives the complete capture and export flow with keyboard input only.
 *
 * Named `.spec.ts` so the fast unit gate does not launch Chromium. Run through `deno task a11y`.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { startFixtureServer } from "../fixtures/app/server.ts";
import {
  launchExtension,
  openExtensionPage,
  readSessionPointers,
  triggerExtensionAction,
  waitForHostCount,
  waitForStoredSession,
} from "../e2e/extension-fixture.ts";
import {
  assertVisibleKeyboardFocus,
  pointerInputCount,
  tabTo,
  trackPointerInput,
} from "./browser.ts";

const NOTE_TEXT = "The save action needs a clearer keyboard focus treatment.";

Deno.test("keyboard-only flow activates, captures, annotates, reviews, and exports", async () => {
  const fixture = startFixtureServer();
  const { context, extensionId, serviceWorker } = await launchExtension();
  try {
    const page = await context.newPage();
    await page.goto(`${fixture.base}/index.html`);
    await trackPointerInput(page);

    const captureTarget = page.getByTestId("save-note");
    await tabTo(page, captureTarget);
    await assertVisibleKeyboardFocus(page);

    // Chromium exposes no automation hook for extension command shortcuts. The DevTools action
    // gesture grants activeTab without dispatching a DOM mouse event; every in-page and panel
    // interaction after this setup gesture is driven through Playwright's keyboard API.
    await triggerExtensionAction(context, page, extensionId);
    await waitForHostCount(page, 1);
    assertEquals(
      await captureTarget.evaluate((element) => element === document.activeElement),
      true,
      "shortcut activation moved focus away from the inspected page",
    );

    await page.keyboard.press("Enter");
    const pointers = await readSessionPointers(serviceWorker);
    if (pointers.activeId === undefined) {
      throw new Error("keyboard capture did not create an active session");
    }
    await waitForStoredSession(serviceWorker, 1, pointers.activeId);
    await assertVisibleKeyboardFocus(page);

    const panel = await openExtensionPage(context, extensionId, "sidepanel/sidepanel.html");
    await trackPointerInput(panel);
    await panel.getByRole("heading", { name: "Untitled session" }).waitFor();

    const edit = panel.locator("[data-note-id]").getByRole("button", { name: "Edit" });
    await tabTo(panel, edit);
    await assertVisibleKeyboardFocus(panel);
    await panel.keyboard.press("Enter");

    const noteText = panel.getByRole("textbox", { name: "Note text" });
    await tabTo(panel, noteText);
    await assertVisibleKeyboardFocus(panel);
    await panel.keyboard.type(NOTE_TEXT);

    const save = panel.getByRole("button", { name: "Save changes" });
    await tabTo(panel, save);
    await assertVisibleKeyboardFocus(panel);
    await panel.keyboard.press("Enter");
    await panel.getByText(NOTE_TEXT).waitFor();
    assertEquals(
      await edit.evaluate((element) => element === document.activeElement),
      true,
      "closing the edit dialog did not restore its trigger",
    );

    const compile = panel.getByRole("button", { name: "Compile plan" });
    await tabTo(panel, compile);
    await assertVisibleKeyboardFocus(panel);
    await panel.keyboard.press("Enter");
    await panel.getByRole("heading", { name: "Compile plan" }).waitFor();
    await assertVisibleKeyboardFocus(panel);

    const download = panel.getByRole("button", { name: "Download for agent" });
    await tabTo(panel, download);
    await assertVisibleKeyboardFocus(panel);
    const downloadStarted = panel.waitForEvent("download");
    await panel.keyboard.press("Enter");
    const downloaded = await downloadStarted;
    const path = await downloaded.path();
    assert(path !== null, "keyboard export did not produce a local file");
    assert((await Deno.stat(path)).size > 0, "keyboard export produced an empty file");

    assertEquals(await pointerInputCount(page), 0, "capture page received physical pointer input");
    assertEquals(await pointerInputCount(panel), 0, "side panel received physical pointer input");
  } finally {
    await context.close();
    await fixture.close();
  }
});
