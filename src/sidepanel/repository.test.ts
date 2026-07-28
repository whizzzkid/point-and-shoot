/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals } from "@std/assert";
import type { BrowserShim, StorageItems } from "../shared/browser.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import { ACTIVE_SESSION_ID_STORAGE_KEY } from "../shared/session.ts";
import { DB_NAME, openStore, putSession } from "../shared/store.ts";
import { createNotesRepository } from "./repository.ts";

const SESSION: Session = {
  createdAt: "2026-07-28T12:00:00.000Z",
  endedAt: null,
  id: "session-1",
  name: "Checkout review",
  notes: [],
  schemaVersion: SCHEMA_VERSION,
};

function createStorage(activeId?: string): BrowserShim["storage"]["local"] {
  const values: StorageItems = activeId === undefined
    ? {}
    : { [ACTIVE_SESSION_ID_STORAGE_KEY]: activeId };
  return {
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

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

Deno.test("notes repository persists edits across fresh connections", async () => {
  await resetDatabase();
  const storage = createStorage("session-1");
  const first = createNotesRepository(storage);
  await first.save(SESSION);
  const second = createNotesRepository(storage);

  assertEquals(await second.load(), SESSION);
  await resetDatabase();
});

Deno.test("notes repository returns null without a valid active-session pointer", async () => {
  await resetDatabase();
  assertEquals(await createNotesRepository(createStorage()).load(), null);
  assertEquals(await createNotesRepository(createStorage("missing")).load(), null);

  const database = await openStore();
  try {
    await putSession(database, SESSION);
  } finally {
    database.close();
  }
  assertEquals(await createNotesRepository(createStorage("session-1")).load(), SESSION);
  await resetDatabase();
});
