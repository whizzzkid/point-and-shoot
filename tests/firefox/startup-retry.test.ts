import { assertEquals, assertRejects } from "@std/assert";
import { MarionettePortHandoffError, retryMarionettePortHandoff } from "./startup-retry.ts";

Deno.test("Firefox startup retries a Marionette port handoff with a new attempt", async () => {
  const attempts: number[] = [];
  const retries: number[] = [];

  const result = await retryMarionettePortHandoff(
    (attempt) => {
      attempts.push(attempt);
      if (attempt === 1) {
        return Promise.reject(new MarionettePortHandoffError("port was claimed"));
      }
      return Promise.resolve("connected");
    },
    3,
    (_error, nextAttempt) => retries.push(nextAttempt),
  );

  assertEquals(result, "connected");
  assertEquals(attempts, [1, 2]);
  assertEquals(retries, [2]);
});

Deno.test("Firefox startup does not retry a non-port failure", async () => {
  let attempts = 0;

  await assertRejects(
    () =>
      retryMarionettePortHandoff(() => {
        attempts++;
        return Promise.reject(new Error("event page failed to boot"));
      }, 3),
    Error,
    "event page failed to boot",
  );
  assertEquals(attempts, 1);
});

Deno.test("Firefox startup validates and exhausts its retry bound", async () => {
  await assertRejects(
    () => retryMarionettePortHandoff(() => Promise.resolve("unused"), 0),
    RangeError,
    "maximumAttempts must be a positive integer",
  );

  let attempts = 0;
  await assertRejects(
    () =>
      retryMarionettePortHandoff(() => {
        attempts++;
        return Promise.reject(new MarionettePortHandoffError("port was claimed"));
      }, 2),
    MarionettePortHandoffError,
    "port was claimed",
  );
  assertEquals(attempts, 2);
});
