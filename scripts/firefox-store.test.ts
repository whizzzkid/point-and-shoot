import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";

import {
  FirefoxStoreClient,
  type FirefoxStoreClientOptions,
  reconcileFirefoxStatus,
} from "./firefox-store.ts";

const NOW = "2026-08-05T17:00:00Z";
const EXTENSION_ID = "pointandshoot@whizzzkid.dev";

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function options(overrides: Partial<FirefoxStoreClientOptions> = {}): FirefoxStoreClientOptions {
  return {
    apiKey: "firefox-key",
    apiSecret: "firefox-secret",
    extensionId: EXTENSION_ID,
    fetch: () => Promise.resolve(response({}, 404)),
    now: () => NOW,
    run: () => Promise.resolve({ code: 0, stderr: "", stdout: "submitted" }),
    ...overrides,
  };
}

Deno.test("firefox store reconciliation maps public and rejected states", () => {
  assertEquals(
    reconcileFirefoxStatus({
      expectedVersion: "2026.805.0",
      listingUrl: "https://addons.mozilla.org/firefox/addon/point-shoot/",
      now: NOW,
      version: { file: { status: "public" }, reviewed: NOW, version: "2026.805.0" },
    }),
    {
      expectedVersion: "2026.805.0",
      listingUrl: "https://addons.mozilla.org/firefox/addon/point-shoot/",
      publicVersion: "2026.805.0",
      reconciledAt: NOW,
      reviewedAt: NOW,
      state: "published",
    },
  );

  assertEquals(
    reconcileFirefoxStatus({
      expectedVersion: "2026.805.0",
      listingUrl: undefined,
      now: NOW,
      version: { file: { status: "disabled" }, version: "2026.805.0" },
    }).state,
    "rejected",
  );
});

Deno.test("firefox matching retry does not invoke web-ext", async () => {
  let runs = 0;
  const client = new FirefoxStoreClient(options({
    fetch: () =>
      Promise.resolve(response({ file: { status: "unreviewed" }, version: "2026.805.0" })),
    run: () => {
      runs += 1;
      return Promise.resolve({ code: 0, stderr: "", stdout: "" });
    },
  }));

  const result = await client.submit({
    approvalNotes: "Rebuild using the attached instructions.",
    artifactsDir: "/tmp/artifacts",
    expectedVersion: "2026.805.0",
    metadataPath: "/tmp/metadata.json",
    releaseNotes: "Current release notes.",
    sourceArchivePath: "/tmp/firefox-source.zip",
    sourceDir: "/tmp/firefox",
  });
  assertEquals(result.state, "submitted");
  assertEquals(runs, 0);
});

Deno.test("firefox submission keeps credentials out of process arguments", async () => {
  let invocation: Parameters<NonNullable<FirefoxStoreClientOptions["run"]>>[0] | undefined;
  let fetches = 0;
  const client = new FirefoxStoreClient(options({
    fetch: () => {
      fetches += 1;
      return Promise.resolve(
        fetches === 1
          ? response({}, 404)
          : response({ file: { status: "unreviewed" }, version: "2026.805.0" }),
      );
    },
    run: (value) => {
      invocation = value;
      return Promise.resolve({ code: 0, stderr: "", stdout: "accepted" });
    },
  }));

  await client.submit({
    approvalNotes: "No remote code. See source archive.",
    artifactsDir: "/tmp/artifacts",
    expectedVersion: "2026.805.0",
    metadataPath: "/tmp/metadata.json",
    releaseNotes: "Current release notes.",
    sourceArchivePath: "/tmp/firefox-source.zip",
    sourceDir: "/tmp/firefox",
  });

  const args = invocation?.args.join(" ") ?? "";
  assertStringIncludes(args, "npm:web-ext@10.5.0");
  assertStringIncludes(args, "--channel listed");
  assertStringIncludes(args, "--upload-source-code /tmp/firefox-source.zip");
  assertEquals(args.includes("firefox-key"), false);
  assertEquals(args.includes("firefox-secret"), false);
  assertEquals(invocation?.env.WEB_EXT_API_KEY, "firefox-key");
  assertEquals(invocation?.env.WEB_EXT_API_SECRET, "firefox-secret");
  const metadata = JSON.parse(await Deno.readTextFile("/tmp/metadata.json"));
  assertEquals(metadata.version.release_notes, { "en-US": "Current release notes." });
});

Deno.test("firefox duplicate submission is an idempotent matching retry", async () => {
  const client = new FirefoxStoreClient(options({
    run: () => Promise.resolve({ code: 1, stderr: "HTTP 409: version already exists", stdout: "" }),
  }));

  const result = await client.submit({
    approvalNotes: "No remote code.",
    artifactsDir: "/tmp/artifacts",
    expectedVersion: "2026.805.0",
    metadataPath: "/tmp/metadata.json",
    releaseNotes: "Current release notes.",
    sourceArchivePath: "/tmp/firefox-source.zip",
    sourceDir: "/tmp/firefox",
  });
  assertEquals(result.state, "submitted");
  assertEquals(result.submittedVersion, "2026.805.0");
});

Deno.test("firefox store rejects a conflicting version", () => {
  assertThrows(
    () =>
      reconcileFirefoxStatus({
        expectedVersion: "2026.805.0",
        listingUrl: undefined,
        now: NOW,
        version: { file: { status: "unreviewed" }, version: "2026.804.0" },
      }),
    Error,
    "expected 2026.805.0",
  );
});
