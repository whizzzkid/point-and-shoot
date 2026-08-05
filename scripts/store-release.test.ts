import { assertEquals, assertStringIncludes } from "@std/assert";

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
  assertStringIncludes(result.releaseBody, "Chrome: Automatic store publishing is disabled");
  assertStringIncludes(result.releaseBody, "Firefox: Automatic store publishing is disabled");
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
