/**
 * Background entry point. Wave 3 wires up capture orchestration and message routing; for now this
 * owns the one piece of behaviour the permission model depends on — injecting the content script on
 * a user gesture instead of registering it statically in the manifest (ADR-0002).
 *
 * @module
 */

import { browser, type TabInfo } from "../shared/browser.ts";

/** The built content bundle, relative to the extension root — see `build/build.ts`'s entry points. */
const CONTENT_BUNDLE = "content/content.js";

/**
 * Boot marker. `scripts/boot-firefox.ts` greps this out of Firefox's own stdout: with no static
 * content-script registration there is nothing that runs on a page by itself, so the background
 * booting is what "the extension loaded" now means for that check.
 */
console.log("point-and-shoot: background ready");

/**
 * Injects the content bundle into `tabId`. Both entry gestures — the toolbar action and the
 * keyboard command — grant `activeTab` for the tab they fired on, and that grant is what makes this
 * call legal; there is no host permission behind it. Re-injecting an already-injected tab is
 * harmless because `src/content/index.ts` is idempotent.
 */
async function injectContentScript(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_BUNDLE] });
  } catch (error) {
    // `activeTab` does not cover the browser's own privileged pages or (in Firefox) certain
    // restricted domains, and ADR-0002 records those failures as permanent rather than bugs. Wave 3
    // surfaces this in the UI; logging is all there is to do from here.
    console.error(`point-and-shoot: could not inject into tab ${tabId}:`, error);
  }
}

/** Resolves the tab a keyboard command fired on — unlike `action.onClicked`, it carries no tab. */
async function activeTabId(): Promise<number | undefined> {
  const [tab]: readonly TabInfo[] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab?.id;
}

browser.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void injectContentScript(tab.id);
});

browser.commands.onCommand.addListener((command) => {
  console.log(`point-and-shoot: received command "${command}"`);
  if (command !== "toggle-capture") return;
  void activeTabId().then((tabId) => {
    if (tabId !== undefined) void injectContentScript(tabId);
  });
});
