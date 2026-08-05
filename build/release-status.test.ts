import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "@std/assert";
import { fromFileUrl } from "@std/path";

import {
  projectReleaseStatus,
  type ReleaseStatus,
  renderReleaseStatus,
  runReleaseStatusCommand,
  type StoreReleaseStatus,
} from "./release-status.ts";

const EXPECTED_VERSION = "2026.805.0";
const RECONCILED_AT = "2026-08-05T16:00:00Z";

function storeStatus(
  state: StoreReleaseStatus["state"],
  overrides: Partial<StoreReleaseStatus> = {},
): StoreReleaseStatus {
  return {
    expectedVersion: EXPECTED_VERSION,
    reconciledAt: RECONCILED_AT,
    state,
    ...overrides,
  };
}

function releaseStatus(
  chrome: StoreReleaseStatus,
  firefox: StoreReleaseStatus,
  overrides: Partial<ReleaseStatus> = {},
): ReleaseStatus {
  return {
    chrome,
    firefox,
    listingSummaryChanged: false,
    version: EXPECTED_VERSION,
    ...overrides,
  };
}

Deno.test("release status renders unpublished, submitted, reviewed, and published states", () => {
  const states: readonly StoreReleaseStatus[] = [
    storeStatus("unpublished"),
    storeStatus("submitted", {
      submittedAt: "2026-08-05T16:01:00Z",
      submittedVersion: EXPECTED_VERSION,
    }),
    storeStatus("reviewed", {
      reviewedAt: "2026-08-05T16:02:00Z",
      submittedAt: "2026-08-05T16:01:00Z",
      submittedVersion: EXPECTED_VERSION,
    }),
    storeStatus("published", {
      listingUrl: "https://example.com/store/point-and-shoot",
      publicVersion: EXPECTED_VERSION,
      reviewedAt: "2026-08-05T16:02:00Z",
      submittedAt: "2026-08-05T16:01:00Z",
      submittedVersion: EXPECTED_VERSION,
    }),
  ];

  for (const status of states) {
    const rendered = renderReleaseStatus(releaseStatus(status, storeStatus("unpublished")));
    assertStringIncludes(rendered, "<!-- point-and-shoot-store-status:start -->");
    assertStringIncludes(rendered, `**${status.state}**`);
    assertStringIncludes(rendered, EXPECTED_VERSION);
    assertStringIncludes(rendered, RECONCILED_AT);
  }
  assertStringIncludes(
    renderReleaseStatus(releaseStatus(states[3]!, storeStatus("unpublished"))),
    "[Install from Chrome](https://example.com/store/point-and-shoot)",
  );
});

Deno.test("release status exposes partial publication and actionable failures", () => {
  const rendered = renderReleaseStatus(releaseStatus(
    storeStatus("published", {
      listingUrl: "https://example.com/chrome",
      publicVersion: EXPECTED_VERSION,
    }),
    storeStatus("rejected", {
      failure: "Correct the data-use disclosure and resubmit.",
      submittedVersion: EXPECTED_VERSION,
    }),
  ));

  assertStringIncludes(rendered, "Chrome | `2026.805.0` | **published**");
  assertStringIncludes(rendered, "Firefox | `2026.805.0` | **rejected**");
  assertStringIncludes(rendered, "Correct the data-use disclosure and resubmit.");
  assertStringIncludes(rendered, "Store publication is incomplete");
});

Deno.test("release status reports public version mismatches and Chrome listing actions", () => {
  const rendered = renderReleaseStatus(releaseStatus(
    storeStatus("published", {
      listingUrl: "https://example.com/chrome",
      publicVersion: "2026.804.0",
    }),
    storeStatus("published", {
      listingUrl: "https://example.com/firefox",
      publicVersion: EXPECTED_VERSION,
    }),
    { listingSummaryChanged: true },
  ));

  assertStringIncludes(rendered, "Version mismatch: expected `2026.805.0`, public `2026.804.0`");
  assertStringIncludes(rendered, "Manual Chrome Web Store action required");
  assertStringIncludes(rendered, "update the listing summary in the Chrome Web Store dashboard");
  assertStringIncludes(rendered, "Store publication is incomplete");
});

Deno.test("published versions without live listing URLs remain incomplete", () => {
  const rendered = renderReleaseStatus(releaseStatus(
    storeStatus("published", { publicVersion: EXPECTED_VERSION }),
    storeStatus("published", { publicVersion: EXPECTED_VERSION }),
  ));

  assertStringIncludes(rendered, "Store publication is incomplete");
});

Deno.test("status projection preserves release notes and is idempotent", () => {
  const initialBody = "# Release notes\n\nShipped a useful change.\n";
  const status = releaseStatus(storeStatus("unpublished"), storeStatus("unpublished"));
  const projected = projectReleaseStatus(initialBody, status);

  assertStringIncludes(projected, initialBody.trim());
  assertStringIncludes(projected, "<!-- point-and-shoot-store-status:start -->");
  assertEquals(projectReleaseStatus(projected, status), projected);

  const updated = projectReleaseStatus(
    projected,
    releaseStatus(
      storeStatus("submitted", { submittedVersion: EXPECTED_VERSION }),
      storeStatus("unpublished"),
    ),
  );
  assertStringIncludes(updated, "# Release notes\n\nShipped a useful change.");
  assertEquals(updated.match(/point-and-shoot-store-status:start/g)?.length, 1);
});

Deno.test("status projection rejects malformed markers and inconsistent versions", () => {
  const status = releaseStatus(storeStatus("unpublished"), storeStatus("unpublished"));
  assertThrows(
    () => projectReleaseStatus("before\n<!-- point-and-shoot-store-status:start -->", status),
    Error,
    "both status markers",
  );
  assertThrows(
    () =>
      renderReleaseStatus({
        ...status,
        firefox: storeStatus("unpublished", { expectedVersion: "2026.804.0" }),
      }),
    Error,
    "expected version",
  );
  assertThrows(
    () => renderReleaseStatus(releaseStatus(storeStatus("rejected"), storeStatus("unpublished"))),
    Error,
    "requires actionable failure text",
  );
});

Deno.test("seed command preserves stdin release notes and starts both stores unpublished", async () => {
  const output = await runReleaseStatusCommand(
    ["seed", EXPECTED_VERSION, RECONCILED_AT],
    () => Promise.resolve("Existing release notes\n"),
  );

  assertStringIncludes(output, "Existing release notes");
  assertStringIncludes(output, "Chrome | `2026.805.0` | **unpublished**");
  assertStringIncludes(output, "Firefox | `2026.805.0` | **unpublished**");
});

Deno.test("seed command preserves an existing matching status byte-for-byte", async () => {
  const existing = projectReleaseStatus(
    "Existing release notes\n",
    releaseStatus(
      storeStatus("published", {
        listingUrl: "https://example.com/chrome",
        publicVersion: EXPECTED_VERSION,
      }),
      storeStatus("submitted", { submittedVersion: EXPECTED_VERSION }),
    ),
  );
  assertEquals(
    await runReleaseStatusCommand(
      ["seed", EXPECTED_VERSION, RECONCILED_AT],
      () => Promise.resolve(existing),
    ),
    existing,
  );
  await assertRejects(
    () =>
      runReleaseStatusCommand(
        ["seed", "2026.805.1", RECONCILED_AT],
        () => Promise.resolve(existing),
      ),
    Error,
    "belongs to a different release version",
  );
});

Deno.test("seed CLI writes projected status without adding a second trailing newline", async () => {
  const runCli = async (input: string): Promise<string> => {
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        fromFileUrl(new URL("release-status.ts", import.meta.url)),
        "seed",
        EXPECTED_VERSION,
        RECONCILED_AT,
      ],
      stdin: "piped",
      stdout: "piped",
    }).spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(input));
    await writer.close();
    return new TextDecoder().decode((await child.output()).stdout);
  };
  const output = await runCli("Existing release notes\n");

  assertEquals(output.endsWith("\n\n"), false);
  assertEquals(output.endsWith("\n"), true);
  assertEquals(await runCli(output), output);
});
