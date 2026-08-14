import type { BrowserShim } from "../shared/browser.ts";
import type { ActivationController } from "./activation.ts";
import type { SessionService } from "./session.ts";
import {
  type ActiveSessionSummary,
  GET_ACTIVE_SESSION_SUMMARY_MESSAGE,
} from "../shared/messages.ts";
import { SESSION_REVISION_STORAGE_KEY } from "../shared/session.ts";

const INACTIVE_ACTION_TITLE = "Point and Shoot — Start session";
const UNAVAILABLE_ACTION_TITLE = "Point and Shoot — unavailable on this page";
const PAUSED_ACTION_TITLE_PREFIX = "Point and Shoot — Resume session";
const RUNNING_ACTION_TITLE_PREFIX = "Point and Shoot — Pause session";
const MAXIMUM_BADGE_COUNT = 99;

/** Browser capabilities required by the toolbar-owned session controller. */
export interface SessionActionBrowser {
  readonly action: Pick<
    BrowserShim["action"],
    "onClicked" | "setBadgeText" | "setTitle"
  >;
  readonly openPanel: BrowserShim["openPanel"];
}

/** Result of one direct browser-action session toggle. */
export type SessionActionResult =
  | {
    readonly noteCount: number;
    readonly sessionId: string;
    readonly state: "paused" | "resumed" | "started";
  }
  | { readonly state: "unavailable" };

/** Toolbar session behavior shared by click, capture, and background-startup paths. */
export interface SessionActionController {
  /**
   * Starts a fresh session or ends the active one for the clicked tab.
   *
   * @param tabId Browser tab whose overlay should mount or unmount.
   * @param pageTitle Current tab title used when a fresh session is created.
   * @param pageUrl Current tab URL used to capture the session's domain when a fresh session is
   *   created. Unparseable URLs (e.g. `chrome://newtab/`) leave `domain` `null`.
   * @returns The resulting lifecycle state.
   */
  toggle(tabId: number, pageTitle?: string, pageUrl?: string): Promise<SessionActionResult>;
  /** Rehydrates the global badge and tooltip from durable active-session state. */
  synchronize(): Promise<void>;
  /** Reads the canonical active session state for injected UI. */
  summary(): Promise<ActiveSessionSummary>;
}

/** Runtime and storage events that invalidate session state outside the background context. */
export interface SessionStateBrowser {
  readonly runtime: Pick<BrowserShim["runtime"], "onMessage">;
  readonly storage: Pick<BrowserShim["storage"], "onChanged">;
}

function badgeText(noteCount: number): string {
  return noteCount > MAXIMUM_BADGE_COUNT ? `${MAXIMUM_BADGE_COUNT}+` : String(noteCount);
}

function noteLabel(noteCount: number): string {
  return `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
}

async function showRunning(
  browser: SessionActionBrowser,
  noteCount: number,
): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: badgeText(noteCount) }),
    browser.action.setTitle({
      title: `${RUNNING_ACTION_TITLE_PREFIX} (${noteLabel(noteCount)})`,
    }),
  ]);
}

async function showPaused(
  browser: SessionActionBrowser,
  noteCount: number,
): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: badgeText(noteCount) }),
    browser.action.setTitle({
      title: `${PAUSED_ACTION_TITLE_PREFIX} (${noteLabel(noteCount)})`,
    }),
  ]);
}

async function showInactive(browser: SessionActionBrowser): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: "" }),
    browser.action.setTitle({ title: INACTIVE_ACTION_TITLE }),
  ]);
}

async function showUnavailable(browser: SessionActionBrowser): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: "!" }),
    browser.action.setTitle({ title: UNAVAILABLE_ACTION_TITLE }),
  ]);
}

async function showFailure(
  browser: SessionActionBrowser,
  operation: "pause" | "resume" | "start",
): Promise<void> {
  await Promise.all([
    browser.action.setBadgeText({ text: "!" }),
    browser.action.setTitle({
      title: `Point and Shoot — session could not ${operation}`,
    }),
  ]);
}

/**
 * Creates the serialized toolbar-owned session controller.
 *
 * @param browser Browser action state and side-panel capabilities.
 * @param activation Overlay mount and unmount controller.
 * @param sessions Durable session lifecycle service.
 * @returns A controller that keeps session state, overlay state, and action feedback aligned.
 */
export function createSessionActionController(
  browser: SessionActionBrowser,
  activation: ActivationController,
  sessions: SessionService,
): SessionActionController {
  let operationTail = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationTail.then(operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    summary: () =>
      enqueue(async () => {
        const active = await sessions.loadActive();
        return active === null
          ? { active: false }
          : { active: true, noteCount: active.notes.length, sessionId: active.id };
      }),
    synchronize: () =>
      enqueue(async () => {
        const active = await sessions.loadActive();
        if (active === null) {
          await showInactive(browser);
          return;
        }
        if (active.pausedAt != null) {
          await showPaused(browser, active.notes.length);
          return;
        }
        await showRunning(browser, active.notes.length);
      }),
    toggle: (tabId, pageTitle, pageUrl) =>
      enqueue(async () => {
        const active = await sessions.loadActive();

        // Active + running → pause. Keep the session pointer so the next click resumes rather
        // than starting a new one, which is the whole point of the pause/resume model.
        if (active !== null && active.pausedAt == null) {
          await activation.unmount(tabId);
          try {
            const paused = await sessions.pause();
            await showPaused(browser, paused?.notes.length ?? active.notes.length);
            return {
              noteCount: paused?.notes.length ?? active.notes.length,
              sessionId: paused?.id ?? active.id,
              state: "paused",
            };
          } catch (error) {
            await activation.mount(tabId).catch(() => undefined);
            await showFailure(browser, "pause");
            throw error;
          }
        }

        // Active + paused → resume. Re-mount the overlay in the clicked tab; note that the
        // background's `tabs.onUpdated` listener also mounts the overlay after navigation while
        // the session is running, so a resumed session keeps working across pages.
        if (active !== null && active.pausedAt != null) {
          const outcome = await activation.mount(tabId);
          if (outcome.result === "unavailable") {
            await showUnavailable(browser);
            return { state: "unavailable" };
          }
          try {
            const resumed = await sessions.resume();
            await showRunning(browser, resumed?.notes.length ?? active.notes.length);
            return {
              noteCount: resumed?.notes.length ?? active.notes.length,
              sessionId: resumed?.id ?? active.id,
              state: "resumed",
            };
          } catch (error) {
            await activation.unmount(tabId).catch(() => undefined);
            await showFailure(browser, "resume");
            throw error;
          }
        }

        // No active session → start a fresh one.
        const outcome = await activation.mount(tabId);
        if (outcome.result === "unavailable") {
          await showUnavailable(browser);
          return { state: "unavailable" };
        }
        try {
          const started = await sessions.start(pageTitle, pageUrl);
          await showRunning(browser, started.notes.length);
          return {
            noteCount: started.notes.length,
            sessionId: started.id,
            state: "started",
          };
        } catch (error) {
          await activation.unmount(tabId).catch(() => undefined);
          await showFailure(browser, "start");
          throw error;
        }
      }),
  };
}

/**
 * Registers canonical summary reads and revision-driven action refreshes.
 *
 * @param browser Runtime and storage invalidation events.
 * @param controller Serialized session-state owner.
 * @param reportError Receives storage or action refresh failures.
 */
export function registerSessionStateHandlers(
  browser: SessionStateBrowser,
  controller: SessionActionController,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: session state failed:", error);
  },
): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message !== GET_ACTIVE_SESSION_SUMMARY_MESSAGE) return;
    void controller.summary().then(sendResponse).catch((error) => {
      sendResponse({ active: false });
      reportError(error);
    });
    return true;
  });
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || changes[SESSION_REVISION_STORAGE_KEY] === undefined) return;
    void controller.synchronize().catch(reportError);
  });
}

/**
 * Registers the direct toolbar click and restores action state after background startup.
 *
 * @param browser Browser action listener, action state, and side-panel capability.
 * @param controller Toolbar-owned session controller.
 * @param reportError Receives panel, storage, or activation failures.
 */
export function registerSessionActionHandler(
  browser: SessionActionBrowser,
  controller: SessionActionController,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: session action failed:", error);
  },
): void {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void browser.openPanel(tab.id).catch(reportError);
    void controller.toggle(tab.id, tab.title, tab.url).catch(reportError);
  });
  void controller.synchronize().catch(reportError);
}
