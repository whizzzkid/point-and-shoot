/// <reference lib="dom" />

import type { BrowserShim, StorageChangedListener } from "../shared/browser.ts";
import type { Session } from "../shared/schema.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  nextSessionRevision,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

async function publishRevision(storage: BrowserShim["storage"]["local"]): Promise<void> {
  try {
    const stored = await storage.get(SESSION_REVISION_STORAGE_KEY);
    await storage.set({
      [SESSION_REVISION_STORAGE_KEY]: nextSessionRevision(
        stored[SESSION_REVISION_STORAGE_KEY],
      ),
    });
  } catch {
    // IndexedDB is authoritative; invalidation must not turn a committed save into a failure.
  }
}

/** Persistence boundary consumed by the notes-panel component. */
export interface NotesRepository {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  /**
   * Ends the given session — stamps `endedAt`, clears the `activeSessionId` pointer, retains the
   * session as the panel's displayed session. Invoked by the Compile-Plan action so the toolbar
   * click gesture is no longer the way a session terminates. Returns the ended record so the
   * panel keeps rendering the same session in its plan view.
   */
  complete(session: Session): Promise<Session>;
  watch(onChange: () => void): () => void;
}

/**
 * Creates a repository that prefers the displayed session and falls back to the active session.
 *
 * @param storage Extension-local storage containing the displayed and active session pointers.
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
      await publishRevision(storage);
    },
    async complete(session) {
      if (session.endedAt !== null) return session;
      const ended: Session = {
        ...session,
        endedAt: new Date().toISOString(),
        pausedAt: null,
      };
      const database = await openStore();
      try {
        await putSession(database, ended);
      } finally {
        database.close();
      }
      // Clear the active pointer so the next toolbar click starts a fresh session, but keep
      // `displaySessionId` pointing at the completed one so the panel stays on the plan view.
      await storage.remove(ACTIVE_SESSION_ID_STORAGE_KEY);
      await storage.set({ [DISPLAY_SESSION_ID_STORAGE_KEY]: ended.id });
      await publishRevision(storage);
      return ended;
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
