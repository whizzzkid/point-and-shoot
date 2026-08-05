/// <reference lib="dom" />

import { assertEquals, assertRejects } from "@std/assert";
import type { A2AClientLimits, A2AClientTarget } from "./contracts.ts";
import { A2AClientError } from "./errors.ts";
import { createJsonRpcClient } from "./json-rpc.ts";
import type { SendMessageRequest } from "./protocol.generated.ts";

const TARGET: A2AClientTarget = {
  url: new URL("https://agent.example/rpc"),
  transport: "JSONRPC",
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

Deno.test("JSON-RPC client maps and validates all four portable operations", async () => {
  const requests: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    const envelope = await request.json() as Record<string, unknown>;
    requests.push(envelope);
    assertEquals(request.url, TARGET.url.href);
    assertEquals(request.headers.get("Authorization"), "Bearer token");
    assertEquals(request.headers.get("A2A-Version"), "1.0");

    const result = envelope.method === "SendMessage"
      ? { task: TASK }
      : envelope.method === "GetTask"
      ? TASK
      : { task: TASK };
    if (envelope.method === "SendStreamingMessage" || envelope.method === "SubscribeToTask") {
      return new Response(
        `data: ${
          JSON.stringify({
            jsonrpc: "2.0",
            id: envelope.id,
            result,
          })
        }\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    return Response.json({ jsonrpc: "2.0", id: envelope.id, result });
  };
  const client = createJsonRpcClient(fetchImpl, TARGET, LIMITS);
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

  assertEquals(requests.map((request) => request.method), [
    "SendMessage",
    "SendStreamingMessage",
    "GetTask",
    "SubscribeToTask",
  ]);
  assertEquals((requests[0]?.params as Record<string, unknown>).tenant, "tenant-1");
  assertEquals((requests[0]?.params as Record<string, unknown>).message, SEND_REQUEST.message);
  assertEquals(requests.map((request) => request.id), [1, 2, 3, 4]);
});

Deno.test("JSON-RPC client rejects mismatched response IDs", async () => {
  const client = createJsonRpcClient(
    () => Promise.resolve(Response.json({ jsonrpc: "2.0", id: 999, result: { task: TASK } })),
    TARGET,
    LIMITS,
  );

  const error = await assertRejects(
    () =>
      client.sendMessage(SEND_REQUEST, {
        signal: new AbortController().signal,
      }),
    A2AClientError,
  );

  assertEquals(error.code, "invalid-response");
  assertEquals(error.transport, "JSONRPC");
});

Deno.test("JSON-RPC client preserves protocol error codes without remote text", async () => {
  const client = createJsonRpcClient(
    () =>
      Promise.resolve(Response.json({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32001, message: "secret server detail" },
      })),
    TARGET,
    LIMITS,
  );

  const error = await assertRejects(
    () =>
      client.sendMessage(SEND_REQUEST, {
        signal: new AbortController().signal,
      }),
    A2AClientError,
  );

  assertEquals(error.code, "protocol-error");
  assertEquals(error.protocolCode, -32001);
  assertEquals(error.message.includes("secret server detail"), false);
});

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const event of events) {
    values.push(event);
  }
  return values;
}
