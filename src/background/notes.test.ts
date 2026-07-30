/// <reference lib="dom" />

import "fake-indexeddb/auto";

import { assertEquals, assertRejects } from "@std/assert";
import type { BrowserShim, MessageListener, StorageItems } from "../shared/browser.ts";
import {
  ADD_NOTE_MESSAGE,
  type AddNoteRequest,
  OPEN_NOTES_PANEL_MESSAGE,
} from "../shared/messages.ts";
import { DEFAULT_SETTINGS, saveSettings } from "../shared/settings.ts";
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  DISPLAY_SESSION_ID_STORAGE_KEY,
  MAXIMUM_NOTE_ELEMENTS,
  SESSION_REVISION_STORAGE_KEY,
} from "../shared/session.ts";
import { DB_NAME, getSession, openStore } from "../shared/store.ts";
import {
  type CapturedNoteService,
  createCapturedNoteService,
  registerNoteHandler,
} from "./notes.ts";

const REQUEST: AddNoteRequest = {
  capture: {
    box: { height: 40, width: 80, x: 10, y: 20 },
    screenshot: "data:image/webp;base64,V0VCUA==",
    truncated: false,
    viewport: { height: 600, width: 800 },
  },
  elements: [{
    selectors: {
      cssPath: ["button"],
      reachable: true,
      tagClasses: "button.primary",
      testIds: [],
      textSnippet: "Save",
      xpath: ["//button"],
    },
    styleDigest: null,
  }],
  pageTitle: "Checkout",
  pageUrl: "https://example.com/checkout?access_token=secret",
  type: ADD_NOTE_MESSAGE,
};

function createStorage(initial: StorageItems = {}): BrowserShim["storage"]["local"] {
  const values = new Map(Object.entries(initial));
  return {
    get(keys) {
      if (keys == null) return Promise.resolve(Object.fromEntries(values));
      const selected = Array.isArray(keys) ? keys : [keys];
      const result: StorageItems = {};
      for (const key of selected) if (values.has(key)) result[key] = values.get(key);
      return Promise.resolve(result);
    },
    remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key);
      return Promise.resolve();
    },
    set(items) {
      for (const [key, value] of Object.entries(items)) values.set(key, value);
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

function deterministicService(
  storage: BrowserShim["storage"]["local"],
  ids: string[],
): CapturedNoteService {
  return createCapturedNoteService(storage, {
    createId() {
      const id = ids.shift();
      if (id === undefined) throw new Error("deterministic id sequence exhausted");
      return id;
    },
    now: () => new Date("2026-07-28T12:00:00.000Z"),
    openDatabase: openStore,
  });
}

Deno.test("captured note service creates an active session and preserves full URL evidence", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = deterministicService(storage, ["session-1", "note-1"]);

  const result = await service.append(REQUEST);
  const pointers = await storage.get([
    ACTIVE_SESSION_ID_STORAGE_KEY,
    DISPLAY_SESSION_ID_STORAGE_KEY,
    SESSION_REVISION_STORAGE_KEY,
  ]);
  const database = await openStore();
  try {
    const session = await getSession(database, "session-1");
    assertEquals(result, { noteCount: 1, noteId: "note-1", sessionId: "session-1" });
    assertEquals(pointers[ACTIVE_SESSION_ID_STORAGE_KEY], "session-1");
    assertEquals(pointers[DISPLAY_SESSION_ID_STORAGE_KEY], "session-1");
    assertEquals(pointers[SESSION_REVISION_STORAGE_KEY], 1);
    assertEquals(session?.notes[0]?.pageUrl, REQUEST.pageUrl);
    assertEquals(session?.notes[0]?.stripQuery, true);
    assertEquals(session?.notes[0]?.elements, REQUEST.elements);
    assertEquals(session?.notes[0]?.text, "");
  } finally {
    database.close();
    await resetDatabase();
  }
});

Deno.test("captured note service replaces a stale active-session pointer", async () => {
  await resetDatabase();
  const storage = createStorage({ [ACTIVE_SESSION_ID_STORAGE_KEY]: "missing-session" });
  const service = deterministicService(storage, ["session-2", "note-1"]);

  await service.append(REQUEST);

  assertEquals(
    (await storage.get(ACTIVE_SESSION_ID_STORAGE_KEY))[ACTIVE_SESSION_ID_STORAGE_KEY],
    "session-2",
  );
  await resetDatabase();
});

Deno.test("captured note service honors the global sensitive-query default", async () => {
  await resetDatabase();
  const storage = createStorage();
  await saveSettings(storage, {
    ...DEFAULT_SETTINGS,
    stripSensitiveQueries: false,
  });
  const service = deterministicService(storage, ["session-query", "note-query"]);

  await service.append(REQUEST);

  const database = await openStore();
  try {
    const session = await getSession(database, "session-query");
    assertEquals(session?.notes[0]?.stripQuery, false);
  } finally {
    database.close();
    await resetDatabase();
  }
});

Deno.test("captured note service serializes concurrent appends without losing a note", async () => {
  await resetDatabase();
  const storage = createStorage();
  const service = deterministicService(storage, ["session-1", "note-1", "note-2"]);

  const results = await Promise.all([
    service.append(REQUEST),
    service.append({ ...REQUEST, pageUrl: "https://example.com/pricing" }),
  ]);
  const database = await openStore();
  try {
    const session = await getSession(database, "session-1");
    assertEquals(results.map((result) => result.noteCount), [1, 2]);
    assertEquals(session?.notes.map((note) => note.id), ["note-1", "note-2"]);
  } finally {
    database.close();
    await resetDatabase();
  }
});

Deno.test("captured note service rejects evidence beyond the settled element cap", async () => {
  const service = deterministicService(createStorage(), ["session-1", "note-1"]);
  await assertRejects(
    () =>
      service.append({
        ...REQUEST,
        elements: Array.from({ length: MAXIMUM_NOTE_ELEMENTS + 1 }, () => REQUEST.elements[0]!),
      }),
    RangeError,
    "25",
  );
});

Deno.test("registerNoteHandler ignores foreign messages and returns typed results", async () => {
  let listener: MessageListener | undefined;
  const openedTabs: (number | undefined)[] = [];
  const browser = {
    openPanel(tabId?: number) {
      openedTabs.push(tabId);
      return Promise.resolve();
    },
    runtime: {
      onMessage: {
        addListener(nextListener: MessageListener) {
          listener = nextListener;
        },
      },
    },
  } as unknown as BrowserShim;
  const service: CapturedNoteService = {
    append: () => Promise.resolve({ noteCount: 1, noteId: "note-1", sessionId: "session-1" }),
  };
  registerNoteHandler(browser, service);
  if (listener === undefined) throw new Error("note handler did not register");
  const responses: unknown[] = [];

  assertEquals(listener("other", {}, (response) => responses.push(response)), undefined);
  assertEquals(listener(REQUEST, {}, (response) => responses.push(response)), true);
  assertEquals(
    listener(
      OPEN_NOTES_PANEL_MESSAGE,
      { tab: { id: 7 } },
      (response) => responses.push(response),
    ),
    true,
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assertEquals(openedTabs, [7]);
  assertEquals(responses, [{
    noteCount: 1,
    noteId: "note-1",
    ok: true,
    sessionId: "session-1",
  }, { ok: true }]);
});

Deno.test("registerNoteHandler returns typed storage and panel errors", async () => {
  let listener: MessageListener | undefined;
  const browser = {
    openPanel: () => Promise.reject(new Error("Panel unavailable.")),
    runtime: {
      onMessage: {
        addListener(nextListener: MessageListener) {
          listener = nextListener;
        },
      },
    },
  } as unknown as BrowserShim;
  registerNoteHandler(browser, {
    append: () => Promise.reject(new Error("Storage quota exceeded.")),
  });
  if (listener === undefined) throw new Error("note handler did not register");
  const responses: unknown[] = [];

  listener(REQUEST, {}, (response) => responses.push(response));
  listener(OPEN_NOTES_PANEL_MESSAGE, {}, (response) => responses.push(response));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(responses, [
    { error: { message: "Storage quota exceeded." }, ok: false },
    { error: { message: "Panel unavailable." }, ok: false },
  ]);
});
