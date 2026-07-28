/// <reference lib="dom" />
/**
 * IndexedDB layer for the {@link ../schema.ts} record shape. Opens with an explicit version and an
 * `onupgradeneeded` migration path from day one — retrofitting migrations onto a store with real
 * user data is how a schema change becomes a data-loss bug, so the path exists before it is needed.
 *
 * @module
 */

import { type Session, validateSession } from "./schema.ts";

export const DB_NAME = "point-and-shoot";
export const DB_VERSION = 1;
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

/**
 * Migrations applied in `onupgradeneeded`, indexed by the version they bump *to* minus one —
 * `MIGRATIONS[0]` runs when `event.oldVersion` is `0`, bumping a fresh database to version 1. Add
 * to the end of this array, never edit an existing entry, when {@link DB_VERSION} is next bumped.
 */
const MIGRATIONS: readonly ((db: IDBDatabase) => void)[] = [
  (db) => {
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
    }
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
    tx.onabort = () => reject(tx.error);
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
      for (let version = event.oldVersion; version < DB_VERSION; version++) {
        MIGRATIONS[version]?.(db);
      }
    };

    request.onsuccess = () => resolve(request.result);
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

/** Reads a session for export. Alias of {@link getSession} — export uses the same validated read. */
export const exportSession: typeof getSession = getSession;
