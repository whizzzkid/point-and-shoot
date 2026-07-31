/** The single source pattern for product documents published to the site. */
export const PUBLISHED_DOCS_PATTERN = "{README.md,design.md,specs/**/*.md,tutorials/**/*.md}";

const markdownExtension = /\.md$/i;
const readmeSuffix = /(^|\/)readme$/i;
const publishedRoots = new Set(["specs", "tutorials"]);

/**
 * Reports whether a repository-relative Markdown path belongs on the site.
 *
 * @param relativePath - A slash-separated path relative to `docs/`.
 * @returns Whether the file is part of the product-documentation set.
 */
export function isPublishedDoc(relativePath: string): boolean {
  if (relativePath === "README.md" || relativePath === "design.md") {
    return true;
  }
  return (
    publishedRoots.has(relativePath.split("/")[0] ?? "") && markdownExtension.test(relativePath)
  );
}

/**
 * Converts a documentation collection ID into its public route below `/docs/`.
 *
 * @param id - A collection ID or repository-relative Markdown path.
 * @returns The route segment without a leading or trailing slash.
 */
export function docsRoute(id: string): string {
  return id.replace(markdownExtension, "").replace(readmeSuffix, "$1").replace(/\/$/, "");
}
