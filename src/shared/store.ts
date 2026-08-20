/// <reference lib="dom" />
/**
 * IndexedDB layer for the {@link ./schema.ts} record shape. Opens with an explicit version and an
 * `onupgradeneeded` migration path from day one — retrofitting migrations onto a store with real
 * user data is how a schema change becomes a data-loss bug, so the path exists before it is needed.
 *
 * @module
 */

import { type Session, validateSession } from "./schema.ts";

export const DB_NAME = "point-and-shoot";
export const DB_VERSION = 2;
const SESSIONS_STORE = "sessions";

/** Thrown by {@link putSession} when the browser's storage quota is exhausted. */
export class QuotaExceededError extends Error {
  constructor(cause: unknown) {
    super("IndexedDB storage quota exceeded — export or delete old sessions to free space.");
    this.name = "QuotaExceededError";
    this.cause = cause;
  }
}

/** Thrown by {@link getSession}/{@link listSessions} when a stored record fails validation. */
export class RecordValidationError extends Error {
  constructor(detail: string) {
    super(`stored record failed validation: ${detail}`);
    this.name = "RecordValidationError";
  }
}

/** Schemes where the extension can create sessions beyond standard http(s). */
const LOCAL_SCHEMES = new Set(["file:", "chrome-extension:", "moz-extension:"]);

/**
 * Extracts a domain identifier from a stored note's `pageUrl` for the v1→v2 domain backfill.
 * Duplicated from `session.ts` `domainFromUrl` to keep this module free of a background-only
 * dependency — the two implementations must stay in sync.
 */
function backfillDomain(pageUrl: unknown): string | null {
  if (typeof pageUrl !== "string" || pageUrl === "") return null;
  try {
    const parsed = new URL(pageUrl);
    if (parsed.protocol === "file:") {
      const lastSlash = parsed.pathname.lastIndexOf("/");
      return lastSlash > 0 ? parsed.pathname.slice(0, lastSlash + 1) : "/";
    }
    if (LOCAL_SCHEMES.has(parsed.protocol)) return parsed.hostname || null;
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.hostname || null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Migrations applied in `onupgradeneeded`, indexed by the version they bump *to* minus one —
 * `MIGRATIONS[0]` runs when `event.oldVersion` is `0`, bumping a fresh database to version 1. Add
 * to the end of this array, never edit an existing entry, when {@link DB_VERSION} is next bumped.
 *
 * A migration receives both the database (for schema changes like `createObjectStore`) and the
 * live upgrade transaction (for data reshapes via a cursor). Both are only usable inside
 * `onupgradeneeded`; the surrounding transaction commits when this function returns and any
 * cursor callbacks have resolved.
 */
const MIGRATIONS: readonly ((db: IDBDatabase, tx: IDBTransaction) => void)[] = [
  (db) => {
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
    }
  },
  // v1 → v2: add `domain` to every existing session, backfilling from the first note's `pageUrl`.
  // Also stamp `schemaVersion: 2` so `validateSession` accepts records written before the bump.
  (_db, tx) => {
    const store = tx.objectStore(SESSIONS_STORE);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const raw = cursor.value;
      // Guard against structured-clone corruption: a non-object row cannot be spread, and
      // `cursor.update` on garbage would just re-persist garbage. Skip and continue so one bad
      // row cannot brick the upgrade for the rest of the user's sessions — validation on read
      // handles the corrupt record later.
      if (typeof raw === "object" && raw !== null) {
        const record = raw as Record<string, unknown>;
        const notes = Array.isArray(record.notes) ? record.notes : [];
        const firstNote = notes[0] as { pageUrl?: unknown } | undefined;
        const migrated = {
          ...record,
          schemaVersion: 2,
          domain: backfillDomain(firstNote?.pageUrl),
        };
        cursor.update(migrated);
      }
      cursor.continue();
    };
  },
];

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // `tx.error` is `null` on an explicit `abort()`, and rejecting with `null` produces a thrown
    // value no `catch` can classify — `isQuotaExceeded` would see it and report a plain failure.
    tx.onabort = () => reject(tx.error ?? new Error("store: transaction aborted"));
  });
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && error.name === "QuotaExceededError";
}

/** Opens the extension's database, running every migration in {@link MIGRATIONS} needed to catch up. */
export function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // The upgrade transaction is the only handle able to read and write existing records;
      // schema-only migrations can ignore it, but data reshapes (v1→v2 domain backfill) need it.
      const tx = request.transaction;
      if (tx === null) {
        reject(new Error("openStore: upgrade event has no transaction"));
        return;
      }
      for (let version = event.oldVersion; version < DB_VERSION; version++) {
        MIGRATIONS[version]?.(db, tx);
      }
    };

    // An MV3 extension opens this database from the service worker, the side panel, the popup and
    // every injected content script at once. Without `onblocked` a version bump that finds an older
    // connection still open settles neither `onsuccess` nor `onerror`, so the caller's promise hangs
    // forever with no error to report.
    request.onblocked = () =>
      reject(
        new Error(
          `openStore: upgrade to version ${DB_VERSION} is blocked by an open connection in another ` +
            `extension context`,
        ),
      );

    request.onsuccess = () => {
      const db = request.result;
      // The other half of the same problem: this connection is what blocks the *next* context's
      // upgrade. Closing on `versionchange` lets that upgrade proceed instead of deadlocking it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Inserts or overwrites a session by id. Throws {@link QuotaExceededError} when storage is full. */
export async function putSession(db: IDBDatabase, session: Session): Promise<void> {
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  try {
    tx.objectStore(SESSIONS_STORE).put(session);
    await promisifyTransaction(tx);
  } catch (error) {
    if (isQuotaExceeded(error)) throw new QuotaExceededError(error);
    throw error;
  }
}

/** Reads a session by id, validating its shape. Returns `null` when no record has that id. */
export async function getSession(db: IDBDatabase, id: string): Promise<Session | null> {
  const tx = db.transaction(SESSIONS_STORE, "readonly");
  const raw = await promisifyRequest(tx.objectStore(SESSIONS_STORE).get(id));
  if (raw === undefined) return null;
  const result = validateSession(raw);
  if (!result.valid) throw new RecordValidationError(JSON.stringify(result.error));
  return result.session;
}

/** Lists every valid session, in whatever order the store returns them. Skips invalid records. */
export async function listSessions(db: IDBDatabase): Promise<Session[]> {
  const tx = db.transaction(SESSIONS_STORE, "readonly");
  const raws = await promisifyRequest(tx.objectStore(SESSIONS_STORE).getAll());
  const sessions: Session[] = [];
  for (const raw of raws) {
    const result = validateSession(raw);
    if (result.valid) sessions.push(result.session);
  }
  return sessions;
}

/** Deletes a session by id. A no-op if no record has that id. */
export async function deleteSession(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  tx.objectStore(SESSIONS_STORE).delete(id);
  await promisifyTransaction(tx);
}

/** Deletes every session in one transaction. Settings and other extension storage are untouched. */
export async function clearSessions(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  tx.objectStore(SESSIONS_STORE).clear();
  await promisifyTransaction(tx);
}

/** Reads a session for export. Alias of {@link getSession} — export uses the same validated read. */
export const exportSession: typeof getSession = getSession;
