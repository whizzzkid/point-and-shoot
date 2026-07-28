import type { BrowserShim } from "../shared/browser.ts";
import { TOGGLE_OVERLAY_MESSAGE } from "../shared/messages.ts";

const CONTENT_BUNDLE = "content/content.js";
const DEFAULT_ACTION_TITLE = "Point and Shoot";
const UNAVAILABLE_ACTION_TITLE = "Point and Shoot — unavailable on this page";

/** Browser capabilities required to register and execute overlay activation. */
export interface ActivationBrowser {
  readonly tabs: Pick<BrowserShim["tabs"], "query" | "sendMessage">;
  readonly scripting: BrowserShim["scripting"];
  readonly action: BrowserShim["action"];
  readonly commands: BrowserShim["commands"];
}

/** Observable result of one tab activation request. */
export type ActivationResult = "injected" | "toggled" | "unavailable";

/** Serializes activation requests independently for each browser tab. */
export interface ActivationController {
  /**
   * Toggles the overlay in a tab, injecting its content realm when needed.
   *
   * @param tabId Browser tab receiving the activation.
   * @returns Whether activation toggled an existing realm, injected a new one, or was unavailable.
   */
  toggle(tabId: number): Promise<ActivationResult>;
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

async function activateOnce(browser: ActivationBrowser, tabId: number): Promise<ActivationResult> {
  try {
    await browser.tabs.sendMessage(tabId, TOGGLE_OVERLAY_MESSAGE);
    await clearUnavailableState(browser, tabId);
    return "toggled";
  } catch {
    // A missing listener is the expected first-activation signal; injection distinguishes that
    // state from browser-restricted pages without requiring standing host access.
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CONTENT_BUNDLE],
      });
    } catch {
      await showUnavailableState(browser, tabId);
      return "unavailable";
    }

    await clearUnavailableState(browser, tabId);
    return "injected";
  }
}

/**
 * Creates an activation controller with a per-tab single-flight guard.
 *
 * @param browser Browser capabilities used for messaging, injection, and user feedback.
 * @returns A controller that prevents overlapping requests from double-injecting one tab.
 */
export function createActivationController(browser: ActivationBrowser): ActivationController {
  const inFlight = new Map<number, Promise<ActivationResult>>();

  return {
    toggle(tabId): Promise<ActivationResult> {
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

  browser.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) toggle(tab.id);
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== "toggle-capture") return;
    void browser.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id !== undefined) toggle(tab.id);
      })
      .catch(reportError);
  });

  return controller;
}
