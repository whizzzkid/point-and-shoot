import type { Session } from "./schema.ts";

/** Settled projected export warning threshold measured by W2.11. */
export const DEFAULT_EXPORT_SIZE_BUDGET_BYTES = 2_000_000;

/** `storage.local` key pointing extension surfaces at the current IndexedDB session. */
export const ACTIVE_SESSION_ID_STORAGE_KEY = "activeSessionId";

/** Settled maximum number of serialized elements retained by one note. */
export const MAXIMUM_NOTE_ELEMENTS = 25;

const SENSITIVE_QUERY_NAME = /token|key|secret|auth|session/i;

function parsePageUrl(pageUrl: string): URL | null {
  try {
    return new URL(pageUrl);
  } catch {
    return null;
  }
}

/**
 * Decides whether a recorded URL should omit its query in export projections by default.
 *
 * @param pageUrl Full URL recorded with a note.
 * @returns Whether the query contains a sensitive parameter name.
 */
export function shouldStripQueryByDefault(pageUrl: string): boolean {
  const parsed = parsePageUrl(pageUrl);
  if (parsed === null) return false;
  return [...parsed.searchParams.keys()].some((name) => SENSITIVE_QUERY_NAME.test(name));
}

/**
 * Projects a recorded URL according to its per-note privacy preference.
 *
 * @param pageUrl Full URL recorded with a note.
 * @param stripQuery Whether to omit its query from the projection.
 * @returns The projected URL without mutating the recorded value.
 */
export function pageUrlForExport(pageUrl: string, stripQuery: boolean): string {
  if (!stripQuery) return pageUrl;
  const parsed = parsePageUrl(pageUrl);
  if (parsed === null) return pageUrl;
  parsed.search = "";
  return parsed.toString();
}

/**
 * Measures the canonical session JSON in UTF-8 bytes.
 *
 * @param session Session to project for export.
 * @returns Encoded JSON byte length.
 */
export function projectedSessionSize(session: Session): number {
  return new TextEncoder().encode(JSON.stringify(session)).byteLength;
}
