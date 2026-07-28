/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import type { Session } from "../shared/schema.ts";
import { ACTIVE_SESSION_ID_STORAGE_KEY } from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

/** Persistence boundary consumed by the notes-panel component. */
export interface NotesRepository {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
}

/**
 * Creates a repository that resolves the active session through extension storage and IndexedDB.
 *
 * @param storage Extension-local active-session pointer.
 * @returns Fresh-connection session load and save operations.
 */
export function createNotesRepository(
  storage: BrowserShim["storage"]["local"],
): NotesRepository {
  return {
    async load() {
      const stored = await storage.get(ACTIVE_SESSION_ID_STORAGE_KEY);
      const activeId = stored[ACTIVE_SESSION_ID_STORAGE_KEY];
      if (typeof activeId !== "string") return null;
      const database = await openStore();
      try {
        return await getSession(database, activeId);
      } finally {
        database.close();
      }
    },
    async save(session) {
      const database = await openStore();
      try {
        await putSession(database, session);
      } finally {
        database.close();
      }
    },
  };
}
