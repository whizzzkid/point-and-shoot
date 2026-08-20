/// <reference lib="dom" />

/**
 * Keeps the toolbar action badge and title in sync when a page navigation completes on the tab
 * that hosts the active session. The overlay itself cannot be re-injected here — ADR-0002
 * limits the extension to `activeTab`, which the engine revokes on every navigation. The next
 * toolbar click on the new page regrants activeTab and mounts the overlay via the usual
 * session-action path. This listener's job is narrower: refresh the visible badge so the user
 * sees the ongoing session's note count on the new page and knows the click is a resume, not a
 * fresh start.
 *
 * @module
 */

import type { BrowserShim } from "../shared/browser.ts";
import type { SessionService } from "./session.ts";
import { domainFromUrl } from "./session.ts";

/** Browser capabilities required to observe tab navigation completion. */
export interface TabLifecycleBrowser {
  readonly tabs: Pick<BrowserShim["tabs"], "onUpdated">;
}

/**
 * Registers the `tabs.onUpdated` listener. Fires `synchronize` on every navigation-complete
 * event when a non-paused session is active; skips paused sessions and no-session cases so the
 * badge does not thrash between "Pause" and "Start" states. When the navigation lands on a
 * different domain than the running session's, ends that session first — the toolbar click
 * dispatcher only creates a fresh session from its "no active session" branch (see
 * `src/background/session-action.ts`), so leaving the pointer active here would route the next
 * click into resume/pause instead.
 *
 * @param browser The subset of the runtime that exposes the tab-updated event.
 * @param sessions The service used to read the active session's pause state and end it on a
 *   domain change.
 * @param synchronize Callback that refreshes the action badge and title from the current
 *   session state.
 */
export function registerTabLifecycleHandler(
  browser: TabLifecycleBrowser,
  sessions: Pick<SessionService, "loadActive" | "end">,
  synchronize: () => Promise<void> = () => Promise.resolve(),
): void {
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    void (async () => {
      const active = await sessions.loadActive();
      if (active === null || active.pausedAt != null) return;

      const tabDomain = tab.url ? domainFromUrl(tab.url) : null;
      if (tabDomain !== null && active.domain !== tabDomain) {
        await sessions.end();
        await synchronize();
        return;
      }

      await synchronize();
    })().catch(() => {
      // Storage races and worker restarts reach this point; the next toolbar click restores
      // the correct state, so a swallowed error is safer than a misleading badge.
    });
  });
}
