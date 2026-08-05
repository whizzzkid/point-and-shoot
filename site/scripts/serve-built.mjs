import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

async function responsePath(distRoot, requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch (error) {
    if (error instanceof URIError) {
      return null;
    }
    throw error;
  }
  const candidate = resolve(distRoot, relativePath);
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${sep}`)) {
    return null;
  }
  try {
    const details = await stat(candidate);
    return details.isDirectory() ? resolve(candidate, "index.html") : candidate;
  } catch {
    return relativePath.endsWith("/") || relativePath.length === 0
      ? resolve(candidate, "index.html")
      : null;
  }
}

/**
 * Starts a static server that mirrors the custom-domain root path.
 *
 * @param options - Optional host, port, and built-output path.
 * @returns The listening server and its origin.
 */
export async function startBuiltSite({
  distRoot = resolve(siteRoot, "dist"),
  host = "127.0.0.1",
  port = 4173,
} = {}) {
  const server = createServer(async (request, response) => {
    const filePath = await responsePath(distRoot, request.url ?? "/");
    if (filePath === null) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    try {
      const details = await stat(filePath);
      if (!details.isFile()) {
        throw new Error("Not a file");
      }
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolveListening);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The built-site server did not bind a TCP address.");
  }
  return { origin: `http://${host}:${address.port}`, server };
}

if (import.meta.main) {
  const { origin } = await startBuiltSite();
  console.log(`Listening at ${origin}/`);
}
