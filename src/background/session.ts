/// <reference lib="dom" />

import type { BrowserShim } from "../shared/browser.ts";
import type { AddNoteRequest } from "../shared/messages.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import { loadSettings } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  MAXIMUM_NOTE_ELEMENTS,
  nextSessionRevision,
  SESSION_REVISION_STORAGE_KEY,
  shouldStripQueryByDefault,
} from "../shared/session.ts";
import { getSession, openStore, putSession } from "../shared/store.ts";

/** Result of durably appending one captured note. */
export interface CapturedNoteResult {
  readonly noteCount: number;
  readonly noteId: string;
  readonly sessionId: string;
}

/** Serialized owner of active-session lifecycle and captured-note writes. */
export interface SessionService {
  /** Returns the current unended session, or `null` for a stale, ended, or absent pointer. */
  loadActive(): Promise<Session | null>;
  /**
   * Resumes the active session or creates and displays a fresh session named for the page.
   *
   * @param pageTitle Current page title used only when creating a session.
   * @param pageUrl Current page URL, used to capture the session's hostname when creating a new
   *   session. `undefined` or unparseable inputs leave `domain` `null`.
   * @returns The resumed or newly created session.
   */
  start(pageTitle?: string, pageUrl?: string): Promise<Session>;
  /** Ends the active session while retaining it as the side panel's displayed session. */
  end(): Promise<Session | null>;
  /** Appends one capture to the active session, creating a session defensively when absent. */
  append(request: AddNoteRequest): Promise<CapturedNoteResult>;
}

/** Runtime seams accepted by {@link createSessionService}. */
export interface SessionServiceDependencies {
  readonly createId: () => string;
  readonly now: () => Date;
  readonly openDatabase: () => Promise<IDBDatabase>;
}

const DEFAULT_DEPENDENCIES: SessionServiceDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date(),
  openDatabase: openStore,
};

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultSessionName(pageTitle: string | undefined, createdAt: Date): string {
  const trimmedTitle = pageTitle?.trim() ?? "";
  const title = trimmedTitle.length === 0 ? "Untitled page" : trimmedTitle;
  const timestamp = [
    createdAt.getFullYear(),
    twoDigits(createdAt.getMonth() + 1),
    twoDigits(createdAt.getDate()),
    twoDigits(createdAt.getHours()),
    twoDigits(createdAt.getMinutes()),
    twoDigits(createdAt.getSeconds()),
  ].join("-");
  return `${title}-${timestamp}`;
}

/**
 * Extracts the hostname of a URL for {@link Session.domain}. Returns `null` for `undefined`, empty,
 * or unparseable inputs (`chrome://newtab/`, `about:blank`, `""`); the ADR-0002 activeTab model
 * gives the background a URL only for eligible http(s) pages, so anything else is a non-domain.
 */
function domainFromUrl(pageUrl: string | undefined): string | null {
  if (pageUrl === undefined || pageUrl === "") return null;
  try {
    return new URL(pageUrl).hostname || null;
  } catch {
    return null;
  }
}

function createSession(
  id: string,
  createdAt: Date,
  pageTitle?: string,
  pageUrl?: string,
): Session {
  return {
    createdAt: createdAt.toISOString(),
    domain: domainFromUrl(pageUrl),
    endedAt: null,
    id,
    name: defaultSessionName(pageTitle, createdAt),
    notes: [],
    schemaVersion: SCHEMA_VERSION,
  };
}

async function loadActiveFrom(
  storage: BrowserShim["storage"]["local"],
  database: IDBDatabase,
): Promise<Session | null> {
  const stored = await storage.get(ACTIVE_SESSION_ID_STORAGE_KEY);
  const activeId = stored[ACTIVE_SESSION_ID_STORAGE_KEY];
  if (typeof activeId !== "string") return null;
  const session = await getSession(database, activeId);
  return session?.endedAt === null ? session : null;
}

async function pointAtSession(
  storage: BrowserShim["storage"]["local"],
  sessionId: string,
): Promise<void> {
  const stored = await storage.get(SESSION_REVISION_STORAGE_KEY);
  await storage.set({
    [ACTIVE_SESSION_ID_STORAGE_KEY]: sessionId,
    [DISPLAY_SESSION_ID_STORAGE_KEY]: sessionId,
    [SESSION_REVISION_STORAGE_KEY]: nextSessionRevision(
      stored[SESSION_REVISION_STORAGE_KEY],
    ),
  });
}

async function startSession(
  storage: BrowserShim["storage"]["local"],
  dependencies: SessionServiceDependencies,
  pageTitle?: string,
  pageUrl?: string,
): Promise<Session> {
  const database = await dependencies.openDatabase();
  try {
    const active = await loadActiveFrom(storage, database);
    if (active !== null) return active;

    const session = createSession(
      dependencies.createId(),
      dependencies.now(),
      pageTitle,
      pageUrl,
    );
    await putSession(database, session);
    await pointAtSession(storage, session.id);
    return session;
  } finally {
    database.close();
  }
}

async function endSession(
  storage: BrowserShim["storage"]["local"],
  dependencies: SessionServiceDependencies,
): Promise<Session | null> {
  const database = await dependencies.openDatabase();
  try {
    const active = await loadActiveFrom(storage, database);
    if (active === null) {
      await storage.remove(ACTIVE_SESSION_ID_STORAGE_KEY);
      return null;
    }
    const ended: Session = {
      ...active,
      endedAt: dependencies.now().toISOString(),
    };
    await putSession(database, ended);
    await storage.remove(ACTIVE_SESSION_ID_STORAGE_KEY);
    const stored = await storage.get(SESSION_REVISION_STORAGE_KEY);
    await storage.set({
      [DISPLAY_SESSION_ID_STORAGE_KEY]: ended.id,
      [SESSION_REVISION_STORAGE_KEY]: nextSessionRevision(
        stored[SESSION_REVISION_STORAGE_KEY],
      ),
    });
    return ended;
  } finally {
    database.close();
  }
}

async function appendCapturedNote(
  storage: BrowserShim["storage"]["local"],
  dependencies: SessionServiceDependencies,
  request: AddNoteRequest,
): Promise<CapturedNoteResult> {
  if (request.elements.length > MAXIMUM_NOTE_ELEMENTS) {
    throw new RangeError(`A note cannot contain more than ${MAXIMUM_NOTE_ELEMENTS} elements.`);
  }
  const settings = await loadSettings(storage);
  const database = await dependencies.openDatabase();
  try {
    const createdAt = dependencies.now();
    const active = await loadActiveFrom(storage, database);
    const session = active ??
      createSession(dependencies.createId(), createdAt, request.pageTitle, request.pageUrl);
    const noteId = dependencies.createId();
    const next: Session = {
      ...session,
      notes: [...session.notes, {
        createdAt: createdAt.toISOString(),
        elements: request.elements,
        id: noteId,
        pageTitle: request.pageTitle,
        pageUrl: request.pageUrl,
        region: request.capture,
        stripQuery: settings.stripSensitiveQueries &&
          shouldStripQueryByDefault(request.pageUrl),
        text: request.text,
      }],
    };
    await putSession(database, next);
    await pointAtSession(storage, next.id);
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
 * Creates one serialized service for session lifecycle and note writes.
 *
 * @param storage Extension-local session pointers and revision signal.
 * @param dependencies Clock, identifier, and database seams.
 * @returns A service that prevents lifecycle actions and note captures from racing.
 */
export function createSessionService(
  storage: BrowserShim["storage"]["local"],
  dependencies: SessionServiceDependencies = DEFAULT_DEPENDENCIES,
): SessionService {
  let operationTail = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationTail.then(operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    loadActive: () =>
      enqueue(async () => {
        const database = await dependencies.openDatabase();
        try {
          return await loadActiveFrom(storage, database);
        } finally {
          database.close();
        }
      }),
    start: (pageTitle, pageUrl) =>
      enqueue(() => startSession(storage, dependencies, pageTitle, pageUrl)),
    end: () => enqueue(() => endSession(storage, dependencies)),
    append: (request) => enqueue(() => appendCapturedNote(storage, dependencies, request)),
  };
}
