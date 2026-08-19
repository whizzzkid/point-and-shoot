import type { CollectionEntry } from "astro:content";

import { docsRoute } from "./docs-manifest.ts";

export { docsRoute };

const markdownExtension = /\.md$/;

/**
 * Reads the first Markdown H1 without requiring duplicated frontmatter.
 *
 * @param body - The original Markdown document body.
 * @param fallback - A fallback based on the collection entry ID.
 * @returns The document title.
 */
export function docsTitle(body: string | undefined, fallback: string): string {
  const heading = body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading ?? fallback.replace(markdownExtension, "").split("/").at(-1) ?? "Documentation";
}

/**
 * Creates the published URL for a documentation entry.
 *
 * @param id - The collection entry ID.
 * @returns An absolute pathname within the deployed site.
 */
export function docsUrl(id: string): string {
  const route = docsRoute(id);
  return `/docs/${route.length > 0 ? `${route}/` : ""}`;
}

/**
 * Ranks documents that carry a deliberate reading order.
 *
 * Index and overview pages lead. Tutorials follow the user story — install, configure, capture,
 * export — before the advanced and maintainer guides, so the sidebar and the prev/next pagination
 * both read as a sequence rather than an alphabetical list. Unlisted documents keep the shared
 * fallback rank and stay alphabetical among themselves.
 */
const DOCS_ORDER = new Map([
  ["readme", 0],
  ["design", 1],
  ["specs/readme", 2],
  ["tutorials/readme", 3],
  ["tutorials/getting-started", 20],
  ["tutorials/options", 21],
  ["tutorials/sessions", 22],
  ["tutorials/exporting", 23],
  ["tutorials/playwright-companion", 24],
  ["tutorials/building-from-source", 25],
  ["tutorials/troubleshooting", 26],
  ["tutorials/releasing", 27],
]);

const FALLBACK_RANK = 10;

/**
 * Resolves the explicit reading-order rank for a documentation entry.
 *
 * @param id - The collection entry ID, with or without its Markdown extension.
 * @returns The configured rank, or the shared fallback for unlisted documents.
 */
function docsRank(id: string): number {
  return DOCS_ORDER.get(id.replace(markdownExtension, "").toLowerCase()) ?? FALLBACK_RANK;
}

/**
 * Sorts documentation entries into the generated sidebar order.
 *
 * @param entries - Product documentation entries loaded from the repository.
 * @returns A new, consistently ordered array.
 */
export function sortDocs(entries: CollectionEntry<"docs">[]): CollectionEntry<"docs">[] {
  return entries.toSorted((left, right) => {
    return docsRank(left.id) - docsRank(right.id) || left.id.localeCompare(right.id);
  });
}
