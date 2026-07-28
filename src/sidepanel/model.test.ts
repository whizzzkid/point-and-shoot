import { assert, assertEquals, assertNotEquals } from "@std/assert";
import type { Note, Session } from "../shared/schema.ts";
import {
  deleteNote,
  effectiveStripQuery,
  groupNotesByPage,
  moveNote,
  setNoteStripQuery,
  updateNoteText,
} from "./model.ts";

function makeNote(id: string, pageUrl: string, text: string): Note {
  return {
    createdAt: "2026-07-28T12:00:00.000Z",
    elements: [],
    id,
    pageTitle: pageUrl.includes("checkout") ? "Checkout" : "Pricing",
    pageUrl,
    region: {
      box: { height: 50, width: 100, x: 10, y: 20 },
      screenshot: "data:image/webp;base64,V0VCUA==",
      truncated: false,
      viewport: { height: 600, width: 800 },
    },
    text,
  };
}

const SESSION: Session = {
  createdAt: "2026-07-28T12:00:00.000Z",
  endedAt: null,
  id: "session-1",
  name: "Checkout review",
  notes: [
    makeNote("note-1", "https://example.com/checkout?access_token=one", "First"),
    makeNote("note-2", "https://example.com/pricing", "Pricing"),
    makeNote("note-3", "https://example.com/checkout?access_token=two", "Second"),
  ],
  schemaVersion: 1,
};

Deno.test("groupNotesByPage groups query variants by origin and path in first-seen order", () => {
  const groups = groupNotesByPage(SESSION);

  assertEquals(groups.map((group) => group.key), [
    "https://example.com/checkout",
    "https://example.com/pricing",
  ]);
  assertEquals(groups[0]?.notes.map((note) => note.id), ["note-1", "note-3"]);
  assertEquals(groups[0]?.pageUrl, "https://example.com/checkout?access_token=one");
});

Deno.test("note mutations preserve the original session and update only the requested note", () => {
  const edited = updateNoteText(SESSION, "note-1", "Updated");
  const queryChanged = setNoteStripQuery(edited, "note-1", false);
  const deleted = deleteNote(queryChanged, "note-2");

  assertNotEquals(edited, SESSION);
  assertEquals(SESSION.notes[0]?.text, "First");
  assertEquals(edited.notes[0]?.text, "Updated");
  assertEquals(queryChanged.notes[0]?.stripQuery, false);
  assertEquals(deleted.notes.map((note) => note.id), ["note-1", "note-3"]);
});

Deno.test("moveNote reorders within a page group without crossing intervening page notes", () => {
  const moved = moveNote(SESSION, "note-3", "up");
  assertEquals(moved.notes.map((note) => note.id), ["note-3", "note-2", "note-1"]);
  assertEquals(moveNote(moved, "note-3", "up"), moved);
  assertEquals(moveNote(SESSION, "missing", "down"), SESSION);
});

Deno.test("effectiveStripQuery honors an explicit choice before the sensitive-name default", () => {
  const sensitive = SESSION.notes[0];
  const normal = SESSION.notes[1];
  assert(sensitive !== undefined && normal !== undefined);

  assertEquals(effectiveStripQuery(sensitive), true);
  assertEquals(effectiveStripQuery({ ...sensitive, stripQuery: false }), false);
  assertEquals(effectiveStripQuery(normal), false);
});
