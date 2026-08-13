import type { BrowserShim } from "../shared/browser.ts";
import {
  GET_OVERLAY_STATE_MESSAGE,
  isOverlayStateResponse,
  TOGGLE_ACTIVE_TAB_MESSAGE,
  TOGGLE_OVERLAY_MESSAGE,
  type ToggleActiveTabResponse,
} from "../shared/messages.ts";

const CONTENT_BUNDLE = "content/content.js";
const DEFAULT_ACTION_TITLE = "Point and Shoot — Start session";
const UNAVAILABLE_ACTION_TITLE = "Point and Shoot — unavailable on this page";

/** Browser capabilities required to register and execute overlay activation. */
export interface ActivationBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "onMessage">;
  readonly tabs: Pick<BrowserShim["tabs"], "query" | "sendMessage">;
  readonly scripting: BrowserShim["scripting"];
  readonly action: Pick<BrowserShim["action"], "setBadgeText" | "setTitle">;
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
  /**
   * Ensures the overlay is mounted, injecting its content realm when needed.
   *
   * @param tabId Browser tab receiving the overlay.
   * @returns The observed mounted state and activation mechanism.
   */
  mount(tabId: number): Promise<ActivationOutcome>;
  /**
   * Ensures the overlay is unmounted without injecting a missing content realm.
   *
   * @param tabId Browser tab whose overlay should be removed.
   * @returns The observed unmounted state.
   */
  unmount(tabId: number): Promise<ActivationOutcome>;
}

async function clearUnavailableState(browser: ActivationBrowser): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: "" }),
    browser.action.setTitle({ title: DEFAULT_ACTION_TITLE }),
  ]);
}

async function showUnavailableState(browser: ActivationBrowser): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: "!" }),
    browser.action.setTitle({ title: UNAVAILABLE_ACTION_TITLE }),
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
    await showUnavailableState(browser);
    return { mounted: false, result: "unavailable" };
  }

  await clearUnavailableState(browser);
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
  await clearUnavailableState(browser);
  return { mounted: response.mounted, result: "toggled" };
}

async function readOverlayState(
  browser: ActivationBrowser,
  tabId: number,
): Promise<boolean | null> {
  let response: unknown;
  try {
    response = await browser.tabs.sendMessage(tabId, GET_OVERLAY_STATE_MESSAGE);
  } catch {
    return null;
  }
  if (!isOverlayStateResponse(response)) {
    throw new Error("content script returned an invalid overlay state");
  }
  return response.mounted;
}

async function mountOnce(
  browser: ActivationBrowser,
  tabId: number,
): Promise<ActivationOutcome> {
  const mounted = await readOverlayState(browser, tabId);
  if (mounted === null) return await injectOnce(browser, tabId);
  if (!mounted) return await activateOnce(browser, tabId);
  await clearUnavailableState(browser);
  return { mounted: true, result: "toggled" };
}

async function unmountOnce(
  browser: ActivationBrowser,
  tabId: number,
): Promise<ActivationOutcome> {
  const mounted = await readOverlayState(browser, tabId);
  if (mounted === null) return { mounted: false, result: "toggled" };
  if (mounted) return await activateOnce(browser, tabId);
  await clearUnavailableState(browser);
  return { mounted: false, result: "toggled" };
}

/**
 * Creates an activation controller with a per-tab single-flight guard.
 *
 * @param browser Browser capabilities used for messaging, injection, and user feedback.
 * @returns A controller that prevents overlapping requests from double-injecting one tab.
 */
export function createActivationController(browser: ActivationBrowser): ActivationController {
  type RequestKind = "mount" | "toggle" | "unmount";
  interface PendingRequest {
    readonly kind: RequestKind;
    readonly promise: Promise<ActivationOutcome>;
  }
  const inFlight = new Map<number, PendingRequest>();

  const request = (
    tabId: number,
    kind: RequestKind,
    operation: () => Promise<ActivationOutcome>,
  ): Promise<ActivationOutcome> => {
    const existing = inFlight.get(tabId);
    if (existing?.kind === kind) return existing.promise;
    const activation = existing === undefined
      ? operation()
      : existing.promise.then(operation, operation);
    const pending = { kind, promise: activation };
    inFlight.set(tabId, pending);
    const clearInFlight = (): void => {
      if (inFlight.get(tabId) === pending) inFlight.delete(tabId);
    };
    void activation.then(clearInFlight, clearInFlight);
    return activation;
  };

  return {
    mount(tabId): Promise<ActivationOutcome> {
      return request(tabId, "mount", () => mountOnce(browser, tabId));
    },
    toggle(tabId): Promise<ActivationOutcome> {
      return request(tabId, "toggle", () => activateOnce(browser, tabId));
    },
    unmount(tabId): Promise<ActivationOutcome> {
      return request(tabId, "unmount", () => unmountOnce(browser, tabId));
    },
  };
}

/**
 * Registers runtime-message listener for overlay toggle requests from the side panel.
 *
 * @param browser Browser capabilities and listener registries used by the background entry point.
 * @param controller Shared activation controller used by toolbar and runtime-message entry points.
 * @param restoreActionState Restores session badge and tooltip state after successful activation.
 * @returns The shared controller retained by the registered listener closures.
 */
export function registerActivationHandlers(
  browser: ActivationBrowser,
  controller: ActivationController = createActivationController(browser),
  restoreActionState: () => Promise<void> = () => Promise.resolve(),
): ActivationController {
  const toggle = async (tabId: number): Promise<ActivationOutcome> => {
    const outcome = await controller.toggle(tabId);
    if (outcome.result !== "unavailable") await restoreActionState();
    return outcome;
  };

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message !== TOGGLE_ACTIVE_TAB_MESSAGE) return;
    void browser.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id === undefined) throw new Error("No active browser tab is available.");
        return toggle(tab.id);
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
