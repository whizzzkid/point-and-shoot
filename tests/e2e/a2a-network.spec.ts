/// <reference lib="dom" />

/**
 * Executable Phase 0 proof for multi-origin discovery, authenticated delivery, bounded input,
 * visible-page streaming, and recovery. This is intentionally outside the default unit-test glob:
 * `deno task a2a:network` builds and loads the real Chromium extension before running it.
 *
 * @module
 */

import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import {
  A2AClientError,
  type A2AClientLimits,
  type A2ATransportBinding,
  createA2AClientFactory,
} from "../../src/shared/a2a/client/mod.ts";
import { readBoundedJson } from "../../src/shared/a2a/client/response.ts";
import { AGENT_CARD_VARIANTS } from "../fixtures/a2a/cards.ts";
import {
  A2A_FIXTURE_TASK_ID,
  A2A_FIXTURE_TOKEN,
  A2A_PROOF_LIMITS,
  A2A_REMOTE_INPUT_LIMITS,
  startA2AFixtureServer,
} from "../fixtures/a2a/server.ts";
import { launchExtension, openExtensionPage } from "./extension-fixture.ts";

declare const chrome: {
  readonly permissions: {
    request(request: { readonly origins: readonly string[] }): Promise<boolean>;
  };
  readonly runtime: { getURL(path: string): string };
  readonly storage: {
    readonly session: {
      clear(): Promise<void>;
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Readonly<Record<string, unknown>>): Promise<void>;
    };
  };
};

const FAST_FAILURE_LIMITS: A2AClientLimits = {
  cardBytes: A2A_REMOTE_INPUT_LIMITS.cardBytes,
  jsonBytes: A2A_REMOTE_INPUT_LIMITS.jsonBytes,
  sseFrameBytes: A2A_REMOTE_INPUT_LIMITS.sseFrameBytes,
  requestMs: 75,
  firstByteMs: 75,
  streamIdleMs: 75,
};

const MESSAGE = {
  message: {
    messageId: "phase-0-message",
    role: "ROLE_USER",
    parts: [{ text: "prove browser delivery" }],
  },
};

function authenticatedHeaders(
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return { Authorization: `Bearer ${A2A_FIXTURE_TOKEN}`, ...extra };
}

Deno.test("A2A fixture proves separate discovery, auth, transports, and recovery", async () => {
  const fixture = startA2AFixtureServer();
  try {
    assertNotEquals(fixture.cardOrigin, fixture.interfaceOrigin);
    const unauthorized = await fetch(fixture.jsonRpcUrl, { method: "POST", body: "{}" });
    assertEquals(unauthorized.status, 401);
    assertEquals(unauthorized.headers.get("WWW-Authenticate"), 'Bearer realm="phase-0-a2a"');

    for (const transport of ["JSONRPC", "HTTP+JSON"] as const) {
      const factory = createA2AClientFactory({
        fetch,
        preferredTransports: [transport],
        limits: A2A_PROOF_LIMITS,
      });
      const card = await factory.resolve(new URL(fixture.cardUrl), AbortSignal.timeout(2_000));
      const target = factory.select(card);
      assertEquals(target.transport, transport);
      assertEquals(target.url.origin, fixture.interfaceOrigin);
      const client = factory.create(target);

      const unary = await client.sendMessage(MESSAGE, {
        signal: AbortSignal.timeout(2_000),
        serviceParameters: authenticatedHeaders(),
      });
      assertEquals(unary.task?.id, A2A_FIXTURE_TASK_ID);

      const interrupted = [];
      for await (
        const event of client.sendMessageStream(MESSAGE, {
          signal: AbortSignal.timeout(2_000),
          serviceParameters: authenticatedHeaders({ "X-Fixture-Disconnect": "after-status" }),
        })
      ) interrupted.push(event);
      assertEquals(interrupted.length, 2);
      assertEquals(interrupted[0]?.task?.status?.state, "TASK_STATE_SUBMITTED");
      assertEquals(
        interrupted[1]?.statusUpdate?.status?.state,
        "TASK_STATE_WORKING",
      );

      const recovered = [];
      for await (
        const event of client.subscribeToTask({ id: A2A_FIXTURE_TASK_ID }, {
          signal: AbortSignal.timeout(2_000),
          serviceParameters: authenticatedHeaders(),
        })
      ) recovered.push(event);
      assertEquals(recovered.length, 2);
      assertEquals(recovered[0]?.artifactUpdate?.artifact?.artifactId, "artifact-1");
      assertEquals(
        recovered[1]?.statusUpdate?.status?.state,
        "TASK_STATE_COMPLETED",
      );

      const polled = await client.getTask({ id: A2A_FIXTURE_TASK_ID }, {
        signal: AbortSignal.timeout(2_000),
        serviceParameters: authenticatedHeaders(),
      });
      assertEquals(polled.status?.state, "TASK_STATE_COMPLETED");
    }
  } finally {
    await fixture.close();
  }
});

Deno.test("A2A fixture proves malformed, unsupported, oversized, and timed failures", async () => {
  const fixture = startA2AFixtureServer();
  const factory = createA2AClientFactory({
    fetch,
    preferredTransports: ["JSONRPC", "HTTP+JSON"],
    limits: FAST_FAILURE_LIMITS,
  });
  try {
    const malformed = await assertRejects(
      () =>
        factory.resolve(
          new URL(`${fixture.cardOrigin}${AGENT_CARD_VARIANTS.malformed}`),
          AbortSignal.timeout(2_000),
        ),
      A2AClientError,
    );
    assertEquals(malformed.code, "invalid-response");

    const grpcCard = await factory.resolve(
      new URL(`${fixture.cardOrigin}${AGENT_CARD_VARIANTS.grpcOnly}`),
      AbortSignal.timeout(2_000),
    );
    const grpcError = assertRejectsAsync(() => factory.select(grpcCard));
    assertEquals((await grpcError).code, "invalid-response");

    const oversizedCard = await assertRejects(
      () =>
        factory.resolve(
          new URL(`${fixture.cardOrigin}${AGENT_CARD_VARIANTS.oversized}`),
          AbortSignal.timeout(2_000),
        ),
      A2AClientError,
    );
    assertEquals(oversizedCard.code, "response-too-large");

    for (
      const [path, maxBytes] of [
        ["/limits/metadata", A2A_REMOTE_INPUT_LIMITS.metadataBytes],
        ["/limits/jwk-set", A2A_REMOTE_INPUT_LIMITS.keySetBytes],
      ] as const
    ) {
      const error = await assertRejects(
        () => readFixtureJson(fixture.interfaceOrigin + path, maxBytes),
        A2AClientError,
      );
      assertEquals(error.code, "response-too-large");
    }

    await assertClientFailure(
      fixture.interfaceOrigin,
      "/limits/declared-json",
      "response-too-large",
    );
    await assertClientFailure(
      fixture.interfaceOrigin,
      "/limits/chunked-json",
      "response-too-large",
    );
    await assertClientFailure(
      fixture.interfaceOrigin,
      "/limits/delayed-headers",
      "timeout",
      "request",
    );
    await assertStreamFailure(fixture.interfaceOrigin, "/limits/delayed-first-byte", "first-byte");
    await assertStreamFailure(fixture.interfaceOrigin, "/limits/idle-sse", "stream-idle");
    await assertStreamFailure(
      fixture.interfaceOrigin,
      "/limits/oversized-sse",
      undefined,
      "response-too-large",
    );
  } finally {
    await fixture.close();
  }
});

Deno.test("visible Chromium page requests both origins and recovers after close", async () => {
  const fixture = startA2AFixtureServer();
  const extension = await launchExtension();
  try {
    const originPatterns = [`${fixture.cardOrigin}/*`, `${fixture.interfaceOrigin}/*`];
    for (const [index, originPattern] of originPatterns.entries()) {
      const promptPage = await openExtensionPage(
        extension.context,
        extension.extensionId,
        "options/options.html",
      );
      await promptPage.evaluate(({ index, originPattern }) => {
        const button = document.createElement("button");
        button.id = `a2a-origin-${index}`;
        button.textContent = "Grant agent origin";
        document.body.append(button);
        button.addEventListener("click", async () => {
          const permissionOutcome = await Promise.race([
            chrome.permissions.request({ origins: [originPattern] }).then(String),
            new Promise<string>((resolve) => setTimeout(() => resolve("prompted"), 250)),
          ]);
          document.documentElement.dataset.permissionOutcome = permissionOutcome;
        });
      }, { index, originPattern });
      await promptPage.click(`#a2a-origin-${index}`);
      await promptPage.waitForFunction(
        () => document.documentElement.dataset.permissionOutcome !== undefined,
      );
      assertEquals(
        await promptPage.getAttribute("html", "data-permission-outcome"),
        "prompted",
      );
      await promptPage.close();
    }

    const page = await openExtensionPage(
      extension.context,
      extension.extensionId,
      "options/options.html",
    );
    await page.evaluate(({ cardUrl, limits, token }) => {
      const interfaceButton = document.createElement("button");
      interfaceButton.id = "a2a-proof";
      interfaceButton.textContent = "Connect to agent";
      document.body.append(interfaceButton);
      interfaceButton.addEventListener("click", async () => {
        try {
          const moduleUrl = chrome.runtime.getURL("shared/a2a/client.js");
          const clientModule = await import(moduleUrl);
          const factory = clientModule.createA2AClientFactory({
            fetch: globalThis.fetch.bind(globalThis),
            preferredTransports: ["JSONRPC"],
            limits,
          });
          const card = await factory.resolve(new URL(cardUrl), AbortSignal.timeout(2_000));
          const client = factory.create(factory.select(card));
          await chrome.storage.session.set({ a2aProofToken: token });
          const events = [];
          for await (
            const event of client.sendMessageStream(
              {
                message: {
                  messageId: "browser-message",
                  role: "ROLE_USER",
                  parts: [{ text: "browser proof" }],
                },
              },
              {
                signal: AbortSignal.timeout(2_000),
                serviceParameters: {
                  Authorization: `Bearer ${token}`,
                  "X-Fixture-Disconnect": "after-status",
                },
              },
            )
          ) events.push(event);
          document.documentElement.dataset.a2aProof = JSON.stringify({
            eventCount: events.length,
          });
        } catch (error) {
          document.documentElement.dataset.a2aProof = JSON.stringify({ error: String(error) });
        }
      });
    }, {
      cardUrl: fixture.cardUrl,
      limits: A2A_PROOF_LIMITS,
      token: A2A_FIXTURE_TOKEN,
    });
    await page.click("#a2a-proof");
    await page.waitForFunction(() => document.documentElement.dataset.a2aProof !== undefined);
    const firstResult = JSON.parse(
      await page.getAttribute("html", "data-a2a-proof") ?? "{}",
    ) as Record<string, unknown>;
    assertEquals(firstResult.error, undefined);
    assertEquals(firstResult.eventCount, 2);
    await page.close();

    const recoveryPage = await openExtensionPage(
      extension.context,
      extension.extensionId,
      "options/options.html",
    );
    const recovery = await recoveryPage.evaluate(async ({ cardUrl, limits, taskId }) => {
      const stored = await chrome.storage.session.get("a2aProofToken");
      const token = stored.a2aProofToken;
      if (typeof token !== "string") throw new Error("session credential missing");
      const clientModule = await import(chrome.runtime.getURL("shared/a2a/client.js"));
      const factory = clientModule.createA2AClientFactory({
        fetch: globalThis.fetch.bind(globalThis),
        preferredTransports: ["JSONRPC"],
        limits,
      });
      const card = await factory.resolve(new URL(cardUrl), AbortSignal.timeout(2_000));
      const client = factory.create(factory.select(card));
      const events = [];
      for await (
        const event of client.subscribeToTask({ id: taskId }, {
          signal: AbortSignal.timeout(2_000),
          serviceParameters: { Authorization: `Bearer ${token}` },
        })
      ) events.push(event);
      const task = await client.getTask({ id: taskId }, {
        signal: AbortSignal.timeout(2_000),
        serviceParameters: { Authorization: `Bearer ${token}` },
      });
      await chrome.storage.session.clear();
      const afterRestart = await chrome.storage.session.get("a2aProofToken");
      return {
        eventCount: events.length,
        terminal: task.status?.state,
        tokenAfterRestart: afterRestart.a2aProofToken,
      };
    }, { cardUrl: fixture.cardUrl, limits: A2A_PROOF_LIMITS, taskId: A2A_FIXTURE_TASK_ID });
    assertEquals(recovery.eventCount, 2);
    assertEquals(recovery.terminal, "TASK_STATE_COMPLETED");
    assertEquals(recovery.tokenAfterRestart, undefined);
  } finally {
    await extension.context.close();
    await fixture.close();
  }
});

function assertRejectsAsync(operation: () => unknown): Promise<A2AClientError> {
  return Promise.resolve().then(operation).then(
    () => {
      throw new Error("operation unexpectedly succeeded");
    },
    (error: unknown) => {
      if (!(error instanceof A2AClientError)) throw error;
      return error;
    },
  );
}

async function readFixtureJson(url: string, maxBytes: number): Promise<unknown> {
  return await readBoundedJson(
    fetch,
    new Request(url, {
      headers: authenticatedHeaders(),
    }),
    {
      signal: AbortSignal.timeout(2_000),
      maxBytes,
      requestMs: FAST_FAILURE_LIMITS.requestMs,
      firstByteMs: FAST_FAILURE_LIMITS.firstByteMs,
      streamIdleMs: FAST_FAILURE_LIMITS.streamIdleMs,
    },
  );
}

async function assertClientFailure(
  interfaceOrigin: string,
  path: string,
  code: A2AClientError["code"],
  timeout?: A2AClientError["timeout"],
): Promise<void> {
  const error = await invokeRedirected(interfaceOrigin + path, "HTTP+JSON", false);
  assertEquals(error.code, code);
  assertEquals(error.timeout, timeout);
}

async function assertStreamFailure(
  interfaceOrigin: string,
  path: string,
  timeout?: A2AClientError["timeout"],
  code: A2AClientError["code"] = "timeout",
): Promise<void> {
  const error = await invokeRedirected(interfaceOrigin + path, "HTTP+JSON", true);
  assertEquals(error.code, code);
  assertEquals(error.timeout, timeout);
}

async function invokeRedirected(
  url: string,
  transport: A2ATransportBinding,
  streaming: boolean,
): Promise<A2AClientError> {
  const redirectedFetch: typeof fetch = async (input, init) => {
    const original = input instanceof Request ? input : new Request(input, init);
    const body = original.method === "GET" ? undefined : await original.arrayBuffer();
    return fetch(
      new Request(url, {
        method: original.method,
        headers: authenticatedHeaders(),
        ...(body === undefined ? {} : { body }),
        ...(init?.signal === undefined || init.signal === null ? {} : { signal: init.signal }),
      }),
    );
  };
  const factory = createA2AClientFactory({
    fetch: redirectedFetch,
    preferredTransports: [transport],
    limits: FAST_FAILURE_LIMITS,
  });
  const client = factory.create({
    url: new URL(url),
    transport,
    protocolVersion: "1.0",
  });
  return await assertRejectsAsync(async () => {
    if (!streaming) {
      await client.sendMessage(MESSAGE, {
        signal: AbortSignal.timeout(2_000),
        serviceParameters: authenticatedHeaders(),
      });
      return;
    }
    for await (
      const _event of client.sendMessageStream(MESSAGE, {
        signal: AbortSignal.timeout(2_000),
        serviceParameters: authenticatedHeaders(),
      })
    ) {
      // Consume until the fixture proves its limit or timeout boundary.
    }
  });
}
