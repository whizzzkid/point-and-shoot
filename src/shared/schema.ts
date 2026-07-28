/**
 * Versioned session/note record shape — the canonical JSON stored in IndexedDB by
 * {@link ../store.ts}. Per ADR-0003, this JSON is the source of truth; Markdown and clipboard text
 * are read-time projections computed from it and never stored or round-tripped back in.
 *
 * @module
 */

import type { SelectorBundle } from "./selectors.ts";
import type { StyleDigestBundle } from "./style-digest.ts";

/** Current schema version. Bump on any breaking field change and add a migration in `store.ts`. */
export const SCHEMA_VERSION = 1;

/** A captured screen region: the annotated screenshot plus where on the page it was taken. */
export interface RegionCapture {
  /** WebP, quality 0.7, longest edge capped at 1024px, as a `data:image/webp;base64,...` URI. */
  readonly screenshot: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** `true` when the region exceeded the 1024px cap and was downscaled to fit it. */
  readonly truncated: boolean;
}

/** An opt-in hint at the framework component that likely owns an element, when detectable. */
export interface ComponentHint {
  readonly framework: "react" | "vue" | "svelte" | "angular";
  /** Best-effort file path or component name; framework build config decides how precise this is. */
  readonly name: string;
}

/** One annotated element within a note: its identity bundle, live style digest, and component hint. */
export interface NoteElement {
  readonly selectors: SelectorBundle;
  readonly styleDigest: StyleDigestBundle | null;
  /** `null` when {@link selectors} is unreachable — there is nothing to compute a digest against. */
  readonly componentHint?: ComponentHint;
}

/** A single annotation: where it was taken, what it points at, and what the user said about it. */
export interface Note {
  readonly id: string;
  readonly createdAt: string;
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly region: RegionCapture;
  readonly elements: readonly NoteElement[];
  readonly text: string;
}

/** A named capture session spanning any number of pages, until exported or ended. */
export interface Session {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  /** `null` while the session is still active; set once the user ends it. */
  readonly endedAt: string | null;
  readonly notes: readonly Note[];
}

/** Why {@link validateSession} rejected a candidate record. */
export type SessionValidationError =
  | { readonly reason: "not-an-object" }
  | { readonly reason: "unsupported-schema-version"; readonly found: unknown }
  | { readonly reason: "missing-field"; readonly field: string }
  | { readonly reason: "invalid-field"; readonly field: string; readonly detail: string };

export type SessionValidationResult =
  | { readonly valid: true; readonly session: Session }
  | { readonly valid: false; readonly error: SessionValidationError };

/**
 * Validates an unknown value read from storage against the {@link Session} shape, rather than
 * trusting it — a record predates a schema change, or storage was corrupted, more often than the
 * type system's static guarantees suggest.
 */
export function validateSession(candidate: unknown): SessionValidationResult {
  if (typeof candidate !== "object" || candidate === null) {
    return { valid: false, error: { reason: "not-an-object" } };
  }

  const record = candidate as Record<string, unknown>;

  if (record.schemaVersion !== SCHEMA_VERSION) {
    return {
      valid: false,
      error: { reason: "unsupported-schema-version", found: record.schemaVersion },
    };
  }

  for (const field of ["id", "name", "createdAt"] as const) {
    if (typeof record[field] !== "string") {
      return { valid: false, error: { reason: "missing-field", field } };
    }
  }

  if (record.endedAt !== null && typeof record.endedAt !== "string") {
    return {
      valid: false,
      error: { reason: "invalid-field", field: "endedAt", detail: "must be string or null" },
    };
  }

  if (!Array.isArray(record.notes)) {
    return { valid: false, error: { reason: "missing-field", field: "notes" } };
  }

  for (let i = 0; i < record.notes.length; i++) {
    const noteError = validateNoteShape(record.notes[i]);
    if (noteError !== null) {
      return {
        valid: false,
        error: { reason: "invalid-field", field: `notes[${i}]`, detail: noteError },
      };
    }
  }

  return { valid: true, session: record as unknown as Session };
}

/** Returns `null` when `candidate` matches the {@link Note} shape, else a human-readable reason. */
function validateNoteShape(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) return "not an object";
  const note = candidate as Record<string, unknown>;

  for (const field of ["id", "createdAt", "pageUrl", "pageTitle", "text"] as const) {
    if (typeof note[field] !== "string") return `missing or non-string field: ${field}`;
  }
  if (typeof note.region !== "object" || note.region === null) return "missing field: region";
  if (typeof (note.region as Record<string, unknown>).truncated !== "boolean") {
    return "missing field: region.truncated";
  }
  if (!Array.isArray(note.elements)) return "missing field: elements";

  return null;
}
