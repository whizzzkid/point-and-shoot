/**
 * Versioned session/note record shape — the canonical JSON stored in IndexedDB by
 * {@link ./store.ts}. Per ADR-0003, this JSON is the source of truth; Markdown and clipboard text
 * are read-time projections computed from it and never stored or round-tripped back in.
 *
 * @module
 */

import type { SelectorBundle } from "./selectors.ts";
import type { StyleDigestBundle } from "./style-digest.ts";

/** Current schema version. Bump on any breaking field change and add a migration in `store.ts`. */
export const SCHEMA_VERSION = 2;

/** Maximum stored length of a framework component name or source path. */
export const MAX_COMPONENT_HINT_TEXT_LENGTH = 1_024;

/** A captured screen region: the annotated screenshot plus where on the page it was taken. */
export interface RegionCapture {
  /** WebP using the selected quality and longest-edge cap, as a base64 data URI. */
  readonly screenshot: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** `true` when the region exceeded the viewport/bitmap or the configured longest-edge cap. */
  readonly truncated: boolean;
}

/** An opt-in hint at the framework component that likely owns an element, when detectable. */
export interface ComponentHint {
  readonly framework: "react" | "vue" | "svelte" | "angular";
  /** Best-effort source path when the development build exposes one. */
  readonly file?: string;
  /** One-based source line when the development build exposes one. */
  readonly line?: number;
  /** Best-effort component name; framework build config decides how precise this is. */
  readonly name: string;
}

/** One annotated element within a note: its identity bundle, live style digest, and component hint. */
export interface NoteElement {
  readonly selectors: SelectorBundle;
  /** `null` when {@link selectors} is unreachable — there is nothing to compute a digest against. */
  readonly styleDigest: StyleDigestBundle | null;
  readonly componentHint?: ComponentHint;
}

/** A single annotation: where it was taken, what it points at, and what the user said about it. */
export interface Note {
  readonly id: string;
  readonly createdAt: string;
  readonly pageUrl: string;
  readonly pageTitle: string;
  /** Whether export projections omit the query while retaining the full recorded URL here. */
  readonly stripQuery?: boolean;
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
  /**
   * Hostname of the tab at session start; `null` when the start URL was
   * unparseable (`chrome://`, `about:`, empty) or when a v1 record had no notes
   * to backfill from during migration.
   */
  readonly domain: string | null;
  /**
   * ISO-8601 timestamp of the user's last pause, or `null` when the session is running or has
   * never been paused; absent on records written before the pause/resume model landed.
   * Distinct from {@link endedAt}: paused sessions remain the `activeSessionId` and can be
   * resumed from the toolbar without a new session id.
   */
  readonly pausedAt?: string | null;
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

  if (record.domain !== null && typeof record.domain !== "string") {
    return {
      valid: false,
      error: { reason: "invalid-field", field: "domain", detail: "must be string or null" },
    };
  }

  if (
    record.pausedAt !== undefined &&
    record.pausedAt !== null &&
    typeof record.pausedAt !== "string"
  ) {
    return {
      valid: false,
      error: {
        reason: "invalid-field",
        field: "pausedAt",
        detail: "must be string, null, or absent",
      },
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
  if (note.stripQuery !== undefined && typeof note.stripQuery !== "boolean") {
    return "field stripQuery must be boolean when present";
  }
  const regionError = validateRegionShape(note.region);
  if (regionError !== null) return regionError;

  if (!Array.isArray(note.elements)) return "missing field: elements";
  for (let i = 0; i < note.elements.length; i++) {
    const elementError = validateNoteElementShape(note.elements[i]);
    if (elementError !== null) return `elements[${i}]: ${elementError}`;
  }

  return null;
}

/** Returns `null` when `candidate` matches {@link RegionCapture}, else a human-readable reason. */
function validateRegionShape(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) return "missing field: region";
  const region = candidate as Record<string, unknown>;

  // The screenshot is the field an export is least able to do without and the one most likely to
  // arrive malformed — a `null` here reaches the Markdown projection as `![](null)`.
  if (typeof region.screenshot !== "string") {
    return "missing or non-string field: region.screenshot";
  }
  if (typeof region.truncated !== "boolean") return "missing field: region.truncated";

  const dimensionError = validateNumericFields(region.viewport, "region.viewport", [
    "width",
    "height",
  ]);
  if (dimensionError !== null) return dimensionError;

  return validateNumericFields(region.box, "region.box", ["x", "y", "width", "height"]);
}

/** Returns `null` when every named field on `candidate` is a finite number, else a reason. */
function validateNumericFields(
  candidate: unknown,
  path: string,
  fields: readonly string[],
): string | null {
  if (typeof candidate !== "object" || candidate === null) return `missing field: ${path}`;
  const record = candidate as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    // `NaN`/`Infinity` survive JSON round-trips as `null`, and a geometry field that is not a real
    // number cannot be rendered — reject both here rather than at draw time.
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `missing or non-finite field: ${path}.${field}`;
    }
  }
  return null;
}

/** Returns `null` when `candidate` matches {@link NoteElement}, else a human-readable reason. */
function validateNoteElementShape(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) return "not an object";
  const element = candidate as Record<string, unknown>;

  if (typeof element.selectors !== "object" || element.selectors === null) {
    return "missing field: selectors";
  }
  // `reachable` is the discriminant every consumer branches on, so its absence is what turns a
  // malformed record into a wrong-element lookup rather than a visible failure.
  if (typeof (element.selectors as Record<string, unknown>).reachable !== "boolean") {
    return "missing field: selectors.reachable";
  }
  if (element.styleDigest !== null && typeof element.styleDigest !== "object") {
    return "field styleDigest must be an object or null";
  }
  const componentHintError = validateComponentHintShape(element.componentHint);
  if (componentHintError !== null) return componentHintError;

  return null;
}

/** Returns `null` when an optional value matches {@link ComponentHint}, else a reason. */
function validateComponentHintShape(candidate: unknown): string | null {
  if (candidate === undefined) return null;
  if (typeof candidate !== "object" || candidate === null) {
    return "field componentHint must be an object when present";
  }
  const hint = candidate as Record<string, unknown>;
  const allowedKeys = ["file", "framework", "line", "name"];
  if (Object.keys(hint).some((key) => !allowedKeys.includes(key))) {
    return "field componentHint contains an unknown field";
  }
  if (!["react", "vue", "svelte", "angular"].includes(hint.framework as string)) {
    return "field componentHint.framework is unsupported";
  }
  if (
    typeof hint.name !== "string" ||
    hint.name.trim() === "" ||
    hint.name.length > MAX_COMPONENT_HINT_TEXT_LENGTH
  ) {
    return "field componentHint.name must be a non-empty string";
  }
  if (
    hint.file !== undefined &&
    (typeof hint.file !== "string" ||
      hint.file.trim() === "" ||
      hint.file.length > MAX_COMPONENT_HINT_TEXT_LENGTH)
  ) {
    return "field componentHint.file must be a non-empty string when present";
  }
  if (
    hint.line !== undefined &&
    (typeof hint.line !== "number" || !Number.isInteger(hint.line) || hint.line <= 0)
  ) {
    return "field componentHint.line must be a positive integer when present";
  }
  return null;
}
