import { assertEquals, assertStringIncludes } from "@std/assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readStarCount, REPOSITORY_SLUG, writeRepositoryProjection } from "./repository.mjs";

/** Collects warnings so each test can assert the reason a count was rejected was reported. */
function warnSink() {
  const messages = [];
  return { messages, warn: (message) => messages.push(message) };
}

/** @returns {Response} A minimal stand-in for the one response shape the reader consumes. */
function jsonResponse(body, status = 200) {
  return /** @type {Response} */ ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

Deno.test("star count reader returns the reported count", async () => {
  const { messages, warn } = warnSink();
  const requested = [];
  const stars = await readStarCount({
    fetchImpl: (url) => {
      requested.push(url);
      return Promise.resolve(jsonResponse({ stargazers_count: 1234 }));
    },
    slug: "owner/name",
    warn,
  });

  assertEquals(stars, 1234);
  assertEquals(messages, []);
  assertEquals(requested, ["https://api.github.com/repos/owner/name"]);
});

Deno.test("star count reader reports a non-success response instead of failing", async () => {
  const { messages, warn } = warnSink();
  const stars = await readStarCount({
    fetchImpl: () => Promise.resolve(jsonResponse({}, 403)),
    warn,
  });

  assertEquals(stars, null);
  assertEquals(messages.length, 1);
  assertStringIncludes(messages[0], "403");
});

Deno.test("star count reader rejects a payload with no numeric count", async () => {
  const { messages, warn } = warnSink();
  const stars = await readStarCount({
    fetchImpl: () => Promise.resolve(jsonResponse({ stargazers_count: "many" })),
    warn,
  });

  assertEquals(stars, null);
  assertEquals(messages.length, 1);
  assertStringIncludes(messages[0], "stargazers_count");
});

Deno.test("star count reader survives a transport failure", async () => {
  const { messages, warn } = warnSink();
  const stars = await readStarCount({
    fetchImpl: () => Promise.reject(new TypeError("dns lookup failed")),
    warn,
  });

  assertEquals(stars, null);
  assertEquals(messages.length, 1);
  assertStringIncludes(messages[0], "dns lookup failed");
});

Deno.test("star count reader survives an unparseable body", async () => {
  const { messages, warn } = warnSink();
  const stars = await readStarCount({
    fetchImpl: () =>
      Promise.resolve(
        /** @type {Response} */ ({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("unexpected token")),
        }),
      ),
    warn,
  });

  assertEquals(stars, null);
  assertEquals(messages.length, 1);
  assertStringIncludes(messages[0], "unexpected token");
});

Deno.test("repository projection writes the resolved count", async () => {
  const root = await mkdtemp(join(tmpdir(), "pns-repository-"));
  try {
    const outputPath = join(root, "repository.json");
    const projection = await writeRepositoryProjection(outputPath, {
      fetchImpl: () => Promise.resolve(jsonResponse({ stargazers_count: 7 })),
      slug: "owner/name",
      warn: () => {},
    });

    assertEquals(projection, {
      slug: "owner/name",
      url: "https://github.com/owner/name",
      stars: 7,
    });
    assertEquals(JSON.parse(await readFile(outputPath, "utf8")), projection);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

Deno.test("repository projection skips the network when disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "pns-repository-"));
  try {
    const outputPath = join(root, "repository.json");
    const projection = await writeRepositoryProjection(outputPath, {
      enabled: false,
      fetchImpl: () => Promise.reject(new Error("the build must not reach the network")),
    });

    assertEquals(projection.slug, REPOSITORY_SLUG);
    assertEquals(projection.stars, null);
    assertEquals(JSON.parse(await readFile(outputPath, "utf8")).stars, null);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
