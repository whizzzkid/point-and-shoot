/**
 * Tests for the fixture server.
 *
 * The path resolver is a containment guard, so its sad paths matter more than its happy one:
 * a fixture server that can be walked out of its own directory is a local file-disclosure hole,
 * and the failure is silent until someone looks.
 *
 * @module
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
  createHandler,
  CROSS_ORIGIN_PLACEHOLDER,
  resolvePath,
  startFixtureServer,
} from "./server.ts";

const CROSS_ORIGIN = "http://127.0.0.1:9999";
const handler = createHandler(() => CROSS_ORIGIN);

/** The directory the server is allowed to serve from, as a filesystem path. */
const ROOT = fromFileUrl(new URL(".", import.meta.url));

Deno.test("resolvePath maps a plain filename into the fixture directory", () => {
  assertEquals(resolvePath("/index.html"), `${ROOT}index.html`);
});

Deno.test("resolvePath treats the root as index.html", () => {
  assertEquals(resolvePath("/"), `${ROOT}index.html`);
});

Deno.test("resolvePath decodes percent-encoding into a real filesystem path", () => {
  // A URL pathname is encoded; a path is not. Resolving through `URL` re-encodes the space and
  // yields a path that looks plausible and cannot be opened.
  assertEquals(resolvePath("/a%20file.html"), `${ROOT}a file.html`);
  assertEquals(ROOT.includes("%"), false);
});

Deno.test("resolvePath returns a path the filesystem actually holds", async () => {
  const resolved = resolvePath("/index.html");
  assertNotEquals(resolved, null);
  await Deno.stat(resolved as string);
});

Deno.test("resolvePath rejects traversal out of the fixture directory", () => {
  assertEquals(resolvePath("/../../../etc/hosts"), null);
  assertEquals(resolvePath("/../deno.json"), null);
});

Deno.test("resolvePath rejects percent-encoded traversal", () => {
  // The browser decodes before sending in practice, but a hand-built request need not, and a
  // guard that only inspects the raw string would wave this through.
  assertEquals(resolvePath("/%2e%2e%2f%2e%2e%2fdeno.json"), null);
});

Deno.test("resolvePath rejects a directory request rather than listing it", () => {
  assertEquals(resolvePath("/subdir/"), null);
  assertEquals(resolvePath(""), null);
});

Deno.test("handler serves an existing page with no-store caching", async () => {
  const response = await handler(new Request("http://localhost/index.html"));
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  await response.body?.cancel();
});

Deno.test("handler substitutes the cross-origin placeholder in HTML", async () => {
  const response = await handler(new Request("http://localhost/iframe.html"));
  const body = await response.text();
  assertEquals(body.includes(CROSS_ORIGIN_PLACEHOLDER), false);
  assertEquals(body.includes(`${CROSS_ORIGIN}/frame-content.html`), true);
});

Deno.test("handler answers favicon.ico with 204 so consoles stay clean", async () => {
  const response = await handler(new Request("http://localhost/favicon.ico"));
  assertEquals(response.status, 204);
  assertEquals(response.body, null);
});

Deno.test("handler returns 404 for a missing page and for traversal", async () => {
  // `/../deno.json` is not in this list: the URL parser normalises it to `/deno.json` before the
  // handler runs, so it would test a plain miss. `%2e%2e%2f` survives parsing and does reach the
  // resolver.
  for (const path of ["/nope.html", "/%2e%2e%2fdeno.json"]) {
    const response = await handler(new Request(`http://localhost${path}`));
    assertEquals(response.status, 404, path);
    await response.body?.cancel();
  }
});

Deno.test("startFixtureServer binds two distinct origins that both serve", async () => {
  const fixture = startFixtureServer();
  try {
    assertNotEquals(fixture.base, fixture.crossOriginBase);

    for (const origin of [fixture.base, fixture.crossOriginBase]) {
      const response = await fetch(`${origin}/frame-content.html`);
      assertEquals(response.status, 200, origin);
      await response.body?.cancel();
    }

    // The parent page must name the *other* origin, or the frame is same-origin and the
    // cross-origin case silently stops being tested.
    const parent = await fetch(`${fixture.base}/iframe.html`);
    const body = await parent.text();
    assertEquals(body.includes(`${fixture.crossOriginBase}/frame-content.html`), true);
  } finally {
    await fixture.close();
  }
});
