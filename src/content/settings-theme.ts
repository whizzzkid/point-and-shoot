import type { BrowserShim, StorageChangedListener } from "../shared/browser.ts";
import { loadSettings, SETTINGS_STORAGE_KEY } from "../shared/settings.ts";
import type { ThemeOverride } from "../shared/theme.ts";

/**
 * Watches the persisted theme override for one mounted content surface.
 *
 * @param storage Extension-local storage and its cross-context change event.
 * @param onChange Receives validated override changes, including the initial value.
 * @returns Cleanup callback that removes the listener and ignores pending reads.
 */
export function watchThemeOverride(
  storage: BrowserShim["storage"],
  onChange: (override: ThemeOverride) => void,
): () => void {
  let active = true;
  let current: ThemeOverride | undefined;
  let generation = 0;

  const refresh = (): void => {
    const selectedGeneration = ++generation;
    void loadSettings(storage.local)
      .then((settings) => {
        if (!active || selectedGeneration !== generation) return;
        if (settings.themeOverride === current) return;
        current = settings.themeOverride;
        onChange(current);
      })
      .catch((error: unknown) => {
        if (active) console.error("point-and-shoot: theme settings could not load", error);
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
