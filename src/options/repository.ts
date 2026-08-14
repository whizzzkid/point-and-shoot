/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import type { Session } from "../shared/schema.ts";
import type { ExtensionSettings } from "../shared/settings.ts";
import { loadSettings, saveSettings } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  nextSessionRevision,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { clearSessions, deleteSession, listSessions, openStore } from "../shared/store.ts";

/** Browser capabilities used by the options page. */
export interface OptionsBrowser {
  readonly commands: Pick<BrowserShim["commands"], "getAll">;
  readonly runtimeInfo: BrowserShim["runtimeInfo"];
  readonly storage: Pick<BrowserShim["storage"], "local">;
  readonly tabs: Pick<BrowserShim["tabs"], "create">;
  readonly openPanel?: BrowserShim["openPanel"];
}

/** Settings and browser-assigned keyboard shortcut loaded together. */
export interface OptionsSnapshot {
  readonly settings: ExtensionSettings;
  readonly shortcut: string;
}

/** Persistence and browser navigation used by the options UI. */
export interface OptionsRepository {
  load(): Promise<OptionsSnapshot>;
  save(settings: ExtensionSettings): Promise<void>;
  clearSessions(): Promise<void>;
  openShortcutSettings(): Promise<void>;
  /** Reads every stored session, ordered by `createdAt` descending. Corrupt rows are skipped. */
  listAllSessions(): Promise<readonly Session[]>;
  /** Deletes one session from IndexedDB. When the session is the active or displayed one the
   * corresponding pointer is cleared so the side panel does not render a dangling id. */
  deleteSessionById(id: string): Promise<void>;
  /**
   * Repoints the side panel at the given session by setting `displaySessionId` and bumping
   * `sessionRevision`; opens the panel when the engine supports it. The user gesture context is
   * required to call `sidePanel.open` on Chrome — the caller must invoke this inside a click
   * handler.
   */
  openSessionInSidePanel(id: string): Promise<void>;
  /** Reads the user's persisted preference for grouping the sessions list by domain. */
  readGroupByDomain(): Promise<boolean>;
  /** Persists the user's preference for grouping the sessions list by domain. */
  writeGroupByDomain(value: boolean): Promise<void>;
}

/** Storage key holding a boolean that persists the options-page group-by-domain toggle. */
export const OPTIONS_GROUP_BY_DOMAIN_STORAGE_KEY = "optionsGroupByDomain";

async function clearStoredSessions(browser: OptionsBrowser): Promise<void> {
  const database = await openStore();
  try {
    await clearSessions(database);
  } finally {
    database.close();
  }
  await browser.storage.local.remove([
    ACTIVE_SESSION_ID_STORAGE_KEY,
    DISPLAY_SESSION_ID_STORAGE_KEY,
    SESSION_REVISION_STORAGE_KEY,
  ]);
}

/**
 * Creates the options page repository over extension storage, IndexedDB, and browser navigation.
 *
 * @param browser Cross-browser settings and navigation capabilities.
 * @returns Serialized settings writes and destructive session actions.
 */
export function createOptionsRepository(browser: OptionsBrowser): OptionsRepository {
  let saveTail = Promise.resolve();
  return {
    async load() {
      const [settings, commands] = await Promise.all([
        loadSettings(browser.storage.local),
        browser.commands.getAll().catch(() => []),
      ]);
      const command = commands.find((candidate) => candidate.name === "_execute_action");
      return {
        settings,
        shortcut: command?.shortcut?.trim() || "Not assigned",
      };
    },
    save(settings) {
      const result = saveTail.then(() => saveSettings(browser.storage.local, settings));
      saveTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    clearSessions: () => clearStoredSessions(browser),
    async openShortcutSettings() {
      const url = browser.runtimeInfo.engine === "firefox"
        ? "about:addons"
        : "chrome://extensions/shortcuts";
      await browser.tabs.create({ url });
    },
    async listAllSessions() {
      const database = await openStore();
      try {
        const sessions = await listSessions(database);
        return [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      } finally {
        database.close();
      }
    },
    async deleteSessionById(id) {
      const database = await openStore();
      try {
        await deleteSession(database, id);
      } finally {
        database.close();
      }
      const pointers = await browser.storage.local.get([
        ACTIVE_SESSION_ID_STORAGE_KEY,
        DISPLAY_SESSION_ID_STORAGE_KEY,
      ]);
      const removals: string[] = [];
      if (pointers[ACTIVE_SESSION_ID_STORAGE_KEY] === id) {
        removals.push(ACTIVE_SESSION_ID_STORAGE_KEY);
      }
      if (pointers[DISPLAY_SESSION_ID_STORAGE_KEY] === id) {
        removals.push(DISPLAY_SESSION_ID_STORAGE_KEY);
      }
      if (removals.length > 0) await browser.storage.local.remove(removals);
      await bumpRevision(browser);
    },
    async readGroupByDomain() {
      const stored = await browser.storage.local.get(OPTIONS_GROUP_BY_DOMAIN_STORAGE_KEY);
      return stored[OPTIONS_GROUP_BY_DOMAIN_STORAGE_KEY] === true;
    },
    async writeGroupByDomain(value) {
      await browser.storage.local.set({ [OPTIONS_GROUP_BY_DOMAIN_STORAGE_KEY]: value });
    },
    async openSessionInSidePanel(id) {
      await browser.storage.local.set({ [DISPLAY_SESSION_ID_STORAGE_KEY]: id });
      await bumpRevision(browser);
      // Best-effort panel open. Firefox `openPanel` is a no-op on the shim; Chrome requires an
      // active tab id for `sidePanel.open`. The panel reloads via storage change regardless.
      if (browser.openPanel !== undefined) {
        try {
          await browser.openPanel();
        } catch {
          // A missing user gesture (background-triggered call) rejects — surface the pointer
          // change silently rather than failing the whole click handler.
        }
      }
    },
  };
}

async function bumpRevision(browser: OptionsBrowser): Promise<void> {
  const stored = await browser.storage.local.get(SESSION_REVISION_STORAGE_KEY);
  await browser.storage.local.set({
    [SESSION_REVISION_STORAGE_KEY]: nextSessionRevision(
      stored[SESSION_REVISION_STORAGE_KEY],
    ),
  });
}
