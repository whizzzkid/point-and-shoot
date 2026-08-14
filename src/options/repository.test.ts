/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals } from "@std/assert";
import type { BrowserShim, Engine, StorageItems } from "../shared/browser.ts";
import { SCHEMA_VERSION } from "../shared/schema.ts";
import { DEFAULT_SETTINGS, saveSettings, SETTINGS_STORAGE_KEY } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { DB_NAME, listSessions, openStore, putSession } from "../shared/store.ts";
import { createOptionsRepository, type OptionsBrowser } from "./repository.ts";

function createStorage(): BrowserShim["storage"]["local"] & {
  readonly values: StorageItems;
} {
  const values: StorageItems = {};
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

function createBrowser(engine: Engine): {
  readonly browser: OptionsBrowser;
  readonly openedUrls: string[];
  readonly storage: ReturnType<typeof createStorage>;
} {
  const openedUrls: string[] = [];
  const storage = createStorage();
  return {
    browser: {
      commands: {
        getAll: () =>
          Promise.resolve([{
            description: "Toggle capture",
            name: "_execute_action",
            shortcut: "Command+Shift+P",
          }]),
      },
      runtimeInfo: { engine },
      storage: { local: storage },
      tabs: {
        create(properties) {
          openedUrls.push(properties.url);
          return Promise.resolve({ active: true, id: 4 });
        },
      },
    },
    openedUrls,
    storage,
  };
}

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

Deno.test("options repository loads and saves settings with the assigned shortcut", async () => {
  await resetDatabase();
  const fake = createBrowser("chrome");
  const repository = createOptionsRepository(fake.browser);

  assertEquals(await repository.load(), {
    settings: DEFAULT_SETTINGS,
    shortcut: "Command+Shift+P",
  });

  const changed = {
    ...DEFAULT_SETTINGS,
    frameworkHints: true,
    themeOverride: "light" as const,
  };
  await repository.save(changed);

  assertEquals((await repository.load()).settings, changed);
  await resetDatabase();
});

Deno.test("options repository keeps settings usable when shortcut lookup fails", async () => {
  const fake = createBrowser("chrome");
  const repository = createOptionsRepository({
    ...fake.browser,
    commands: {
      getAll: () => Promise.reject(new Error("commands unavailable")),
    },
  });

  assertEquals(await repository.load(), {
    settings: DEFAULT_SETTINGS,
    shortcut: "Not assigned",
  });
});

Deno.test("options repository clears sessions and the active pointer without deleting settings", async () => {
  await resetDatabase();
  const fake = createBrowser("chrome");
  await saveSettings(fake.storage, DEFAULT_SETTINGS);
  fake.storage.values[ACTIVE_SESSION_ID_STORAGE_KEY] = "session-options";
  fake.storage.values[DISPLAY_SESSION_ID_STORAGE_KEY] = "session-options";
  fake.storage.values[SESSION_REVISION_STORAGE_KEY] = 4;
  const database = await openStore();
  await putSession(database, {
    createdAt: "2026-07-28T20:00:00.000Z",
    domain: null,
    endedAt: null,
    id: "session-options",
    name: "Options test",
    notes: [],
    schemaVersion: SCHEMA_VERSION,
  });
  database.close();

  await createOptionsRepository(fake.browser).clearSessions();

  const reopened = await openStore();
  assertEquals(await listSessions(reopened), []);
  reopened.close();
  assertEquals(fake.storage.values[ACTIVE_SESSION_ID_STORAGE_KEY], undefined);
  assertEquals(fake.storage.values[DISPLAY_SESSION_ID_STORAGE_KEY], undefined);
  assertEquals(fake.storage.values[SESSION_REVISION_STORAGE_KEY], undefined);
  assertEquals(fake.storage.values[SETTINGS_STORAGE_KEY], DEFAULT_SETTINGS);
  await resetDatabase();
});

Deno.test(
  "options repository lists sessions newest-first and deletes them individually",
  async () => {
    await resetDatabase();
    const fake = createBrowser("chrome");
    const database = await openStore();
    const seed = (id: string, createdAt: string, domain: string | null) => {
      return putSession(database, {
        createdAt,
        domain,
        endedAt: null,
        id,
        name: `Session ${id}`,
        notes: [],
        schemaVersion: SCHEMA_VERSION,
      });
    };
    await seed("older", "2026-08-01T00:00:00.000Z", "example.com");
    await seed("newer", "2026-08-14T00:00:00.000Z", "docs.example.com");
    await seed("unknown", "2026-08-10T00:00:00.000Z", null);
    database.close();

    const repository = createOptionsRepository(fake.browser);
    const listed = await repository.listAllSessions();
    assertEquals(listed.map((session) => session.id), ["newer", "unknown", "older"]);

    fake.storage.values[DISPLAY_SESSION_ID_STORAGE_KEY] = "newer";
    await repository.deleteSessionById("newer");
    assertEquals(fake.storage.values[DISPLAY_SESSION_ID_STORAGE_KEY], undefined);
    assertEquals(fake.storage.values[SESSION_REVISION_STORAGE_KEY], 1);
    const after = await repository.listAllSessions();
    assertEquals(after.map((session) => session.id), ["unknown", "older"]);
    await resetDatabase();
  },
);

Deno.test("options repository persists the group-by-domain preference", async () => {
  const fake = createBrowser("chrome");
  const repository = createOptionsRepository(fake.browser);

  assertEquals(await repository.readGroupByDomain(), false);
  await repository.writeGroupByDomain(true);
  assertEquals(await repository.readGroupByDomain(), true);
  await repository.writeGroupByDomain(false);
  assertEquals(await repository.readGroupByDomain(), false);
});

Deno.test(
  "options repository openSessionInSidePanel bumps revision and sets displaySessionId",
  async () => {
    const fake = createBrowser("chrome");
    const repository = createOptionsRepository(fake.browser);
    await repository.openSessionInSidePanel("session-x");
    assertEquals(fake.storage.values[DISPLAY_SESSION_ID_STORAGE_KEY], "session-x");
    assertEquals(fake.storage.values[SESSION_REVISION_STORAGE_KEY], 1);
  },
);

Deno.test("options repository opens each browser's own shortcut settings page", async () => {
  const chrome = createBrowser("chrome");
  const firefox = createBrowser("firefox");

  await createOptionsRepository(chrome.browser).openShortcutSettings();
  await createOptionsRepository(firefox.browser).openShortcutSettings();

  assertEquals(chrome.openedUrls, ["chrome://extensions/shortcuts"]);
  assertEquals(firefox.openedUrls, ["about:addons"]);
});
