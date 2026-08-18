import type { BrowserShim, StorageChangedListener } from "../shared/browser.ts";
import { type ExtensionSettings, loadSettings, SETTINGS_STORAGE_KEY } from "../shared/settings.ts";

function settingsEqual(
  first: ExtensionSettings | undefined,
  second: ExtensionSettings,
): boolean {
  return first !== undefined &&
    first.frameworkHints === second.frameworkHints &&
    first.schemaVersion === second.schemaVersion &&
    first.screenshotMaxDimension === second.screenshotMaxDimension &&
    first.screenshotQuality === second.screenshotQuality &&
    first.stripSensitiveQueries === second.stripSensitiveQueries &&
    first.themeOverride === second.themeOverride;
}

/**
 * Watches the complete persisted settings record for one long-lived content realm.
 *
 * @param storage Extension-local storage and its cross-context change event.
 * @param onChange Receives validated settings changes, including the initial value.
 * @returns Cleanup callback that removes the listener and ignores pending reads.
 */
export function watchSettings(
  storage: BrowserShim["storage"],
  onChange: (settings: ExtensionSettings) => void,
): () => void {
  let active = true;
  let current: ExtensionSettings | undefined;
  let generation = 0;

  const refresh = (): void => {
    const selectedGeneration = ++generation;
    void loadSettings(storage.local)
      .then((settings) => {
        if (!active || selectedGeneration !== generation) return;
        if (settingsEqual(current, settings)) return;
        current = settings;
        onChange(settings);
      })
      .catch((error: unknown) => {
        if (active) console.error("point-and-shoot: content settings could not load", error);
      });
  };
  const listener: StorageChangedListener = (changes, areaName) => {
    if (areaName === "local" && SETTINGS_STORAGE_KEY in changes) refresh();
  };

  storage.onChanged.addListener(listener);
  refresh();

  return () => {
    active = false;
    generation++;
    storage.onChanged.removeListener(listener);
  };
}
