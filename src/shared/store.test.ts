/// <reference lib="dom" />
/**
 * Tests for the IndexedDB store, run against `fake-indexeddb` — real IndexedDB semantics without a
 * browser. Re-verified in the extension's live page-context tests.
 *
 * @module
 */
import "fake-indexeddb/auto";

import { assertEquals, assertRejects } from "@std/assert";
import { SCHEMA_VERSION, type Session } from "./schema.ts";
import {
  clearSessions,
  DB_NAME,
  DB_VERSION,
  deleteSession,
  getSession,
  listSessions,
  openStore,
  putSession,
  QuotaExceededError,
  RecordValidationError,
} from "./store.ts";

function makeSession(id: string): Session {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: `Session ${id}`,
    createdAt: "2026-07-27T00:00:00.000Z",
    endedAt: null,
    notes: [],
  };
}

/** Deletes the database so each test starts from a clean slate — `fake-indexeddb`'s state is global. */
function resetDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

Deno.test("openStore - creates the sessions store via the v0->v1 migration on a fresh database", async () => {
  await resetDb();
  const db = await openStore();
  try {
    assertEquals(Array.from(db.objectStoreNames), ["sessions"]);
  } finally {
    db.close();
  }
});

Deno.test("openStore - yields to a later version bump instead of deadlocking it", async () => {
  await resetDb();
  // Stands in for the service worker holding a connection while the side panel, loaded after an
  // extension update, opens the same database at a higher version. Without `onversionchange` closing
  // this connection, that upgrade blocks and — since MV3 keeps every context on one database — the
  // first `DB_VERSION` bump after release deadlocks whichever context opened second.
  const held = await openStore();
  try {
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION + 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("upgrade was blocked by the held connection"));
    });
    assertEquals(upgraded.version, DB_VERSION + 1);
    upgraded.close();
  } finally {
    held.close();
    await resetDb();
  }
});

Deno.test("putSession/getSession - round-trips a session with a base64 note through validation", async () => {
  await resetDb();
  const db = await openStore();
  try {
    const session: Session = {
      ...makeSession("session-1"),
      notes: [
        {
          id: "note-1",
          createdAt: "2026-07-27T00:01:00.000Z",
          pageUrl: "https://example.com",
          pageTitle: "Example",
          region: {
            screenshot: "data:image/webp;base64,AAAA",
            viewport: { width: 1280, height: 720 },
            box: { x: 0, y: 0, width: 10, height: 10 },
            truncated: false,
          },
          elements: [],
          text: "note text",
        },
      ],
    };

    await putSession(db, session);
    const read = await getSession(db, "session-1");
    assertEquals(read, session);
  } finally {
    db.close();
  }
});

Deno.test("getSession - returns null for a missing id", async () => {
  await resetDb();
  const db = await openStore();
  try {
    assertEquals(await getSession(db, "does-not-exist"), null);
  } finally {
    db.close();
  }
});

Deno.test("getSession - throws RecordValidationError for a malformed stored record", async () => {
  await resetDb();
  const db = await openStore();
  try {
    // Bypass `putSession`'s typed signature to write a record the schema validator must reject.
    const tx = db.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put({ id: "bad", schemaVersion: SCHEMA_VERSION });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await assertRejects(() => getSession(db, "bad"), RecordValidationError);
  } finally {
    db.close();
  }
});

Deno.test("listSessions - lists valid sessions and silently skips an invalid one", async () => {
  await resetDb();
  const db = await openStore();
  try {
    await putSession(db, makeSession("good-1"));
    await putSession(db, makeSession("good-2"));

    const tx = db.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put({ id: "bad" });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const sessions = await listSessions(db);
    assertEquals(sessions.map((s) => s.id).sort(), ["good-1", "good-2"]);
  } finally {
    db.close();
  }
});

Deno.test("deleteSession - removes a session; a repeat delete is a no-op", async () => {
  await resetDb();
  const db = await openStore();
  try {
    await putSession(db, makeSession("session-1"));
    await deleteSession(db, "session-1");
    assertEquals(await getSession(db, "session-1"), null);
    await deleteSession(db, "session-1");
  } finally {
    db.close();
  }
});

Deno.test("clearSessions - removes every session in one transaction", async () => {
  await resetDb();
  const db = await openStore();
  try {
    await putSession(db, makeSession("first"));
    await putSession(db, makeSession("second"));

    await clearSessions(db);

    assertEquals(await listSessions(db), []);
  } finally {
    db.close();
    await resetDb();
  }
});

Deno.test("putSession - surfaces a quota-exceeded write as a typed QuotaExceededError", async () => {
  await resetDb();
  const db = await openStore();
  try {
    // `fake-indexeddb` has no storage cap to actually exhaust, so the quota error is stubbed at the
    // `IDBObjectStore.put` seam: abort the transaction and set its `error` to the DOMException real
    // engines report on quota exhaustion, then confirm `putSession` maps that into the typed error.
    const originalTransaction = db.transaction.bind(db);
    // deno-lint-ignore no-explicit-any
    (db as any).transaction = (...args: Parameters<typeof db.transaction>) => {
      const tx = originalTransaction(...args);
      const store = tx.objectStore("sessions");
      store.put = () => {
        queueMicrotask(() => tx.abort());
        Object.defineProperty(tx, "error", {
          value: new DOMException("quota exceeded", "QuotaExceededError"),
          configurable: true,
        });
        return {} as IDBRequest;
      };
      return tx;
    };

    await assertRejects(() => putSession(db, makeSession("session-1")), QuotaExceededError);
  } finally {
    db.close();
  }
});
