import type { BrowserShim } from "../shared/browser.ts";
import {
  isNotePreviewRequest,
  NOTE_PREVIEW_MESSAGE,
  type NotePreviewRequest,
} from "../shared/messages.ts";
import { pageUrlForExport } from "../shared/session.ts";

/** Browser capabilities required to route panel previews to the active tab. */
export interface NotePreviewBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "onMessage">;
  readonly tabs: Pick<BrowserShim["tabs"], "query" | "sendMessage">;
}

function comparableUrl(pageUrl: string, stripQuery: boolean): string | null {
  try {
    const parsed = new URL(pageUrl);
    parsed.hash = "";
    return pageUrlForExport(parsed.toString(), stripQuery);
  } catch {
    return null;
  }
}

async function routePreview(
  browser: NotePreviewBrowser,
  request: NotePreviewRequest,
): Promise<{ readonly shown: boolean }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { shown: false };
  if (request.action === "show") {
    const recordedUrl = comparableUrl(request.pageUrl, request.stripQuery);
    const activeUrl = tab.url === undefined ? null : comparableUrl(tab.url, request.stripQuery);
    if (recordedUrl === null || recordedUrl !== activeUrl) {
      await browser.tabs.sendMessage(tab.id, {
        action: "clear",
        generation: request.generation,
        type: NOTE_PREVIEW_MESSAGE,
      }).catch(() => undefined);
      return { shown: false };
    }
  }
  await browser.tabs.sendMessage(tab.id, request);
  return { shown: request.action === "show" };
}

/**
 * Registers active-tab URL validation and routing for note-preview requests.
 *
 * @param browser Runtime and tab APIs owned by the background.
 * @param reportError Receives unexpected routing failures.
 */
export function registerNotePreviewHandler(
  browser: NotePreviewBrowser,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: note preview routing failed:", error);
  },
): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isNotePreviewRequest(message)) return;
    void routePreview(browser, message)
      .then(sendResponse)
      .catch((error: unknown) => {
        reportError(error);
        sendResponse({ shown: false });
      });
    return true;
  });
}
