/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import { ACTIVE_SESSION_ID_STORAGE_KEY } from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

/** Active-session persistence used by the popup launcher. */
export interface PopupSessionRepository {
  load(): Promise<Session | null>;
  startOrResume(): Promise<Session>;
}

/** Clock and identifier seams used when the popup creates a session. */
export interface PopupSessionDependencies {
  readonly createId: () => string;
  readonly now: () => Date;
}

const DEFAULT_DEPENDENCIES: PopupSessionDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date(),
};

async function loadActive(
  storage: BrowserShim["storage"]["local"],
): Promise<Session | null> {
  const stored = await storage.get(ACTIVE_SESSION_ID_STORAGE_KEY);
  const activeId = stored[ACTIVE_SESSION_ID_STORAGE_KEY];
  if (typeof activeId !== "string") return null;
  const database = await openStore();
  try {
    return await getSession(database, activeId);
  } finally {
    database.close();
  }
}

async function startSession(
  storage: BrowserShim["storage"]["local"],
  dependencies: PopupSessionDependencies,
): Promise<Session> {
  const active = await loadActive(storage);
  if (active !== null) return active;

  const session: Session = {
    createdAt: dependencies.now().toISOString(),
    domain: null,
    endedAt: null,
    id: dependencies.createId(),
    name: "Untitled session",
    notes: [],
    schemaVersion: SCHEMA_VERSION,
  };
  const database = await openStore();
  try {
    await putSession(database, session);
    await storage.set({ [ACTIVE_SESSION_ID_STORAGE_KEY]: session.id });
    return session;
  } finally {
    database.close();
  }
}

/**
 * Creates the popup's active-session repository.
 *
 * @param storage Extension-local active-session pointer.
 * @param dependencies Clock and identifier sources.
 * @returns Serialized load and start-or-resume operations.
 */
export function createPopupSessionRepository(
  storage: BrowserShim["storage"]["local"],
  dependencies: PopupSessionDependencies = DEFAULT_DEPENDENCIES,
): PopupSessionRepository {
  let startTail = Promise.resolve();
  return {
    load: () => loadActive(storage),
    startOrResume() {
      const result = startTail.then(() => startSession(storage, dependencies));
      startTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
