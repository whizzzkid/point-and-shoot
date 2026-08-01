import { dirname, extname, relative, resolve, sep } from "node:path";
import { visit } from "unist-util-visit";

const repositoryUrl = "https://github.com/whizzzkid/point-and-shoot";
const publishedRoots = new Set(["README.md", "design.md", "specs", "tutorials"]);
const excludedRoots = new Set(["adr", "plans"]);

function splitUrl(url) {
  const index = url.search(/[?#]/);
  return index === -1 ? [url, ""] : [url.slice(0, index), url.slice(index)];
}

function publishedRoute(relativePath) {
  const withoutExtension = relativePath.replace(/\.md$/, "");
  const route = withoutExtension.replace(/(^|\/)README$/, "$1").replace(/\/$/, "");
  return `/docs/${route.length > 0 ? `${route}/` : ""}`;
}

function rewriteRelativeUrl(url, sourcePath, docsRoot) {
  if (
    url.length === 0 ||
    url.startsWith("#") ||
    url.startsWith("/") ||
    /^[a-z][a-z+.-]*:/i.test(url)
  ) {
    return url;
  }

  const [pathname, suffix] = splitUrl(url);
  const targetPath = resolve(dirname(sourcePath), pathname);
  const relativePath = relative(docsRoot, targetPath).split(sep).join("/");

  if (relativePath.startsWith("../")) {
    const repositoryRoot = dirname(docsRoot);
    const repositoryPath = relative(repositoryRoot, targetPath).split(sep).join("/");
    if (repositoryPath.startsWith("../")) {
      return url;
    }
    const view = extname(repositoryPath) === "" ? "tree" : "blob";
    return `${repositoryUrl}/${view}/main/${repositoryPath}${suffix}`;
  }

  const root = relativePath.split("/")[0];
  if (excludedRoots.has(root)) {
    const view = extname(relativePath) === ".md" ? "blob" : "tree";
    return `${repositoryUrl}/${view}/main/docs/${relativePath}${suffix}`;
  }

  if (extname(relativePath) === ".md" && publishedRoots.has(root)) {
    return `${publishedRoute(relativePath)}${suffix}`;
  }

  if (relativePath.startsWith("assets/")) {
    return `/docs/${relativePath}${suffix}`;
  }

  return url;
}

/**
 * Rewrites repository-relative Markdown links for the published site.
 *
 * Product docs point to their generated routes. Links to repository-only plans
 * and ADRs point back to GitHub, so the original Markdown remains readable in
 * both contexts.
 *
 * @returns A Remark transformer.
 */
export function remarkDocsLinks() {
  return (tree, file) => {
    const sourcePath = file.path;
    if (typeof sourcePath !== "string") {
      throw new Error("Cannot rewrite a documentation link without a source path.");
    }

    const docsMarker = `${sep}docs${sep}`;
    const docsMarkerIndex = sourcePath.lastIndexOf(docsMarker);
    if (docsMarkerIndex === -1) {
      throw new Error(`Documentation source is outside the docs directory: ${sourcePath}`);
    }
    const docsRoot = sourcePath.slice(0, docsMarkerIndex + `${sep}docs`.length);
    visit(tree, ["image", "link"], (node) => {
      node.url = rewriteRelativeUrl(node.url, sourcePath, docsRoot);
    });
  };
}

export const testing = { rewriteRelativeUrl };
