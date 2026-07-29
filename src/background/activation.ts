import type { BrowserShim } from "../shared/browser.ts";
import {
  isOverlayStateResponse,
  TOGGLE_ACTIVE_TAB_MESSAGE,
  TOGGLE_OVERLAY_MESSAGE,
  type ToggleActiveTabResponse,
} from "../shared/messages.ts";

const CONTENT_BUNDLE = "content/content.js";
const DEFAULT_ACTION_TITLE = "Point and Shoot";
const UNAVAILABLE_ACTION_TITLE = "Point and Shoot — unavailable on this page";

/** Browser capabilities required to register and execute overlay activation. */
export interface ActivationBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "onMessage">;
  readonly tabs: Pick<BrowserShim["tabs"], "query" | "sendMessage">;
  readonly scripting: BrowserShim["scripting"];
  readonly action: Pick<BrowserShim["action"], "setBadgeText" | "setTitle">;
  readonly commands: BrowserShim["commands"];
}

/** Observable result of one tab activation request. */
export type ActivationResult = "injected" | "toggled" | "unavailable";

/** Overlay state and mechanism observed after one activation request. */
export interface ActivationOutcome {
  readonly mounted: boolean;
  readonly result: ActivationResult;
}

/** Serializes activation requests independently for each browser tab. */
export interface ActivationController {
  /**
   * Toggles the overlay in a tab, injecting its content realm when needed.
   *
   * @param tabId Browser tab receiving the activation.
   * @returns Whether activation toggled an existing realm, injected a new one, or was unavailable.
   */
  toggle(tabId: number): Promise<ActivationOutcome>;
}

async function clearUnavailableState(browser: ActivationBrowser, tabId: number): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ tabId, text: "" }),
    browser.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE }),
  ]);
}

async function showUnavailableState(browser: ActivationBrowser, tabId: number): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ tabId, text: "!" }),
    browser.action.setTitle({ tabId, title: UNAVAILABLE_ACTION_TITLE }),
  ]);
}

async function injectOnce(
  browser: ActivationBrowser,
  tabId: number,
): Promise<ActivationOutcome> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_BUNDLE],
    });
  } catch {
    await showUnavailableState(browser, tabId);
    return { mounted: false, result: "unavailable" };
  }

  await clearUnavailableState(browser, tabId);
  return { mounted: true, result: "injected" };
}

async function activateOnce(browser: ActivationBrowser, tabId: number): Promise<ActivationOutcome> {
  let response: unknown;
  try {
    response = await browser.tabs.sendMessage(tabId, TOGGLE_OVERLAY_MESSAGE);
  } catch {
    // A missing listener is the expected first-activation signal; injection distinguishes that
    // state from browser-restricted pages without requiring standing host access.
    return await injectOnce(browser, tabId);
  }
  if (!isOverlayStateResponse(response)) {
    throw new Error("content script returned an invalid overlay state");
  }
  await clearUnavailableState(browser, tabId);
  return { mounted: response.mounted, result: "toggled" };
}

/**
 * Creates an activation controller with a per-tab single-flight guard.
 *
 * @param browser Browser capabilities used for messaging, injection, and user feedback.
 * @returns A controller that prevents overlapping requests from double-injecting one tab.
 */
export function createActivationController(browser: ActivationBrowser): ActivationController {
  const inFlight = new Map<number, Promise<ActivationOutcome>>();

  return {
    toggle(tabId): Promise<ActivationOutcome> {
      const existing = inFlight.get(tabId);
      if (existing !== undefined) return existing;

      const activation = activateOnce(browser, tabId);
      const clearInFlight = (): void => {
        if (inFlight.get(tabId) === activation) inFlight.delete(tabId);
      };
      inFlight.set(tabId, activation);
      void activation.then(clearInFlight, clearInFlight);
      return activation;
    },
  };
}

/**
 * Registers toolbar-action and keyboard-command listeners against one shared controller.
 *
 * @param browser Browser capabilities and listener registries used by the background entry point.
 * @param reportError Receives unexpected API failures that cannot be shown through action state.
 * @returns The shared controller retained by the registered listener closures.
 */
export function registerActivationHandlers(
  browser: ActivationBrowser,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: activation failed:", error);
  },
): ActivationController {
  const controller = createActivationController(browser);
  const toggle = (tabId: number): void => {
    void controller.toggle(tabId).catch(reportError);
  };

  browser.commands.onCommand.addListener((command) => {
    if (command !== "toggle-capture") return;
    void browser.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id !== undefined) toggle(tab.id);
      })
      .catch(reportError);
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message !== TOGGLE_ACTIVE_TAB_MESSAGE) return;
    void browser.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id === undefined) throw new Error("No active browser tab is available.");
        return controller.toggle(tab.id);
      })
      .then((outcome) => sendResponse({ ...outcome, ok: true } satisfies ToggleActiveTabResponse))
      .catch((error: unknown) =>
        sendResponse(
          {
            error: {
              message: error instanceof Error ? error.message : "The overlay could not be toggled.",
            },
            ok: false,
          } satisfies ToggleActiveTabResponse,
        )
      );
    return true;
  });

  return controller;
}
