import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "@std/assert";

import {
  authenticatedHeaders,
  ChromeStoreClient,
  type ChromeStoreClientOptions,
  reconcileChromeStatus,
} from "./chrome-store.ts";

const NOW = "2026-08-05T17:00:00Z";

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function options(fetch: typeof globalThis.fetch): ChromeStoreClientOptions {
  return {
    accessToken: "chrome-secret-token",
    extensionId: "abcdefghijklmnopabcdefghijklmnop",
    fetch,
    listingUrl:
      "https://chromewebstore.google.com/detail/point-shoot/abcdefghijklmnopabcdefghijklmnop",
    now: () => NOW,
    publisherId: "publisher-123",
    sleep: () => Promise.resolve(),
  };
}

Deno.test("chrome store reconciliation recognizes an exact public version", () => {
  assertEquals(
    reconcileChromeStatus({
      expectedVersion: "2026.805.0",
      listingUrl:
        "https://chromewebstore.google.com/detail/point-shoot/abcdefghijklmnopabcdefghijklmnop",
      now: NOW,
      status: {
        publishedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: "2026.805.0" }],
          state: "PUBLISHED",
        },
      },
    }),
    {
      expectedVersion: "2026.805.0",
      listingUrl:
        "https://chromewebstore.google.com/detail/point-shoot/abcdefghijklmnopabcdefghijklmnop",
      publicVersion: "2026.805.0",
      reconciledAt: NOW,
      state: "published",
    },
  );
});

Deno.test("chrome store reconciliation ignores malformed distribution channels", () => {
  assertEquals(
    reconcileChromeStatus({
      expectedVersion: "2026.805.0",
      listingUrl: undefined,
      now: NOW,
      status: {
        publishedItemRevisionStatus: {
          distributionChannels: [null, "invalid", { crxVersion: "2026.805.0" }],
          state: "PUBLISHED",
        },
      },
    }).state,
    "published",
  );
  assertEquals(
    reconcileChromeStatus({
      expectedVersion: "2026.805.0",
      listingUrl: undefined,
      now: NOW,
      status: {
        publishedItemRevisionStatus: {
          distributionChannels: [null, 42, {}],
          state: "PUBLISHED",
        },
      },
    }).state,
    "unpublished",
  );
});

Deno.test("chrome store authentication overrides every supported header shape", () => {
  const inputs: HeadersInit[] = [
    { authorization: "Bearer wrong", "x-test": "object" },
    [["Authorization", "Bearer wrong"], ["x-test", "tuples"]],
    new Headers({ authorization: "Bearer wrong", "x-test": "headers" }),
  ];
  for (const input of inputs) {
    const headers = authenticatedHeaders("chrome-secret-token", input);
    assertEquals(headers.get("authorization"), "Bearer chrome-secret-token");
    assertEquals(headers.has("x-test"), true);
  }
});

Deno.test("chrome store reconciliation surfaces approval and policy warnings", () => {
  const reviewed = reconcileChromeStatus({
    expectedVersion: "2026.805.0",
    listingUrl: undefined,
    now: NOW,
    status: {
      submittedItemRevisionStatus: {
        distributionChannels: [{ crxVersion: "2026.805.0" }],
        state: "STAGED",
      },
    },
  });
  assertEquals(reviewed.state, "reviewed");
  assertEquals(reviewed.reviewedAt, NOW);

  const warned = reconcileChromeStatus({
    expectedVersion: "2026.805.0",
    listingUrl: undefined,
    now: NOW,
    status: {
      publishedItemRevisionStatus: {
        distributionChannels: [{ crxVersion: "2026.805.0" }],
        state: "PUBLISHED",
      },
      warned: true,
    },
  });
  assertEquals(warned.state, "rejected");
  assertStringIncludes(warned.failure ?? "", "policy warning");
});

Deno.test("chrome store matching retry performs no upload", async () => {
  const calls: Array<{ method: string; url: string }> = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input) });
    return Promise.resolve(response({
      submittedItemRevisionStatus: {
        distributionChannels: [{ crxVersion: "2026.805.0" }],
        state: "PENDING_REVIEW",
      },
    }));
  };

  const result = await new ChromeStoreClient(options(fetch)).submit(
    new Uint8Array([1, 2, 3]),
    "2026.805.0",
  );

  assertEquals(result.state, "submitted");
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0]?.url ?? "", ":fetchStatus");
});

Deno.test("chrome store blocks publish warnings and redacts credentials", async () => {
  let call = 0;
  const fetch: typeof globalThis.fetch = (_input, init) => {
    call += 1;
    if (call === 1) return Promise.resolve(response({}));
    if (call === 2) {
      assertEquals(init?.method, "POST");
      return Promise.resolve(response({ crxVersion: "2026.805.0", uploadState: "SUCCEEDED" }));
    }
    return Promise.resolve(response({
      state: "PUBLISH_FAILED",
      error: {
        details: [{ warningInfo: { warnings: [{ reason: "MISSING_SCREENSHOTS" }] } }],
      },
      echoed: "chrome-secret-token",
    }, 400));
  };

  const error = await assertRejects(
    () => new ChromeStoreClient(options(fetch)).submit(new Uint8Array([1]), "2026.805.0"),
    Error,
    "Chrome publish failed",
  );
  assertStringIncludes(error.message, "MISSING_SCREENSHOTS");
  assertEquals(error.message.includes("chrome-secret-token"), false);
  assertEquals(error.message.includes("Authorization"), false);
});

Deno.test("chrome store uploads, publishes, and reconciles the exact version", async () => {
  const methods: string[] = [];
  let call = 0;
  const fetch: typeof globalThis.fetch = (_input, init) => {
    call += 1;
    methods.push(init?.method ?? "GET");
    if (call === 1) return Promise.resolve(response({}));
    if (call === 2) {
      return Promise.resolve(response({ crxVersion: "2026.805.0", uploadState: "SUCCEEDED" }));
    }
    if (call === 3) return Promise.resolve(response({ state: "PUBLISH_PENDING" }));
    return Promise.resolve(response({
      submittedItemRevisionStatus: {
        distributionChannels: [{ crxVersion: "2026.805.0" }],
        state: "PENDING_REVIEW",
      },
    }));
  };

  const result = await new ChromeStoreClient(options(fetch)).submit(
    new Uint8Array([1, 2, 3]),
    "2026.805.0",
  );
  assertEquals(result.state, "submitted");
  assertEquals(methods, ["GET", "POST", "POST", "GET"]);
});

Deno.test("chrome store polling is bounded", async () => {
  let call = 0;
  const fetch: typeof globalThis.fetch = () => {
    call += 1;
    if (call === 1) return Promise.resolve(response({}));
    if (call === 2) return Promise.resolve(response({ uploadState: "IN_PROGRESS" }));
    return Promise.resolve(response({ lastAsyncUploadState: "IN_PROGRESS" }));
  };

  await assertRejects(
    () =>
      new ChromeStoreClient({ ...options(fetch), maxPollAttempts: 2 }).submit(
        new Uint8Array([1]),
        "2026.805.0",
      ),
    Error,
    "timed out",
  );
  assertEquals(call, 4);
});

Deno.test("chrome store rejects a successful response with malformed JSON", async () => {
  const fetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response("not-json", { status: 200 }));
  await assertRejects(
    () => new ChromeStoreClient(options(fetch)).reconcile("2026.805.0"),
    Error,
    "not valid JSON",
  );
});

Deno.test("chrome store rejects a conflicting submitted version", () => {
  assertThrows(
    () =>
      reconcileChromeStatus({
        expectedVersion: "2026.805.0",
        listingUrl: undefined,
        now: NOW,
        status: {
          submittedItemRevisionStatus: {
            distributionChannels: [{ crxVersion: "2026.804.0" }],
            state: "PENDING_REVIEW",
          },
        },
      }),
    Error,
    "expected 2026.805.0",
  );
});

Deno.test("chrome store fails closed on cancelled and unknown submission states", () => {
  for (const state of ["CANCELLED", "A_NEW_VENDOR_STATE"]) {
    if (state === "CANCELLED") {
      const status = reconcileChromeStatus({
        expectedVersion: "2026.805.0",
        listingUrl: undefined,
        now: NOW,
        status: {
          submittedItemRevisionStatus: {
            distributionChannels: [{ crxVersion: "2026.805.0" }],
            state,
          },
        },
      });
      assertEquals(status.state, "rejected");
      assertStringIncludes(status.failure ?? "", "CANCELLED");
      continue;
    }
    assertThrows(
      () =>
        reconcileChromeStatus({
          expectedVersion: "2026.805.0",
          listingUrl: undefined,
          now: NOW,
          status: {
            submittedItemRevisionStatus: {
              distributionChannels: [{ crxVersion: "2026.805.0" }],
              state,
            },
          },
        }),
      Error,
      "unsupported submission state",
    );
  }
});
