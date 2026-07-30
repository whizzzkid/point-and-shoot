/// <reference lib="dom" />

import type { BrowserShim, StorageChangedListener } from "../shared/browser.ts";
import type { Session } from "../shared/schema.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

/** Persistence boundary consumed by the notes-panel component. */
export interface NotesRepository {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  watch(onChange: () => void): () => void;
}

/**
 * Creates a repository that resolves the active session through extension storage and IndexedDB.
 *
 * @param storage Extension-local active-session pointer.
 * @param onChanged Optional extension-storage listener registry for live panel updates.
 * @returns Fresh-connection session load and save operations.
 */
export function createNotesRepository(
  storage: BrowserShim["storage"]["local"],
  onChanged?: BrowserShim["storage"]["onChanged"],
): NotesRepository {
  return {
    async load() {
      const stored = await storage.get([
        DISPLAY_SESSION_ID_STORAGE_KEY,
        ACTIVE_SESSION_ID_STORAGE_KEY,
      ]);
      const displayId = stored[DISPLAY_SESSION_ID_STORAGE_KEY];
      const activeId = stored[ACTIVE_SESSION_ID_STORAGE_KEY];
      const sessionId = typeof displayId === "string"
        ? displayId
        : typeof activeId === "string"
        ? activeId
        : null;
      if (sessionId === null) return null;
      const database = await openStore();
      try {
        return await getSession(database, sessionId);
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
    watch(onChange) {
      if (onChanged === undefined) return () => undefined;
      const listener: StorageChangedListener = (changes, areaName) => {
        if (
          areaName === "local" &&
          [
            ACTIVE_SESSION_ID_STORAGE_KEY,
            DISPLAY_SESSION_ID_STORAGE_KEY,
            SESSION_REVISION_STORAGE_KEY,
          ].some((key) => key in changes)
        ) {
          onChange();
        }
      };
      onChanged.addListener(listener);
      return () => onChanged.removeListener(listener);
    },
  };
}
