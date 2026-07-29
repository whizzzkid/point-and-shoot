import type { BrowserShim } from "../shared/browser.ts";
import {
  GET_OVERLAY_STATE_MESSAGE,
  isOverlayStateResponse,
  isToggleActiveTabResponse,
  TOGGLE_ACTIVE_TAB_MESSAGE,
} from "../shared/messages.ts";

/** Browser capabilities used by popup launcher actions. */
export interface PopupBrowser {
  readonly openPanel: BrowserShim["openPanel"];
  readonly runtime: Pick<BrowserShim["runtime"], "openOptionsPage" | "sendMessage">;
  readonly tabs: Pick<BrowserShim["tabs"], "query" | "sendMessage">;
}

/** User actions exposed by the popup launcher. */
export interface PopupActions {
  readOverlay(): Promise<boolean>;
  toggleOverlay(): Promise<boolean>;
  openNotes(): Promise<void>;
  openOptions(): Promise<void>;
}

async function activeTabId(browser: PopupBrowser): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error("No active browser tab is available.");
  return tab.id;
}

/**
 * Creates popup launcher actions over the shared browser seam.
 *
 * @param browser Tab, runtime, panel, and options capabilities.
 * @returns Actions that never duplicate activation or platform-divergence logic.
 */
export function createPopupActions(browser: PopupBrowser): PopupActions {
  return {
    async readOverlay() {
      try {
        const response = await browser.tabs.sendMessage(
          await activeTabId(browser),
          GET_OVERLAY_STATE_MESSAGE,
        );
        return isOverlayStateResponse(response) ? response.mounted : false;
      } catch {
        return false;
      }
    },
    async toggleOverlay() {
      const response = await browser.runtime.sendMessage(TOGGLE_ACTIVE_TAB_MESSAGE);
      if (!isToggleActiveTabResponse(response)) {
        throw new Error("The background returned an invalid overlay response.");
      }
      if (!response.ok) throw new Error(response.error.message);
      if (response.result === "unavailable") {
        throw new Error("Point & Shoot is unavailable on this page.");
      }
      return response.mounted;
    },
    async openNotes() {
      await browser.openPanel(await activeTabId(browser));
    },
    openOptions() {
      return browser.runtime.openOptionsPage();
    },
  };
}
