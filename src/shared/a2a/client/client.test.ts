/// <reference lib="dom" />

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { createA2AClientFactory } from "./client.ts";
import type { A2AClientFactoryOptions, A2AClientTarget } from "./contracts.ts";
import { A2AClientError } from "./errors.ts";

const CARD = {
  name: "Fixture agent",
  version: "1.0.0",
  supportedInterfaces: [
    {
      url: "https://agent.example/rpc",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    },
    {
      url: "https://agent.example/http",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    },
  ],
};

function options(fetchImpl: typeof fetch): A2AClientFactoryOptions {
  return {
    fetch: fetchImpl,
    preferredTransports: ["HTTP+JSON", "JSONRPC"],
    limits: {
      cardBytes: 2_048,
      jsonBytes: 4_096,
      sseFrameBytes: 1_024,
      requestMs: 100,
      firstByteMs: 50,
      streamIdleMs: 50,
    },
  };
}

Deno.test("factory resolves a bounded card with injected fetch and selects without I/O", async () => {
  let fetches = 0;
  const factory = createA2AClientFactory(options((input) => {
    fetches += 1;
    const request = input instanceof Request ? input : new Request(input);
    assertEquals(request.url, "https://cards.example/.well-known/agent-card.json");
    assertEquals(request.headers.get("A2A-Version"), "1.0");
    assertEquals(request.headers.get("Accept"), "application/json");
    return Promise.resolve(Response.json(CARD));
  }));

  const card = await factory.resolve(
    new URL("https://cards.example/.well-known/agent-card.json"),
    new AbortController().signal,
  );
  const target = factory.select(card);
  const client = factory.create(target);

  assertEquals(fetches, 1);
  assertEquals(target.transport, "HTTP+JSON");
  assertEquals(client.target, target);
  assertEquals(fetches, 1);
});

Deno.test("factory resolve rejects a malformed or oversized card", async () => {
  const malformedFactory = createA2AClientFactory(
    options(() => Promise.resolve(Response.json({ name: 42 }))),
  );
  const malformed = await assertRejects(
    () =>
      malformedFactory.resolve(
        new URL("https://cards.example/card.json"),
        new AbortController().signal,
      ),
    A2AClientError,
  );
  assertEquals(malformed.code, "invalid-response");

  const oversizedFactory = createA2AClientFactory({
    ...options(() => Promise.resolve(Response.json(CARD))),
    limits: { ...options(fetch).limits, cardBytes: 1 },
  });
  const oversized = await assertRejects(
    () =>
      oversizedFactory.resolve(
        new URL("https://cards.example/card.json"),
        new AbortController().signal,
      ),
    A2AClientError,
  );
  assertEquals(oversized.code, "response-too-large");
});

Deno.test("factory validates construction options and selected targets", () => {
  assertThrows(
    () => createA2AClientFactory({ ...options(fetch), preferredTransports: [] }),
    A2AClientError,
    "preferred transport",
  );
  assertThrows(
    () =>
      createA2AClientFactory({
        ...options(fetch),
        limits: { ...options(fetch).limits, jsonBytes: 0 },
      }),
    A2AClientError,
    "jsonBytes",
  );

  const factory = createA2AClientFactory(options(fetch));
  assertThrows(
    () =>
      factory.create({
        url: new URL("https://agent.example/a2a"),
        transport: "JSONRPC",
        protocolVersion: "0.3",
      } as unknown as A2AClientTarget),
    A2AClientError,
    "v1",
  );
});
