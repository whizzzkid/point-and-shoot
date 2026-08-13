/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import type { ExtensionSettings } from "../shared/settings.ts";
import { loadSettings, saveSettings } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { clearSessions, openStore } from "../shared/store.ts";

/** Browser capabilities used by the options page. */
export interface OptionsBrowser {
  readonly commands: Pick<BrowserShim["commands"], "getAll">;
  readonly runtimeInfo: BrowserShim["runtimeInfo"];
  readonly storage: Pick<BrowserShim["storage"], "local">;
  readonly tabs: Pick<BrowserShim["tabs"], "create">;
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
}

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
  };
}
