import { assertEquals } from "@std/assert";
import type { BrowserShim, StorageChangedListener, StorageItems } from "../shared/browser.ts";
import { DEFAULT_SETTINGS, saveSettings, SETTINGS_STORAGE_KEY } from "../shared/settings.ts";
import { watchSettings } from "./settings-watcher.ts";

function createStorage(): BrowserShim["storage"] & {
  emit(areaName?: string): void;
} {
  const values: StorageItems = {};
  const listeners = new Set<StorageChangedListener>();
  return {
    emit(areaName = "local") {
      for (const listener of listeners) {
        listener({ [SETTINGS_STORAGE_KEY]: { newValue: values[SETTINGS_STORAGE_KEY] } }, areaName);
      }
    },
    local: {
      get(keys) {
        if (keys == null) return Promise.resolve({ ...values });
        const selected = Array.isArray(keys) ? keys : [keys];
        return Promise.resolve(
          Object.fromEntries(
            selected.filter((key) => key in values).map((key) => [key, values[key]]),
          ),
        );
      },
      remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        return Promise.resolve();
      },
      set(items) {
        Object.assign(values, items);
        return Promise.resolve();
      },
    },
    session: {
      get() {
        return Promise.resolve({});
      },
      remove() {
        return Promise.resolve();
      },
      set() {
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
    },
  };
}

Deno.test("content settings watcher loads, refreshes, and stops cleanly", async () => {
  const storage = createStorage();
  await saveSettings(storage.local, {
    ...DEFAULT_SETTINGS,
    themeOverride: "dark",
  });
  const observed: { readonly frameworkHints: boolean; readonly theme: string }[] = [];

  const stop = watchSettings(storage, (settings) =>
    observed.push({
      frameworkHints: settings.frameworkHints,
      theme: settings.themeOverride,
    }));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await saveSettings(storage.local, {
    ...DEFAULT_SETTINGS,
    frameworkHints: true,
    themeOverride: "light",
  });
  storage.emit();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  storage.emit("sync");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  stop();
  await saveSettings(storage.local, DEFAULT_SETTINGS);
  storage.emit();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(observed, [
    { frameworkHints: false, theme: "dark" },
    { frameworkHints: true, theme: "light" },
  ]);
});
