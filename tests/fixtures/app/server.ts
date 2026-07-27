/**
 * Static server for the browser fixture app.
 *
 * Ports are assigned by the OS, never fixed. Tests get their base URLs from
 * {@link startFixtureServer}'s return value, so two suites — or a suite and an unrelated local
 * process — can never collide on a port.
 *
 * Two origins are served, not one. `iframe.html` needs a genuinely cross-origin frame, and the
 * fixtures must run offline, so the second origin is the same content on a different port:
 * same host, different port, different origin by the same-origin rule. No network egress.
 *
 * Because the cross-origin port is only known after binding, `iframe.html` carries
 * {@link CROSS_ORIGIN_PLACEHOLDER} where that origin belongs and the server substitutes it on
 * the way out. The origin therefore exists in exactly one place.
 *
 * Run standalone with `deno task fixture`, which prints both origins and serves until killed.
 *
 * @module
 */

import { fromFileUrl, join } from "@std/path";

/** Placeholder in HTML fixtures standing in for the cross-origin base URL. */
export const CROSS_ORIGIN_PLACEHOLDER = "__CROSS_ORIGIN__";

/**
 * Directory served by both origins — this file's own directory, with a trailing separator.
 *
 * `fromFileUrl`, not `.pathname`: a URL pathname percent-encodes every character a URL may not
 * carry literally, so a checkout under a directory whose name contains a space resolves to
 * `…/point%20and%20shoot/…` and every file read misses. Filesystem paths are not URLs.
 */
const ROOT = fromFileUrl(new URL(".", import.meta.url));

/**
 * MIME types for the extensions the fixtures actually use.
 *
 * Deliberately a closed list: an unknown extension is served as
 * `application/octet-stream` rather than guessed at, so a fixture that quietly stops being
 * interpreted as HTML fails visibly instead of half-working.
 */
const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
};

/**
 * Resolves a request pathname to a file path inside {@link ROOT}.
 *
 * @param pathname The request's URL pathname, percent-encoded as the browser sent it.
 * @returns The absolute path to serve, or `null` when the request escapes the served
 *   directory or names a directory rather than a file.
 *
 * @example
 * ```ts
 * resolvePath("/index.html");      // -> "<root>/index.html"
 * resolvePath("/");                // -> "<root>/index.html"
 * resolvePath("/a%20file.html");   // -> "<root>/a file.html"
 * resolvePath("/../../etc/hosts"); // -> null
 * ```
 */
export function resolvePath(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");

  // Directory listing is off, and there is no index fallback below the root: a request for a
  // subdirectory is a miss, not a listing.
  if (relative === "" || relative.endsWith("/")) return null;

  // `join` normalises, so `..` is resolved away before the containment check below rather than
  // being matched textually — a textual check misses `a/../../b`.
  const resolved = join(ROOT, relative);

  // Containment check: reject anything that normalised to outside the fixture directory,
  // including a traversal smuggled in percent-encoded (`%2e%2e%2f`, which the URL parser leaves
  // intact because `%2f` is not a separator to it).
  if (!resolved.startsWith(ROOT)) return null;

  return resolved;
}

/**
 * Builds the request handler for one origin.
 *
 * @param crossOrigin Function returning the cross-origin base URL substituted into HTML. It is
 *   a function, not a string, because the value is only known once that origin has bound —
 *   which happens after this handler is constructed but before any request reaches it.
 * @returns A handler serving files with no-cache headers.
 */
export function createHandler(crossOrigin: () => string): (request: Request) => Promise<Response> {
  /**
   * Handles one request: resolve, read, and serve with no-cache headers.
   *
   * No-cache is not decoration. A cached fixture page silently serves the previous run's
   * markup, which shows up three waves later as a test that fails only on a second run.
   *
   * @param request The incoming request.
   * @returns The file, `404` on a miss, or `500` on an unreadable file.
   */
  return async function handler(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const filePath = resolvePath(pathname);

    const headers = new Headers({
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
    });

    // Browsers request this unprompted on every navigation. Left as a 404 it logs a console
    // error on every fixture page, which buries the errors the fixtures exist to surface.
    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 204, headers });
    }

    if (filePath === null) {
      return new Response("Not found\n", { status: 404, headers });
    }

    // Only a dot in the final segment is an extension. `lastIndexOf` alone would read the "E" of
    // `/app/README` and the `.d/name` of `/app/v1.d/name` as one.
    const dot = filePath.lastIndexOf(".");
    const extension = dot > filePath.lastIndexOf("/") ? filePath.slice(dot) : "";
    headers.set("content-type", MIME_TYPES[extension] ?? "application/octet-stream");

    try {
      if (extension === ".html") {
        const text = await Deno.readTextFile(filePath);
        return new Response(text.replaceAll(CROSS_ORIGIN_PLACEHOLDER, crossOrigin()), {
          status: 200,
          headers,
        });
      }
      const body = await Deno.readFile(filePath);
      return new Response(body, { status: 200, headers });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound || error instanceof Deno.errors.IsADirectory) {
        return new Response("Not found\n", { status: 404, headers });
      }
      // Anything else — a permission problem, a read error — is a fixture bug worth surfacing
      // loudly rather than reporting as a missing page.
      console.error(`fixture: failed to read ${filePath}:`, error);
      return new Response("Internal error\n", { status: 500, headers });
    }
  };
}

/** A running fixture server: two origins over the same directory, plus a way to stop them. */
export interface FixtureServer {
  /** Base URL of the primary origin, with no trailing slash. Point tests here. */
  readonly base: string;
  /** Base URL of the second origin, used only as `iframe.html`'s cross-origin frame source. */
  readonly crossOriginBase: string;
  /** Shuts both origins down and resolves once they have stopped. */
  close(): Promise<void>;
}

/**
 * Starts both fixture origins on OS-assigned ports.
 *
 * @returns The running server, including the two base URLs to point a browser at.
 *
 * Synchronous: `Deno.serve` has already bound the listener by the time it returns, so both
 * ports are known without awaiting anything.
 *
 * @example
 * ```ts
 * const fixture = startFixtureServer();
 * await page.goto(`${fixture.base}/iframe.html`);
 * await fixture.close();
 * ```
 */
export function startFixtureServer(): FixtureServer {
  let crossOriginBase = "";
  const handler = createHandler(() => crossOriginBase);

  // The cross-origin listener binds first so its URL is known before the primary origin can
  // serve an `iframe.html` that needs to name it.
  const crossOriginServer = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    handler,
  );
  crossOriginBase = `http://127.0.0.1:${crossOriginServer.addr.port}`;

  const primaryServer = Deno.serve({ port: 0, hostname: "127.0.0.1", onListen: () => {} }, handler);
  const base = `http://127.0.0.1:${primaryServer.addr.port}`;

  return {
    base,
    crossOriginBase,
    async close(): Promise<void> {
      await Promise.all([primaryServer.shutdown(), crossOriginServer.shutdown()]);
    },
  };
}

if (import.meta.main) {
  const fixture = startFixtureServer();
  console.log(`fixture app:  ${fixture.base}`);
  console.log(`cross-origin: ${fixture.crossOriginBase}`);
}
