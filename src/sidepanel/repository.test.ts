/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals } from "@std/assert";
import type { BrowserShim, StorageChangedListener, StorageItems } from "../shared/browser.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { DB_NAME, openStore, putSession } from "../shared/store.ts";
import { createNotesRepository } from "./repository.ts";

const SESSION: Session = {
  createdAt: "2026-07-28T12:00:00.000Z",
  domain: null,
  endedAt: null,
  id: "session-1",
  name: "Checkout review",
  notes: [],
  schemaVersion: SCHEMA_VERSION,
};

function createStorage(
  activeId?: string,
  displayId?: string,
): BrowserShim["storage"]["local"] {
  const values: StorageItems = {};
  if (activeId !== undefined) values[ACTIVE_SESSION_ID_STORAGE_KEY] = activeId;
  if (displayId !== undefined) values[DISPLAY_SESSION_ID_STORAGE_KEY] = displayId;
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

Deno.test("notes repository advances the shared revision after every save", async () => {
  await resetDatabase();
  const storage = createStorage("session-1");
  await storage.set({ [SESSION_REVISION_STORAGE_KEY]: 4 });
  const repository = createNotesRepository(storage);

  await repository.save(SESSION);
  assertEquals(
    (await storage.get(SESSION_REVISION_STORAGE_KEY))[SESSION_REVISION_STORAGE_KEY],
    5,
  );

  await repository.save({ ...SESSION, name: "Renamed" });
  assertEquals(
    (await storage.get(SESSION_REVISION_STORAGE_KEY))[SESSION_REVISION_STORAGE_KEY],
    6,
  );
  await resetDatabase();
});

Deno.test("notes repository resets an invalid shared revision when saving", async () => {
  await resetDatabase();
  const storage = createStorage("session-1");
  await storage.set({ [SESSION_REVISION_STORAGE_KEY]: "stale" });

  await createNotesRepository(storage).save(SESSION);

  assertEquals(
    (await storage.get(SESSION_REVISION_STORAGE_KEY))[SESSION_REVISION_STORAGE_KEY],
    1,
  );
  await resetDatabase();
});

Deno.test("notes repository keeps a persisted save successful when revision publishing fails", async () => {
  await resetDatabase();
  const storage = createStorage("session-1");
  const failingStorage: BrowserShim["storage"]["local"] = {
    ...storage,
    set(items) {
      if (SESSION_REVISION_STORAGE_KEY in items) {
        return Promise.reject(new Error("revision storage unavailable"));
      }
      return storage.set(items);
    },
  };
  const renamed = { ...SESSION, name: "Renamed" };

  await createNotesRepository(failingStorage).save(renamed);

  assertEquals(await createNotesRepository(storage).load(), renamed);
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

Deno.test("notes repository keeps loading the displayed session after it ends", async () => {
  await resetDatabase();
  const completed = {
    ...SESSION,
    endedAt: "2026-07-28T12:30:00.000Z",
  };
  const database = await openStore();
  try {
    await putSession(database, completed);
  } finally {
    database.close();
  }

  assertEquals(
    await createNotesRepository(createStorage(undefined, "session-1")).load(),
    completed,
  );
  await resetDatabase();
});

Deno.test("notes repository lists sessions filtered by domain, newest first", async () => {
  await resetDatabase();
  const database = await openStore();
  try {
    await putSession(database, {
      ...SESSION,
      id: "example-older",
      domain: "example.com",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    await putSession(database, {
      ...SESSION,
      id: "example-newer",
      domain: "example.com",
      createdAt: "2026-08-14T00:00:00.000Z",
    });
    await putSession(database, {
      ...SESSION,
      id: "other-domain",
      domain: "docs.example.com",
      createdAt: "2026-08-10T00:00:00.000Z",
    });
  } finally {
    database.close();
  }

  const repository = createNotesRepository(createStorage());
  const listed = await repository.listForDomain("example.com");
  assertEquals(listed.map((session) => session.id), ["example-newer", "example-older"]);
  await resetDatabase();
});

Deno.test("notes repository loadIntoPanel repoints displaySessionId and bumps revision", async () => {
  await resetDatabase();
  const storage = createStorage();
  await createNotesRepository(storage).loadIntoPanel("session-x");
  const stored = await storage.get([DISPLAY_SESSION_ID_STORAGE_KEY, SESSION_REVISION_STORAGE_KEY]);
  assertEquals(stored[DISPLAY_SESSION_ID_STORAGE_KEY], "session-x");
  assertEquals(stored[SESSION_REVISION_STORAGE_KEY], 1);
});

Deno.test(
  "notes repository deleteFromPanel removes stored record and clears matching pointers",
  async () => {
    await resetDatabase();
    const storage = createStorage("session-1", "session-1");
    const database = await openStore();
    try {
      await putSession(database, SESSION);
    } finally {
      database.close();
    }

    await createNotesRepository(storage).deleteFromPanel("session-1");

    const stored = await storage.get([
      ACTIVE_SESSION_ID_STORAGE_KEY,
      DISPLAY_SESSION_ID_STORAGE_KEY,
    ]);
    assertEquals(stored[ACTIVE_SESSION_ID_STORAGE_KEY], undefined);
    assertEquals(stored[DISPLAY_SESSION_ID_STORAGE_KEY], undefined);
    assertEquals(await createNotesRepository(storage).load(), null);
    await resetDatabase();
  },
);

Deno.test("notes repository currentDomain reads the active tab hostname", async () => {
  const tabs: Pick<BrowserShim["tabs"], "query"> = {
    query: () => Promise.resolve([{ id: 1, url: "https://docs.example.com/a?b=1" }]),
  };
  const repository = createNotesRepository(createStorage(), undefined, tabs);
  assertEquals(await repository.currentDomain(), "docs.example.com");
});

Deno.test("notes repository currentDomain returns null when tab URL is unparseable", async () => {
  const tabs: Pick<BrowserShim["tabs"], "query"> = {
    query: () => Promise.resolve([{ id: 1, url: "" }]),
  };
  const repository = createNotesRepository(createStorage(), undefined, tabs);
  assertEquals(await repository.currentDomain(), null);
});

Deno.test("notes repository watches session pointer and revision changes", () => {
  let listener: StorageChangedListener | undefined;
  let removed: StorageChangedListener | undefined;
  const repository = createNotesRepository(createStorage(), {
    addListener(next) {
      listener = next;
    },
    removeListener(previous) {
      removed = previous;
    },
  });
  let changes = 0;
  const stop = repository.watch(() => {
    changes += 1;
  });

  listener?.({ unrelated: { newValue: true } }, "local");
  listener?.({ [SESSION_REVISION_STORAGE_KEY]: { newValue: 1 } }, "sync");
  listener?.({ [DISPLAY_SESSION_ID_STORAGE_KEY]: { newValue: "session-1" } }, "local");
  listener?.({ [SESSION_REVISION_STORAGE_KEY]: { newValue: 2 } }, "local");
  stop();

  assertEquals(changes, 2);
  assertEquals(removed, listener);
});
