import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parse } from "parse5";

import { docsRoute, isPublishedDoc } from "../src/lib/docs-manifest.ts";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultRepositoryRoot = resolve(siteRoot, "..");
const localOrigin = "https://point-and-shoot.invalid";
const repositoryBlobPrefix = "/whizzzkid/point-and-shoot/blob/main/";
const execFileAsync = promisify(execFile);

async function walk(root, predicate) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await walk(path, predicate)));
    } else if (predicate(path)) {
      paths.push(path);
    }
  }
  return paths;
}

function attributes(node) {
  return new Map((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
}

function cssResourceLinks(css) {
  const matches = [
    ...css.matchAll(/url\(\s*(?<quote>['"]?)(?<url>https?:\/\/[^'")\s]+)\k<quote>\s*\)/giu),
    ...css.matchAll(/@import\s+(?<quote>['"])(?<url>https?:\/\/[^'"\s;]+)\k<quote>/giu),
  ];
  return matches.flatMap((match) => {
    const url = match.groups?.url;
    return url === undefined ? [] : [{ kind: "asset", url }];
  });
}

function inspectHtml(html) {
  const document = parse(html);
  const canonicalUrls = [];
  const ids = new Set();
  const links = [];
  let mermaidCount = 0;

  function visitNode(node) {
    const attrs = attributes(node);
    const id = attrs.get("id");
    if (id !== undefined) {
      ids.add(id);
    }
    if (attrs.get("class")?.split(/\s+/).includes("mermaid-diagram")) {
      mermaidCount += 1;
    }
    if (attrs.has("style")) {
      links.push(...cssResourceLinks(attrs.get("style")));
    }
    if (node.tagName === "style") {
      for (const child of node.childNodes ?? []) {
        if (child.nodeName === "#text") {
          links.push(...cssResourceLinks(child.value));
        }
      }
    }

    if (node.tagName === "a" && attrs.has("href")) {
      links.push({ kind: "page", url: attrs.get("href") });
    } else if (
      ["audio", "iframe", "img", "script", "source", "video"].includes(node.tagName) &&
      attrs.has("src")
    ) {
      links.push({ kind: "asset", url: attrs.get("src") });
    } else if (node.tagName === "link" && attrs.has("href")) {
      if (attrs.get("rel") === "canonical") {
        canonicalUrls.push(attrs.get("href"));
      } else {
        links.push({ kind: "asset", url: attrs.get("href") });
      }
    } else if (node.tagName === "use" && attrs.has("href")) {
      links.push({ kind: "asset", url: attrs.get("href") });
    }

    for (const child of node.childNodes ?? []) {
      visitNode(child);
    }
  }

  visitNode(document);
  return { canonicalUrls, ids, links, mermaidCount };
}

function pageRoute(distRoot, filePath) {
  const relativePath = relative(distRoot, filePath).split(sep).join("/");
  if (relativePath === "index.html") {
    return "/";
  }
  return `/${relativePath.replace(/index\.html$/, "")}`;
}

function localRepositoryTarget(url, repositoryRoot) {
  if (url.origin !== "https://github.com" || !url.pathname.startsWith(repositoryBlobPrefix)) {
    return undefined;
  }
  const relativePath = decodeURIComponent(url.pathname.slice(repositoryBlobPrefix.length));
  const filePath = resolve(repositoryRoot, relativePath);
  return {
    filePath,
    relativePath,
    safe: filePath.startsWith(`${repositoryRoot}${sep}`),
  };
}

/**
 * Parses the three-digit HTTP status emitted by curl.
 *
 * @param {string} output - Curl's `--write-out` output.
 * @returns {number} The parsed HTTP status.
 */
export function parseHttpStatus(output) {
  const status = output.trim();
  if (!/^\d{3}$/.test(status)) {
    throw new Error(`invalid HTTP status from curl: ${JSON.stringify(output)}`);
  }
  return Number(status);
}

async function externalStatus(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    try {
      let response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "point-and-shoot-link-checker" },
      });
      if (response.status === 405) {
        response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "point-and-shoot-link-checker" },
        });
      }
      return response.status;
    } catch {
      const { stdout } = await execFileAsync("curl", [
        "--head",
        "--location",
        "--max-time",
        "15",
        "--output",
        "/dev/null",
        "--silent",
        "--show-error",
        "--write-out",
        "%{http_code}",
        url,
      ]);
      return parseHttpStatus(stdout);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validates built pages, anchors, assets, published scope, and Mermaid coverage.
 *
 * @param options - Paths and whether live external URLs should be requested.
 * @returns A summary of the checked output.
 */
export async function checkSite({
  distRoot = resolve(siteRoot, "dist"),
  docsRoot = resolve(defaultRepositoryRoot, "docs"),
  repositoryRoot = resolve(docsRoot, ".."),
  checkExternal = false,
  siteUrl = process.env.SITE_URL ?? "http://localhost:4321",
} = {}) {
  const htmlFiles = await walk(distRoot, (path) => path.endsWith(".html"));
  const pages = new Map();
  for (const filePath of htmlFiles) {
    const route = pageRoute(distRoot, filePath);
    const inspection = inspectHtml(await readFile(filePath, "utf8"));
    pages.set(route, { filePath, ...inspection });
  }

  const problems = [];
  const externalUrls = new Set();
  for (const [route, page] of pages) {
    const expectedCanonical = new URL(route, siteUrl).href;
    if (page.canonicalUrls.length !== 1) {
      problems.push(`${route}: expected one canonical link, found ${page.canonicalUrls.length}`);
    } else if (page.canonicalUrls[0] !== expectedCanonical) {
      problems.push(
        `${route}: unexpected canonical ${page.canonicalUrls[0]}; expected ${expectedCanonical}`,
      );
    }

    const sourceUrl = `${localOrigin}${route}`;
    for (const link of page.links) {
      let url;
      try {
        url = new URL(link.url, sourceUrl);
      } catch {
        problems.push(`${route}: malformed link ${link.url}`);
        continue;
      }
      if (url.origin !== localOrigin) {
        if (link.kind === "page" && /^https?:$/.test(url.protocol)) {
          const repositoryTarget = localRepositoryTarget(url, repositoryRoot);
          if (repositoryTarget !== undefined) {
            if (!repositoryTarget.safe) {
              problems.push(`${route}: unsafe repository target ${repositoryTarget.relativePath}`);
              continue;
            }
            try {
              if (!(await stat(repositoryTarget.filePath)).isFile()) {
                problems.push(
                  `${route}: missing repository target ${repositoryTarget.relativePath}`,
                );
              }
            } catch {
              problems.push(`${route}: missing repository target ${repositoryTarget.relativePath}`);
            }
            continue;
          }
          externalUrls.add(url.href);
        } else if (link.kind === "page" && ["mailto:", "tel:"].includes(url.protocol)) {
          continue;
        } else {
          problems.push(`${route}: remote resource is not allowed: ${link.url}`);
        }
        continue;
      }

      const targetRoute = url.pathname;

      const targetPage = pages.get(targetRoute);
      if (targetPage !== undefined) {
        if (url.hash.length > 1) {
          let anchor;
          try {
            anchor = decodeURIComponent(url.hash.slice(1));
          } catch {
            problems.push(`${route}: malformed anchor ${url.hash} in ${targetRoute}`);
            continue;
          }
          if (!targetPage.ids.has(anchor)) {
            problems.push(`${route}: missing anchor ${url.hash} in ${targetRoute}`);
          }
        }
        continue;
      }

      const targetAsset = resolve(distRoot, `.${targetRoute}`);
      if (!targetAsset.startsWith(`${distRoot}${sep}`)) {
        problems.push(`${route}: unsafe asset path ${link.url}`);
        continue;
      }
      try {
        if (!(await stat(targetAsset)).isFile()) {
          problems.push(`${route}: missing target ${link.url}`);
        }
      } catch {
        problems.push(`${route}: missing target ${link.url}`);
      }
    }
  }

  const markdownFiles = await walk(docsRoot, (path) => path.endsWith(".md"));
  const publishedFiles = markdownFiles.filter((path) => {
    const relativePath = relative(docsRoot, path).split(sep).join("/");
    return isPublishedDoc(relativePath);
  });
  let expectedMermaidCount = 0;
  for (const filePath of publishedFiles) {
    const relativePath = relative(docsRoot, filePath).split(sep).join("/");
    const route = docsRoute(relativePath);
    const outputRoute = `/docs/${route.length > 0 ? `${route}/` : ""}`;
    if (!pages.has(outputRoute)) {
      problems.push(`Missing output page for docs/${relativePath}: ${outputRoute}`);
    }
    expectedMermaidCount += (await readFile(filePath, "utf8")).match(/```mermaid\b/g)?.length ?? 0;
  }

  for (const excludedRoute of ["/docs/adr/", "/docs/plans/"]) {
    if ([...pages.keys()].some((route) => route.startsWith(excludedRoute))) {
      problems.push(`Repository-only content was published at ${excludedRoute}`);
    }
  }

  const renderedMermaidCount = [...pages.values()].reduce(
    (count, page) => count + page.mermaidCount,
    0,
  );
  if (renderedMermaidCount !== expectedMermaidCount) {
    problems.push(
      `Static Mermaid coverage differs: ${renderedMermaidCount} rendered, ` +
        `${expectedMermaidCount} in published Markdown`,
    );
  }

  if (checkExternal) {
    const results = await Promise.all(
      [...externalUrls].map(async (url) => {
        try {
          return { status: await externalStatus(url), url };
        } catch (error) {
          return { error, status: 0, url };
        }
      }),
    );
    for (const result of results) {
      if (result.status < 200 || result.status >= 400) {
        const detail = result.error instanceof Error ? ` (${result.error.message})` : "";
        problems.push(`External link returned ${result.status}: ${result.url}${detail}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Site integrity check failed:\n${problems.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  return {
    externalLinks: externalUrls.size,
    pages: pages.size,
    publishedDocs: publishedFiles.length,
    staticDiagrams: renderedMermaidCount,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = await checkSite({ checkExternal: process.argv.includes("--external") });
  console.log(
    `Checked ${summary.pages} pages, ${summary.publishedDocs} published docs, ` +
      `${summary.staticDiagrams} static diagrams, and ${summary.externalLinks} external links.`,
  );
}
