/// <reference lib="dom" />

import { assertEquals, assertRejects } from "@std/assert";
import { A2AClientError } from "./errors.ts";
import { parseSseJson } from "./sse.ts";

function response(body: string | ReadableStream<Uint8Array>, headers?: HeadersInit): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", ...headers },
  });
}

function options(frameBytes: number) {
  return {
    signal: new AbortController().signal,
    maxBytes: frameBytes,
    requestMs: 50,
    firstByteMs: 50,
    streamIdleMs: 50,
  };
}

Deno.test("parseSseJson incrementally parses comments, CRLF, and multiple data lines", async () => {
  const source = new TextEncoder().encode(
    ': keepalive\r\ndata: {"task":\r\ndata: {"id":"task-1"}}\r\n\r\n' +
      'event: message\ndata: {"statusUpdate":{"taskId":"task-1"}}\n\n',
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < source.byteLength; offset += 3) {
        controller.enqueue(source.slice(offset, offset + 3));
      }
      controller.close();
    },
  });

  const events = [];
  for await (
    const event of parseSseJson(
      () => Promise.resolve(response(body)),
      new Request("https://agent.example/a2a"),
      options(64),
    )
  ) {
    events.push(event);
  }

  assertEquals(events, [
    { task: { id: "task-1" } },
    { statusUpdate: { taskId: "task-1" } },
  ]);
});

Deno.test("parseSseJson accepts a frame exactly at the byte limit", async () => {
  const frame = 'data: {"message":{"messageId":"m1"}}\n\n';
  const events = [];
  for await (
    const event of parseSseJson(
      () => Promise.resolve(response(frame)),
      new Request("https://agent.example/a2a"),
      options(new TextEncoder().encode(frame).byteLength),
    )
  ) {
    events.push(event);
  }

  assertEquals(events, [{ message: { messageId: "m1" } }]);
});

Deno.test("parseSseJson rejects a frame one byte over before parsing it", async () => {
  const frame = 'data: {"message":{"messageId":"m1"}}\n\n';
  const error = await assertRejects(
    async () => {
      for await (
        const _event of parseSseJson(
          () => Promise.resolve(response(frame)),
          new Request("https://agent.example/a2a"),
          options(new TextEncoder().encode(frame).byteLength - 1),
        )
      ) {
        // The oversized frame must fail before yielding.
      }
    },
    A2AClientError,
  );

  assertEquals(error.code, "response-too-large");
});

Deno.test("parseSseJson rejects malformed event JSON without exposing it", async () => {
  const error = await assertRejects(
    async () => {
      for await (
        const _event of parseSseJson(
          () => Promise.resolve(response("data: {secret-token\n\n")),
          new Request("https://agent.example/a2a"),
          options(64),
        )
      ) {
        // Malformed data must fail before yielding.
      }
    },
    A2AClientError,
  );

  assertEquals(error.code, "invalid-response");
  assertEquals(error.message.includes("secret-token"), false);
});

Deno.test("parseSseJson rejects a non-SSE content type", async () => {
  const error = await assertRejects(
    async () => {
      for await (
        const _event of parseSseJson(
          () =>
            Promise.resolve(
              new Response("{}", {
                headers: { "Content-Type": "application/json" },
              }),
            ),
          new Request("https://agent.example/a2a"),
          options(64),
        )
      ) {
        // The content type must be checked before reading.
      }
    },
    A2AClientError,
  );

  assertEquals(error.code, "invalid-response");
});
