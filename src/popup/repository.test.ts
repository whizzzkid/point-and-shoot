/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals } from "@std/assert";
import type { BrowserShim, StorageItems } from "../shared/browser.ts";
import { ACTIVE_SESSION_ID_STORAGE_KEY } from "../shared/session.ts";
import { DB_NAME } from "../shared/store.ts";
import { createPopupSessionRepository } from "./repository.ts";

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

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

Deno.test("popup repository starts one session and resumes it on later calls", async () => {
  await resetDatabase();
  const storage = createStorage();
  const repository = createPopupSessionRepository(storage, {
    createId: () => "session-popup",
    now: () => new Date("2026-07-28T18:00:00.000Z"),
  });

  assertEquals(await repository.load(), null);
  const started = await repository.startOrResume();
  const resumed = await repository.startOrResume();

  assertEquals(started, {
    createdAt: "2026-07-28T18:00:00.000Z",
    endedAt: null,
    id: "session-popup",
    name: "Untitled session",
    notes: [],
    schemaVersion: 1,
  });
  assertEquals(resumed, started);
  assertEquals(storage.values[ACTIVE_SESSION_ID_STORAGE_KEY], "session-popup");
  assertEquals(await repository.load(), started);
  await resetDatabase();
});

Deno.test("popup repository replaces a stale active-session pointer", async () => {
  await resetDatabase();
  const storage = createStorage();
  storage.values[ACTIVE_SESSION_ID_STORAGE_KEY] = "missing";
  const repository = createPopupSessionRepository(storage, {
    createId: () => "replacement",
    now: () => new Date("2026-07-28T18:01:00.000Z"),
  });

  assertEquals((await repository.startOrResume()).id, "replacement");
  assertEquals(storage.values[ACTIVE_SESSION_ID_STORAGE_KEY], "replacement");
  await resetDatabase();
});

Deno.test("popup repository serializes concurrent starts into one session", async () => {
  await resetDatabase();
  const storage = createStorage();
  let idCount = 0;
  const repository = createPopupSessionRepository(storage, {
    createId: () => `session-${++idCount}`,
    now: () => new Date("2026-07-28T18:02:00.000Z"),
  });

  const [first, second] = await Promise.all([
    repository.startOrResume(),
    repository.startOrResume(),
  ]);

  assertEquals(first.id, "session-1");
  assertEquals(second.id, "session-1");
  assertEquals(idCount, 1);
  await resetDatabase();
});
