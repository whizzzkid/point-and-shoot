import type { BrowserShim, MessageSender } from "../shared/browser.ts";
import { probeFrameworkComponents } from "../content/framework-probe.ts";
import {
  type FrameworkProbeRequest,
  type FrameworkProbeResponse,
  isFrameworkProbeRequest,
  isFrameworkProbeResponse,
} from "../shared/messages.ts";
import { MAX_COMPONENT_HINT_TEXT_LENGTH } from "../shared/schema.ts";
import { loadSettings } from "../shared/settings.ts";

/** Browser capabilities used by the opt-in main-world probe handler. */
export interface FrameworkProbeBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "onMessage">;
  readonly scripting: BrowserShim["scripting"];
  readonly storage: {
    readonly local: Pick<BrowserShim["storage"]["local"], "get" | "set">;
  };
}

function emptyResponse(request: FrameworkProbeRequest): FrameworkProbeResponse {
  return { hints: request.cssPaths.map(() => null) };
}

async function runFrameworkProbe(
  browser: FrameworkProbeBrowser,
  request: FrameworkProbeRequest,
  sender: MessageSender,
): Promise<FrameworkProbeResponse> {
  const fallback = emptyResponse(request);
  const settings = await loadSettings(browser.storage.local).catch(() => null);
  const tabId = sender.tab?.id;
  if (settings?.frameworkHints !== true || tabId === undefined) return fallback;

  const target = sender.frameId === undefined ? { tabId } : { frameIds: [sender.frameId], tabId };
  try {
    const [injection] = await browser.scripting.executeScript({
      args: [request.cssPaths, MAX_COMPONENT_HINT_TEXT_LENGTH],
      func: probeFrameworkComponents,
      target,
      world: "MAIN",
    });
    const candidate = { hints: injection?.result };
    return isFrameworkProbeResponse(candidate, request.cssPaths.length) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Registers the background bridge that runs the pure probe in the sender frame's page world.
 *
 * @param browser Storage, message, and scripting capabilities.
 * @returns Nothing; the registered listener owns future requests.
 */
export function registerFrameworkProbeHandler(browser: FrameworkProbeBrowser): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isFrameworkProbeRequest(message)) return;
    void runFrameworkProbe(browser, message, sender).then(sendResponse);
    return true;
  });
}
