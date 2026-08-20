import type { Note, Session } from "../shared/schema.ts";
import { shouldStripQueryByDefault } from "../shared/session.ts";

/** One page's notes in first-capture order. */
export interface NotePageGroup {
  readonly key: string;
  readonly notes: readonly Note[];
  readonly pageTitle: string;
  readonly pageUrl: string;
}

/** Direction accepted by {@link moveNote}. */
export type NoteMoveDirection = "up" | "down";

function pageGroupKey(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    if (parsed.protocol === "file:") return `file://${parsed.pathname}`;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return pageUrl;
  }
}

function replaceNote(
  session: Session,
  noteId: string,
  update: (note: Note) => Note,
): Session {
  const noteIndex = session.notes.findIndex((note) => note.id === noteId);
  if (noteIndex === -1) return session;
  return {
    ...session,
    notes: session.notes.map((note, index) => index === noteIndex ? update(note) : note),
  };
}

/**
 * Groups a session's notes by logical page.
 *
 * @param session Session to group.
 * @returns Page groups in first-capture order.
 */
export function groupNotesByPage(session: Session): NotePageGroup[] {
  const groups = new Map<string, { notes: Note[]; pageTitle: string; pageUrl: string }>();
  for (const note of session.notes) {
    const key = pageGroupKey(note.pageUrl);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        notes: [note],
        pageTitle: note.pageTitle,
        pageUrl: note.pageUrl,
      });
    } else {
      existing.notes.push(note);
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

/**
 * Replaces one note's text immutably.
 *
 * @param session Session containing the note.
 * @param noteId Note identifier.
 * @param text Replacement text.
 * @returns Updated session, or the original when the note is absent.
 */
export function updateNoteText(session: Session, noteId: string, text: string): Session {
  return replaceNote(session, noteId, (note) => ({ ...note, text }));
}

/**
 * Replaces a session's display name with trimmed, non-blank text.
 *
 * @param session Session to rename.
 * @param name Requested display name.
 * @returns Updated session, or the original when the requested name is blank.
 */
export function updateSessionName(session: Session, name: string): Session {
  const trimmedName = name.trim();
  return trimmedName.length === 0 ? session : { ...session, name: trimmedName };
}

/**
 * Removes one note immutably.
 *
 * @param session Session containing the note.
 * @param noteId Note identifier.
 * @returns Updated session, or the original when the note is absent.
 */
export function deleteNote(session: Session, noteId: string): Session {
  if (!session.notes.some((note) => note.id === noteId)) return session;
  return { ...session, notes: session.notes.filter((note) => note.id !== noteId) };
}

/**
 * Moves one note within its logical page group.
 *
 * @param session Session containing the note.
 * @param noteId Note identifier.
 * @param direction Requested movement.
 * @returns Updated session, or the original when movement is unavailable.
 */
export function moveNote(
  session: Session,
  noteId: string,
  direction: NoteMoveDirection,
): Session {
  const sourceIndex = session.notes.findIndex((note) => note.id === noteId);
  const source = session.notes[sourceIndex];
  if (source === undefined) return session;
  const key = pageGroupKey(source.pageUrl);
  const pageIndices = session.notes
    .map((note, index) => pageGroupKey(note.pageUrl) === key ? index : -1)
    .filter((index) => index >= 0);
  const pageIndex = pageIndices.indexOf(sourceIndex);
  const targetPageIndex = pageIndex + (direction === "up" ? -1 : 1);
  const targetIndex = pageIndices[targetPageIndex];
  if (targetIndex === undefined) return session;
  const notes = [...session.notes];
  notes[sourceIndex] = session.notes[targetIndex] as Note;
  notes[targetIndex] = source;
  return { ...session, notes };
}

/**
 * Replaces one note's query-stripping preference immutably.
 *
 * @param session Session containing the note.
 * @param noteId Note identifier.
 * @param stripQuery Next preference.
 * @returns Updated session, or the original when the note is absent.
 */
export function setNoteStripQuery(
  session: Session,
  noteId: string,
  stripQuery: boolean,
): Session {
  return replaceNote(session, noteId, (note) => ({ ...note, stripQuery }));
}

/**
 * Resolves one note's explicit or privacy-derived query preference.
 *
 * @param note Note to inspect.
 * @returns Whether its query is omitted from export projections.
 */
export function effectiveStripQuery(note: Note): boolean {
  return note.stripQuery ?? shouldStripQueryByDefault(note.pageUrl);
}
