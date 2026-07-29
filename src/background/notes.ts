/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import {
  type AddNoteRequest,
  type AddNoteResponse,
  isAddNoteRequest,
  OPEN_NOTES_PANEL_MESSAGE,
} from "../shared/messages.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import { loadSettings } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  MAXIMUM_NOTE_ELEMENTS,
  shouldStripQueryByDefault,
} from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

/** Result of durably appending one captured note. */
export interface CapturedNoteResult {
  readonly noteCount: number;
  readonly noteId: string;
  readonly sessionId: string;
}

/** Serialized captured-note persistence service. */
export interface CapturedNoteService {
  append(request: AddNoteRequest): Promise<CapturedNoteResult>;
}

/** Runtime seams accepted by {@link createCapturedNoteService}. */
export interface CapturedNoteServiceDependencies {
  readonly createId: () => string;
  readonly now: () => Date;
  readonly openDatabase: () => Promise<IDBDatabase>;
}

const DEFAULT_DEPENDENCIES: CapturedNoteServiceDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date(),
  openDatabase: openStore,
};

async function activeSession(
  storage: BrowserShim["storage"]["local"],
  database: IDBDatabase,
  dependencies: CapturedNoteServiceDependencies,
  createdAt: string,
): Promise<{ readonly isNew: boolean; readonly session: Session }> {
  const stored = await storage.get(ACTIVE_SESSION_ID_STORAGE_KEY);
  const activeId = stored[ACTIVE_SESSION_ID_STORAGE_KEY];
  if (typeof activeId === "string") {
    const existing = await getSession(database, activeId);
    if (existing !== null) return { isNew: false, session: existing };
  }
  return {
    isNew: true,
    session: {
      createdAt,
      endedAt: null,
      id: dependencies.createId(),
      name: "Untitled session",
      notes: [],
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

async function appendCapturedNote(
  storage: BrowserShim["storage"]["local"],
  dependencies: CapturedNoteServiceDependencies,
  request: AddNoteRequest,
): Promise<CapturedNoteResult> {
  if (request.elements.length > MAXIMUM_NOTE_ELEMENTS) {
    throw new RangeError(`A note cannot contain more than ${MAXIMUM_NOTE_ELEMENTS} elements.`);
  }
  const settings = await loadSettings(storage);
  const database = await dependencies.openDatabase();
  try {
    const createdAt = dependencies.now().toISOString();
    const { isNew, session } = await activeSession(
      storage,
      database,
      dependencies,
      createdAt,
    );
    const noteId = dependencies.createId();
    const next: Session = {
      ...session,
      notes: [...session.notes, {
        createdAt,
        elements: request.elements,
        id: noteId,
        pageTitle: request.pageTitle,
        pageUrl: request.pageUrl,
        region: request.capture,
        stripQuery: settings.stripSensitiveQueries &&
          shouldStripQueryByDefault(request.pageUrl),
        text: "",
      }],
    };
    await putSession(database, next);
    if (isNew) {
      await storage.set({ [ACTIVE_SESSION_ID_STORAGE_KEY]: next.id });
    }
    return {
      noteCount: next.notes.length,
      noteId,
      sessionId: next.id,
    };
  } finally {
    database.close();
  }
}

/**
 * Creates the serialized background service that owns active-session note writes.
 *
 * @param storage Extension-local active-session pointer.
 * @param dependencies Clock, identifier, and database seams.
 * @returns Captured-note persistence service.
 */
export function createCapturedNoteService(
  storage: BrowserShim["storage"]["local"],
  dependencies: CapturedNoteServiceDependencies = DEFAULT_DEPENDENCIES,
): CapturedNoteService {
  let writeTail = Promise.resolve();
  return {
    append(request) {
      const result = writeTail.then(() => appendCapturedNote(storage, dependencies, request));
      writeTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

/**
 * Registers the runtime handler that persists captured notes.
 *
 * @param extensionBrowser Browser shim supplying the message channel.
 * @param service Serialized captured-note service.
 */
export function registerNoteHandler(
  extensionBrowser: BrowserShim,
  service: CapturedNoteService = createCapturedNoteService(extensionBrowser.storage.local),
): void {
  extensionBrowser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === OPEN_NOTES_PANEL_MESSAGE) {
      void extensionBrowser.openPanel(sender.tab?.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) =>
          sendResponse({
            error: {
              message: error instanceof Error ? error.message : "The notes panel could not open.",
            },
            ok: false,
          })
        );
      return true;
    }
    if (!isAddNoteRequest(message)) return;
    void service.append(message)
      .then((result) => sendResponse({ ...result, ok: true } satisfies AddNoteResponse))
      .catch((error: unknown) =>
        sendResponse(
          {
            error: {
              message: error instanceof Error ? error.message : "The note could not be saved.",
            },
            ok: false,
          } satisfies AddNoteResponse,
        )
      );
    return true;
  });
}
