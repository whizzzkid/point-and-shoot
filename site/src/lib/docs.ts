import type { CollectionEntry } from "astro:content";

const markdownExtension = /\.md$/;
const readmeSuffix = /(^|\/)readme$/i;

/**
 * Converts a documentation collection ID into its public route below `/docs/`.
 *
 * @param id - The collection entry ID, with or without a Markdown extension.
 * @returns The route segment without a leading or trailing slash.
 */
export function docsRoute(id: string): string {
  return id.replace(markdownExtension, "").replace(readmeSuffix, "$1").replace(/\/$/, "");
}

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
 * @param base - Astro's base URL.
 * @returns An absolute pathname within the deployed site.
 */
export function docsUrl(id: string, base: string): string {
  const route = docsRoute(id);
  return `${base}docs/${route.length > 0 ? `${route}/` : ""}`;
}

/**
 * Sorts documentation entries into the generated sidebar order.
 *
 * @param entries - Product documentation entries loaded from the repository.
 * @returns A new, consistently ordered array.
 */
export function sortDocs(entries: CollectionEntry<"docs">[]): CollectionEntry<"docs">[] {
  const order = new Map([
    ["readme", 0],
    ["design", 1],
    ["specs/readme", 2],
    ["tutorials/readme", 3],
  ]);

  return entries.toSorted((left, right) => {
    const leftRank = order.get(left.id.replace(markdownExtension, "").toLowerCase()) ?? 10;
    const rightRank = order.get(right.id.replace(markdownExtension, "").toLowerCase()) ?? 10;
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
}
