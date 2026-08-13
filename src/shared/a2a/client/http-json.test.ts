/// <reference lib="dom" />

import { assertEquals, assertRejects } from "@std/assert";
import type { A2AClientLimits, A2AClientTarget } from "./contracts.ts";
import { A2AClientError } from "./errors.ts";
import { createHttpJsonClient } from "./http-json.ts";
import type { SendMessageRequest } from "./protocol.generated.ts";

const TARGET: A2AClientTarget = {
  url: new URL("https://agent.example/a2a/"),
  transport: "HTTP+JSON",
  protocolVersion: "1.0",
  tenant: "tenant-1",
};

const LIMITS: A2AClientLimits = {
  cardBytes: 2_048,
  jsonBytes: 2_048,
  sseFrameBytes: 2_048,
  requestMs: 50,
  firstByteMs: 50,
  streamIdleMs: 50,
};

const SEND_REQUEST: SendMessageRequest = {
  message: {
    messageId: "message-1",
    role: "ROLE_USER",
    parts: [
      { text: "hello", mediaType: "text/plain" },
      { raw: "iVBORw0KGgo=", mediaType: "image/png" },
    ],
  },
};

const TASK = {
  id: "task-1",
  contextId: "context-1",
  status: { state: "TASK_STATE_COMPLETED" },
};

Deno.test("HTTP+JSON client maps and validates all four portable operations", async () => {
  const requests: Request[] = [];
  const bodies: unknown[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request);
    assertEquals(request.headers.get("Authorization"), "Bearer token");
    assertEquals(request.headers.get("A2A-Version"), "1.0");
    if (request.method === "POST" && !request.url.endsWith(":subscribe")) {
      bodies.push(await request.json());
    }
    if (request.url.includes("message:stream") || request.url.endsWith(":subscribe")) {
      return new Response(`data: ${JSON.stringify({ task: TASK })}\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    return Response.json(request.url.includes("message:send") ? { task: TASK } : TASK);
  };
  const client = createHttpJsonClient(fetchImpl, TARGET, LIMITS);
  const requestOptions = {
    signal: new AbortController().signal,
    serviceParameters: { Authorization: "Bearer token" },
  };

  assertEquals(await client.sendMessage(SEND_REQUEST, requestOptions), { task: TASK });
  assertEquals(await collect(client.sendMessageStream(SEND_REQUEST, requestOptions)), [
    { task: TASK },
  ]);
  assertEquals(await client.getTask({ id: "task-1", historyLength: 0 }, requestOptions), TASK);
  assertEquals(await collect(client.subscribeToTask({ id: "task-1" }, requestOptions)), [
    { task: TASK },
  ]);

  assertEquals(requests.map((request) => `${request.method} ${request.url}`), [
    "POST https://agent.example/a2a/tenant-1/message:send",
    "POST https://agent.example/a2a/tenant-1/message:stream",
    "GET https://agent.example/a2a/tenant-1/tasks/task-1?historyLength=0",
    "POST https://agent.example/a2a/tenant-1/tasks/task-1:subscribe",
  ]);
  assertEquals((bodies[0] as Record<string, unknown>).tenant, "tenant-1");
  assertEquals((bodies[0] as Record<string, unknown>).message, SEND_REQUEST.message);
});

Deno.test("HTTP+JSON client encodes request-level tenant and task identifiers", async () => {
  let observedUrl = "";
  const client = createHttpJsonClient(
    (input) => {
      observedUrl = String(input instanceof Request ? input.url : input);
      return Promise.resolve(Response.json(TASK));
    },
    TARGET,
    LIMITS,
  );

  await client.getTask(
    { id: "task/with spaces", tenant: "tenant/override", history_length: 2 },
    { signal: new AbortController().signal },
  );

  assertEquals(
    observedUrl,
    "https://agent.example/a2a/tenant%2Foverride/tasks/task%2Fwith%20spaces?historyLength=2",
  );
});

Deno.test("HTTP+JSON client rejects a schema-invalid response", async () => {
  const client = createHttpJsonClient(
    () => Promise.resolve(Response.json({ id: 42 })),
    TARGET,
    LIMITS,
  );

  const error = await assertRejects(
    () => client.getTask({ id: "task-1" }, { signal: new AbortController().signal }),
    A2AClientError,
  );

  assertEquals(error.code, "invalid-response");
  assertEquals(error.transport, "HTTP+JSON");
});

Deno.test("HTTP+JSON client preserves bounded protocol and HTTP error metadata", async () => {
  const client = createHttpJsonClient(
    () =>
      Promise.resolve(Response.json({
        error: { code: 400, status: "FAILED_PRECONDITION", message: "secret detail" },
      }, { status: 400 })),
    TARGET,
    LIMITS,
  );

  const error = await assertRejects(
    () => client.getTask({ id: "task-1" }, { signal: new AbortController().signal }),
    A2AClientError,
  );

  assertEquals(error.code, "protocol-error");
  assertEquals(error.protocolCode, 400);
  assertEquals(error.status, 400);
  assertEquals(error.message.includes("secret detail"), false);
});

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const event of events) {
    values.push(event);
  }
  return values;
}
