/// <reference lib="dom" />

/**
 * Re-mounts the capture overlay on the running (non-paused) session's tab after a page
 * navigation completes, so the user can keep taking notes across pages within one session.
 *
 * Page unload destroys the injected content realm; without this listener the overlay only
 * returns via another toolbar click. The extension holds `activeTab` only, so listening for
 * `tabs.onUpdated` is safe: the shim delivers `changeInfo.status` and `tab.url` on every fire,
 * we filter to completed navigations, and the activation controller already treats restricted
 * pages as `unavailable` — nothing here reads a URL the extension shouldn't already see.
 *
 * @module
 */

import type { BrowserShim } from "../shared/browser.ts";
import type { ActivationController } from "./activation.ts";
import type { SessionService } from "./session.ts";

/** Browser capabilities required to observe tab navigation completion. */
export interface TabLifecycleBrowser {
  readonly tabs: Pick<BrowserShim["tabs"], "onUpdated">;
}

/**
 * Registers the `tabs.onUpdated` listener. Idempotent per browser instance — attaching the same
 * listener twice on the same {@link chrome.tabs.onUpdated} is a no-op in both engines.
 *
 * @param browser The subset of the runtime that exposes the tab-updated event.
 * @param sessions The service used to read the active session's pause state.
 * @param activation The controller that mounts the overlay in a given tab.
 * @param synchronize Optional callback invoked after a successful re-mount, so the action badge
 *   picks up the current session's note count on the newly navigated page.
 */
export function registerTabLifecycleHandler(
  browser: TabLifecycleBrowser,
  sessions: Pick<SessionService, "loadActive">,
  activation: Pick<ActivationController, "mount">,
  synchronize: () => Promise<void> = () => Promise.resolve(),
): void {
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "complete") return;
    void (async () => {
      const active = await sessions.loadActive();
      // No active session, or the user has paused — do not follow navigation.
      if (active === null || active.pausedAt != null) return;
      const outcome = await activation.mount(tabId);
      if (outcome.result !== "unavailable") await synchronize();
    })().catch(() => {
      // Restricted pages, closed tabs, and races with the panel-side lifecycle all reach this
      // point; the badge/title stay accurate via the next explicit toolbar click.
    });
  });
}
