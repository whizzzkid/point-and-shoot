import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  encodeMarionetteFrame,
  readMarionetteFrame,
  unwrapMarionetteResponse,
} from "./marionette.ts";

class ChunkedReader {
  readonly #chunks: Uint8Array[];

  constructor(chunks: Uint8Array[]) {
    this.#chunks = chunks;
  }

  read(buffer: Uint8Array): Promise<number | null> {
    const chunk = this.#chunks.shift();
    if (chunk === undefined) return Promise.resolve(null);
    const copied = Math.min(buffer.length, chunk.length);
    buffer.set(chunk.subarray(0, copied));
    if (copied < chunk.length) this.#chunks.unshift(chunk.subarray(copied));
    return Promise.resolve(copied);
  }
}

Deno.test("Marionette framing counts UTF-8 bytes and survives split reads", async () => {
  const encoded = encodeMarionetteFrame({ title: "Café" });
  const colon = encoded.indexOf(":".charCodeAt(0));
  const declaredLength = Number.parseInt(new TextDecoder().decode(encoded.subarray(0, colon)), 10);
  assertEquals(declaredLength, encoded.length - colon - 1);

  const reader = new ChunkedReader([
    encoded.subarray(0, 1),
    encoded.subarray(1, colon + 3),
    encoded.subarray(colon + 3),
  ]);
  assertEquals(await readMarionetteFrame(reader), { title: "Café" });
});

Deno.test("Marionette framing rejects a connection closed inside a payload", async () => {
  const encoded = encodeMarionetteFrame({ ready: true });
  await assertRejects(
    () => readMarionetteFrame(new ChunkedReader([encoded.subarray(0, encoded.length - 2)])),
    Error,
    "connection closed inside a frame",
  );
});

Deno.test("Marionette responses preserve success values and surface remote errors", () => {
  assertEquals(unwrapMarionetteResponse([1, 7, null, { value: "ready" }], 7), {
    value: "ready",
  });
  assertThrows(
    () =>
      unwrapMarionetteResponse([
        1,
        8,
        {
          error: "unsupported operation",
          message: "System access is required.",
          stacktrace: "remote stack",
        },
        null,
      ], 8),
    Error,
    "unsupported operation: System access is required.",
  );
});
