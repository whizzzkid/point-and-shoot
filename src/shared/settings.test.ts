import { assertEquals, assertRejects } from "@std/assert";
import type { BrowserShim, StorageItems } from "./browser.ts";
import {
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  loadSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "./settings.ts";

function createStorage(
  initial: StorageItems = {},
): BrowserShim["storage"]["local"] & { readonly values: StorageItems } {
  const values = { ...initial };
  return {
    values,
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
  };
}

Deno.test("settings load the settled defaults when extension storage is empty", async () => {
  const storage = createStorage();

  assertEquals(await loadSettings(storage), {
    exportSizeBudgetBytes: 2_000_000,
    frameworkHints: false,
    schemaVersion: 1,
    screenshotMaxDimension: 1_024,
    screenshotQuality: 0.7,
    stripSensitiveQueries: true,
    themeOverride: "auto",
  });
  assertEquals(DEFAULT_SETTINGS, await loadSettings(storage));
});

Deno.test("settings round-trip every supported value through one typed record", async () => {
  const storage = createStorage();
  const settings = {
    exportSizeBudgetBytes: 8_000_000,
    frameworkHints: true,
    schemaVersion: 1 as const,
    screenshotMaxDimension: 2_048,
    screenshotQuality: 0.85,
    stripSensitiveQueries: false,
    themeOverride: "light" as const,
  } satisfies ExtensionSettings;

  await saveSettings(storage, settings);

  assertEquals(storage.values[SETTINGS_STORAGE_KEY], settings);
  assertEquals(await loadSettings(storage), settings);
});

Deno.test("settings reject invalid writes and recover corrupt stored records with defaults", async () => {
  const storage = createStorage({
    [SETTINGS_STORAGE_KEY]: {
      ...DEFAULT_SETTINGS,
      screenshotQuality: 2,
    },
  });

  assertEquals(await loadSettings(storage), DEFAULT_SETTINGS);
  await assertRejects(
    () =>
      saveSettings(storage, {
        ...DEFAULT_SETTINGS,
        exportSizeBudgetBytes: 3_000_000,
      } as unknown as ExtensionSettings),
    TypeError,
    "Invalid extension settings",
  );
});
