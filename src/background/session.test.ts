/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals } from "@std/assert";
import type { BrowserShim, StorageItems } from "../shared/browser.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { DB_NAME, getSession, openStore, putSession } from "../shared/store.ts";
import { createSessionService } from "./session.ts";

function createStorage(initial: StorageItems = {}): {
  readonly local: BrowserShim["storage"]["local"];
  readonly values: Map<string, unknown>;
} {
  const values = new Map(Object.entries(initial));
  return {
    local: {
      get(keys) {
        if (keys == null) return Promise.resolve(Object.fromEntries(values));
        const selected = Array.isArray(keys) ? keys : [keys];
        const result: StorageItems = {};
        for (const key of selected) if (values.has(key)) result[key] = values.get(key);
        return Promise.resolve(result);
      },
      remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key);
        return Promise.resolve();
      },
      set(items) {
        for (const [key, value] of Object.entries(items)) values.set(key, value);
        return Promise.resolve();
      },
    },
    values,
  };
}

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

Deno.test("session service starts, resumes, ends, and starts fresh", async () => {
  await resetDatabase();
  const storage = createStorage();
  const ids = ["session-1", "session-2"];
  const times = [
    new Date("2026-07-30T12:00:00.000Z"),
    new Date("2026-07-30T12:05:00.000Z"),
    new Date("2026-07-30T12:10:00.000Z"),
  ];
  const service = createSessionService(storage.local, {
    createId() {
      const id = ids.shift();
      if (id === undefined) throw new Error("deterministic id sequence exhausted");
      return id;
    },
    now() {
      const time = times.shift();
      if (time === undefined) throw new Error("deterministic clock exhausted");
      return time;
    },
    openDatabase: openStore,
  });

  const started = await service.start();
  const resumed = await service.start();
  const ended = await service.end();

  assertEquals(resumed, started);
  assertEquals(ended, {
    ...started,
    endedAt: "2026-07-30T12:05:00.000Z",
  });
  assertEquals(storage.values.get(ACTIVE_SESSION_ID_STORAGE_KEY), undefined);
  assertEquals(storage.values.get(DISPLAY_SESSION_ID_STORAGE_KEY), "session-1");
  assertEquals(storage.values.get(SESSION_REVISION_STORAGE_KEY), 2);
  assertEquals(await service.loadActive(), null);

  const fresh = await service.start();
  assertEquals(fresh.id, "session-2");
  assertEquals(fresh.createdAt, "2026-07-30T12:10:00.000Z");
  assertEquals(fresh.endedAt, null);
  assertEquals(storage.values.get(ACTIVE_SESSION_ID_STORAGE_KEY), "session-2");
  assertEquals(storage.values.get(DISPLAY_SESSION_ID_STORAGE_KEY), "session-2");
  assertEquals(storage.values.get(SESSION_REVISION_STORAGE_KEY), 3);

  const database = await openStore();
  try {
    assertEquals(await getSession(database, "session-1"), ended);
    assertEquals(await getSession(database, "session-2"), fresh);
  } finally {
    database.close();
    await resetDatabase();
  }
});

Deno.test("session service names a new session from the page title and local creation time", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = createSessionService(storage.local, {
    createId: () => "named-session",
    now: () => new Date(2026, 7, 4, 9, 5, 6),
    openDatabase: openStore,
  });

  const started = await service.start("Checkout — Example Store");

  assertEquals(started.name, "Checkout — Example Store-2026-08-04-09-05-06");
  await resetDatabase();
});

Deno.test("session service falls back when the page title is blank", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = createSessionService(storage.local, {
    createId: () => "fallback-session",
    now: () => new Date(2026, 7, 4, 9, 5, 6),
    openDatabase: openStore,
  });

  const started = await service.start("   ");

  assertEquals(started.name, "Untitled page-2026-08-04-09-05-06");
  await resetDatabase();
});

Deno.test("session service replaces a stale or already-ended active pointer", async () => {
  await resetDatabase();
  const storage = createStorage({ [ACTIVE_SESSION_ID_STORAGE_KEY]: "ended-session" });
  const endedSession: Session = {
    createdAt: "2026-07-30T11:00:00.000Z",
    domain: null,
    endedAt: "2026-07-30T11:30:00.000Z",
    id: "ended-session",
    name: "Completed review",
    notes: [],
    schemaVersion: SCHEMA_VERSION,
  };
  const database = await openStore();
  try {
    await putSession(database, endedSession);
  } finally {
    database.close();
  }
  const service = createSessionService(storage.local, {
    createId: () => "fresh-session",
    now: () => new Date("2026-07-30T12:00:00.000Z"),
    openDatabase: openStore,
  });

  assertEquals(await service.loadActive(), null);
  assertEquals((await service.start()).id, "fresh-session");
  assertEquals(storage.values.get(ACTIVE_SESSION_ID_STORAGE_KEY), "fresh-session");
  assertEquals(storage.values.get(DISPLAY_SESSION_ID_STORAGE_KEY), "fresh-session");

  await resetDatabase();
});

Deno.test("session service captures the tab hostname as the session domain", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = createSessionService(storage.local, {
    createId: () => "domain-session",
    now: () => new Date("2026-07-30T12:00:00.000Z"),
    openDatabase: openStore,
  });

  const started = await service.start("Docs", "https://docs.example.com/guide?ref=x");
  assertEquals(started.domain, "docs.example.com");
  await resetDatabase();
});

Deno.test("session service leaves domain null when the tab URL is unparseable", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = createSessionService(storage.local, {
    createId: () => "no-domain-session",
    now: () => new Date("2026-07-30T12:00:00.000Z"),
    openDatabase: openStore,
  });

  const started = await service.start("New tab", "");
  assertEquals(started.domain, null);
  await resetDatabase();
});

Deno.test("session service serializes concurrent start requests", async () => {
  await resetDatabase();
  const storage = createStorage();
  let identifiersCreated = 0;
  const service = createSessionService(storage.local, {
    createId() {
      identifiersCreated += 1;
      return `session-${identifiersCreated}`;
    },
    now: () => new Date("2026-07-30T12:00:00.000Z"),
    openDatabase: openStore,
  });

  const sessions = await Promise.all([service.start(), service.start()]);

  assertEquals(sessions[0]?.id, "session-1");
  assertEquals(sessions[1]?.id, "session-1");
  assertEquals(identifiersCreated, 1);
  await resetDatabase();
});
