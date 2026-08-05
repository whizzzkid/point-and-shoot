/// <reference lib="dom" />

import { assertEquals, assertRejects } from "@std/assert";
import { A2AClientError } from "./errors.ts";
import { readBoundedJson } from "./response.ts";

const REQUEST = new Request("https://agent.example/a2a");

function limits(maxBytes = 64) {
  return {
    maxBytes,
    requestMs: 50,
    firstByteMs: 50,
    streamIdleMs: 50,
  };
}

Deno.test("readBoundedJson parses a chunked response exactly at the byte limit", async () => {
  const body = new TextEncoder().encode('{"ok":true}');
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(body.slice(0, 5));
        controller.enqueue(body.slice(5));
        controller.close();
      },
    }),
  );

  const result = await readBoundedJson(() => Promise.resolve(response), REQUEST, {
    signal: new AbortController().signal,
    ...limits(body.byteLength),
  });

  assertEquals(result, { ok: true });
});

Deno.test("readBoundedJson rejects an oversized declared response before pulling it", async () => {
  let pulls = 0;
  const response = new Response(
    new ReadableStream({
      pull() {
        pulls += 1;
      },
    }, { highWaterMark: 0 }),
    { headers: { "Content-Length": "65" } },
  );

  const error = await assertRejects(
    () =>
      readBoundedJson(() => Promise.resolve(response), REQUEST, {
        signal: new AbortController().signal,
        ...limits(64),
      }),
    A2AClientError,
  );

  assertEquals(error.code, "response-too-large");
  assertEquals(pulls, 0);
});

Deno.test("readBoundedJson aborts streamed bytes at the configured boundary", async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(64));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    }),
  );

  const error = await assertRejects(
    () =>
      readBoundedJson(() => Promise.resolve(response), REQUEST, {
        signal: new AbortController().signal,
        ...limits(64),
      }),
    A2AClientError,
  );

  assertEquals(error.code, "response-too-large");
});

Deno.test("readBoundedJson returns a typed malformed JSON error", async () => {
  const error = await assertRejects(
    () =>
      readBoundedJson(
        () => Promise.resolve(new Response("{")),
        REQUEST,
        { signal: new AbortController().signal, ...limits() },
      ),
    A2AClientError,
  );

  assertEquals(error.code, "invalid-response");
  assertEquals(error.retryable, false);
});

Deno.test("readBoundedJson preserves safe HTTP failure metadata without reading the body", async () => {
  let pulls = 0;
  const response = new Response(
    new ReadableStream({
      pull() {
        pulls += 1;
      },
    }, { highWaterMark: 0 }),
    { status: 503 },
  );

  const error = await assertRejects(
    () =>
      readBoundedJson(() => Promise.resolve(response), REQUEST, {
        signal: new AbortController().signal,
        ...limits(),
      }),
    A2AClientError,
  );

  assertEquals(error.code, "http-error");
  assertEquals(error.status, 503);
  assertEquals(error.retryable, true);
  assertEquals(pulls, 0);
});

Deno.test("readBoundedJson reports caller cancellation", async () => {
  const controller = new AbortController();
  controller.abort();

  const error = await assertRejects(
    () =>
      readBoundedJson(
        () => Promise.reject(controller.signal.reason),
        REQUEST,
        { signal: controller.signal, ...limits() },
      ),
    A2AClientError,
  );

  assertEquals(error.code, "aborted");
  assertEquals(error.retryable, false);
});

Deno.test("readBoundedJson interrupts a pending fetch when the caller cancels", async () => {
  const controller = new AbortController();
  const pending = readBoundedJson(
    () => new Promise<Response>(() => {}),
    REQUEST,
    { signal: controller.signal, ...limits(), requestMs: 1_000 },
  );
  queueMicrotask(() => controller.abort());

  const error = await assertRejects(() => pending, A2AClientError);

  assertEquals(error.code, "aborted");
});

Deno.test("readBoundedJson interrupts a pending body read when the caller cancels", async () => {
  const controller = new AbortController();
  const response = new Response(
    new ReadableStream({
      pull() {
        return new Promise<void>(() => {});
      },
    }),
  );
  const pending = readBoundedJson(
    () => Promise.resolve(response),
    REQUEST,
    { signal: controller.signal, ...limits(), firstByteMs: 1_000 },
  );
  setTimeout(() => controller.abort(), 5);

  const error = await assertRejects(() => pending, A2AClientError);

  assertEquals(error.code, "aborted");
});

Deno.test("readBoundedJson enforces the request timeout", async () => {
  const error = await assertRejects(
    () =>
      readBoundedJson(
        () => new Promise<Response>(() => {}),
        REQUEST,
        { signal: new AbortController().signal, ...limits(), requestMs: 5 },
      ),
    A2AClientError,
  );

  assertEquals(error.code, "timeout");
  assertEquals(error.timeout, "request");
  assertEquals(error.retryable, true);
});

Deno.test("readBoundedJson enforces the first-byte timeout", async () => {
  const response = new Response(
    new ReadableStream({
      pull() {
        return new Promise<void>(() => {});
      },
    }),
  );

  const error = await assertRejects(
    () =>
      readBoundedJson(() => Promise.resolve(response), REQUEST, {
        signal: new AbortController().signal,
        ...limits(),
        firstByteMs: 5,
      }),
    A2AClientError,
  );

  assertEquals(error.code, "timeout");
  assertEquals(error.timeout, "first-byte");
});

Deno.test("readBoundedJson enforces the stream-idle timeout", async () => {
  let read = false;
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        if (!read) {
          read = true;
          controller.enqueue(new TextEncoder().encode("{"));
          return;
        }
        return new Promise<void>(() => {});
      },
    }),
  );

  const error = await assertRejects(
    () =>
      readBoundedJson(() => Promise.resolve(response), REQUEST, {
        signal: new AbortController().signal,
        ...limits(),
        streamIdleMs: 5,
      }),
    A2AClientError,
  );

  assertEquals(error.code, "timeout");
  assertEquals(error.timeout, "stream-idle");
});
