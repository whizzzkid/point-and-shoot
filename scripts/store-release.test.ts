import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";

import { runStoreRelease, runStoreReleaseCommand } from "./store-release.ts";

const INITIAL_BODY = "# Release notes\n";

Deno.test("disabled store publication reads no secret and records visible status", async () => {
  let secretReads = 0;
  const result = await runStoreRelease({
    enabled: false,
    expectedVersion: "2026.805.0",
    listingSummaryChanged: false,
    now: "2026-08-05T17:00:00Z",
    readReleaseBody: () => Promise.resolve(INITIAL_BODY),
    readSecrets: () => {
      secretReads += 1;
      throw new Error("must not run");
    },
    stores: undefined,
  });

  assertEquals(secretReads, 0);
  assertStringIncludes(result.releaseBody, "Automatic store publishing is disabled");
  assertEquals(result.releaseBody.includes("Browser store publication"), false);
});

Deno.test("disabled publication preserves an existing same-version store status", async () => {
  const existing = [
    "# Release notes",
    "",
    "<!-- point-and-shoot-store-status:start -->",
    "## Browser store publication",
    "",
    "GitHub release version: `2026.805.0`",
    "",
    "Chrome | `2026.805.0` | **published** | — | — | `2026.805.0` · [Install from Chrome](https://chromewebstore.google.com/detail/point-shoot/abcdefghijklmnopabcdefghijklmnop) | 2026-08-05T17:00:00Z",
    "Firefox | `2026.805.0` | **submitted** | `2026.805.0` at 2026-08-05T17:00:00Z | — | — | 2026-08-05T17:00:00Z",
    "<!-- point-and-shoot-store-status:end -->",
    "",
  ].join("\n");
  const result = await runStoreRelease({
    enabled: false,
    expectedVersion: "2026.805.0",
    listingSummaryChanged: false,
    now: "2026-08-05T18:00:00Z",
    readReleaseBody: () => Promise.resolve(existing),
    readSecrets: () => ({ values: [] }),
    stores: undefined,
  });

  assertStringIncludes(result.releaseBody, "Chrome | `2026.805.0` | **published**");
  assertStringIncludes(result.releaseBody, "Firefox | `2026.805.0` | **submitted**");
  assertStringIncludes(result.releaseBody, "Automatic store publishing is disabled");
  const repeated = await runStoreRelease({
    enabled: false,
    expectedVersion: "2026.805.0",
    listingSummaryChanged: false,
    now: "2026-08-05T19:00:00Z",
    readReleaseBody: () => Promise.resolve(result.releaseBody),
    readSecrets: () => ({ values: [] }),
    stores: undefined,
  });
  assertEquals(repeated.releaseBody, result.releaseBody);
});

Deno.test("disabled workflow command needs no asset directory or vendor environment", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const input = `${directory}/input.md`;
    const output = `${directory}/output.md`;
    await Deno.writeTextFile(input, INITIAL_BODY);

    assertEquals(
      await runStoreReleaseCommand([
        "disabled",
        "2026.805.0",
        "2026-08-05T17:00:00Z",
        input,
        output,
      ]),
      '{"failed":false}\n',
    );
    assertStringIncludes(await Deno.readTextFile(output), "Automatic store publishing is disabled");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("store publication refuses to overwrite a different release version", async () => {
  await assertRejects(
    () =>
      runStoreRelease({
        enabled: false,
        expectedVersion: "2026.805.1",
        listingSummaryChanged: false,
        now: "2026-08-05T19:00:00Z",
        readReleaseBody: () =>
          Promise.resolve([
            "<!-- point-and-shoot-store-status:start -->",
            "GitHub release version: `2026.805.0`",
            "<!-- point-and-shoot-store-status:end -->",
          ].join("\n")),
        readSecrets: () => ({ values: [] }),
        stores: undefined,
      }),
    Error,
    "different release version",
  );
});

Deno.test("enabled publication preserves partial success and redacts secrets", async () => {
  const result = await runStoreRelease({
    enabled: true,
    expectedVersion: "2026.805.0",
    listingSummaryChanged: true,
    now: "2026-08-05T17:00:00Z",
    readReleaseBody: () => Promise.resolve(INITIAL_BODY),
    readSecrets: () => ({ values: ["firefox-secret"] }),
    stores: {
      chrome: () =>
        Promise.resolve({
          expectedVersion: "2026.805.0",
          publicVersion: "2026.805.0",
          reconciledAt: "2026-08-05T17:00:00Z",
          state: "published",
        }),
      firefox: () => Promise.reject(new Error("vendor rejected firefox-secret Authorization")),
    },
  });

  assertEquals(result.failed, true);
  assertStringIncludes(result.releaseBody, "Chrome | `2026.805.0` | **published**");
  assertStringIncludes(result.releaseBody, "Firefox | `2026.805.0` | **rejected**");
  assertStringIncludes(result.releaseBody, "vendor rejected [REDACTED] [REDACTED]");
  assertEquals(result.releaseBody.includes("firefox-secret"), false);
});

Deno.test("enabled publication fails when a vendor reconciles a rejection", async () => {
  const rejected = {
    expectedVersion: "2026.805.0",
    failure: "Vendor rejected the submission.",
    reconciledAt: "2026-08-05T17:00:00Z",
    state: "rejected" as const,
  };
  const result = await runStoreRelease({
    enabled: true,
    expectedVersion: "2026.805.0",
    listingSummaryChanged: false,
    now: "2026-08-05T17:00:00Z",
    readReleaseBody: () => Promise.resolve(INITIAL_BODY),
    readSecrets: () => ({ values: [] }),
    stores: {
      chrome: () => Promise.resolve(rejected),
      firefox: () => Promise.resolve(rejected),
    },
  });
  assertEquals(result.failed, true);
});
