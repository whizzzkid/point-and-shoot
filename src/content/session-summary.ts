import type { BrowserShim, StorageChangedListener } from "../shared/browser.ts";
import {
  type ActiveSessionSummary,
  GET_ACTIVE_SESSION_SUMMARY_MESSAGE,
  isActiveSessionSummary,
} from "../shared/messages.ts";
import { SESSION_REVISION_STORAGE_KEY } from "../shared/session.ts";

/** Browser seams used by the injected active-session summary watcher. */
export interface SessionSummaryBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "sendMessage">;
  readonly storage: Pick<BrowserShim["storage"], "onChanged">;
}

/**
 * Loads canonical active-session state and refreshes it after every durable revision.
 *
 * @param browser Runtime query and storage invalidation events.
 * @param onChange Receives validated canonical session summaries.
 * @param reportError Receives invalid replies or failed background requests.
 * @returns Cleanup callback that removes the storage listener.
 */
export function watchSessionSummary(
  browser: SessionSummaryBrowser,
  onChange: (summary: ActiveSessionSummary) => void,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: session summary failed:", error);
  },
): () => void {
  let stopped = false;
  const refresh = async (): Promise<void> => {
    const response = await browser.runtime.sendMessage(GET_ACTIVE_SESSION_SUMMARY_MESSAGE);
    if (!isActiveSessionSummary(response)) {
      throw new TypeError("The background returned an invalid active-session summary.");
    }
    if (!stopped) onChange(response);
  };
  const listener: StorageChangedListener = (changes, areaName) => {
    if (areaName !== "local" || changes[SESSION_REVISION_STORAGE_KEY] === undefined) return;
    void refresh().catch(reportError);
  };
  browser.storage.onChanged.addListener(listener);
  void refresh().catch(reportError);
  return () => {
    stopped = true;
    browser.storage.onChanged.removeListener(listener);
  };
}
