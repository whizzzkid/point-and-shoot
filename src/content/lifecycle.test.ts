import { assertEquals, assertThrows } from "@std/assert";
import { createOverlayLifecycle } from "./lifecycle.ts";

Deno.test("overlay lifecycle - toggles between one mount and a clean teardown", () => {
  let mounts = 0;
  let teardowns = 0;
  const lifecycle = createOverlayLifecycle(() => {
    mounts += 1;
    return () => {
      teardowns += 1;
    };
  });

  assertEquals(lifecycle.isMounted(), false);
  assertEquals(lifecycle.toggle(), true);
  assertEquals(lifecycle.isMounted(), true);
  assertEquals(lifecycle.toggle(), false);
  assertEquals(lifecycle.isMounted(), false);
  assertEquals(lifecycle.toggle(), true);
  assertEquals({ mounts, teardowns }, { mounts: 2, teardowns: 1 });
});

Deno.test("overlay lifecycle - a failed mount remains retryable", () => {
  let shouldFail = true;
  const lifecycle = createOverlayLifecycle(() => {
    if (shouldFail) throw new Error("mount failed");
    return () => {};
  });

  assertThrows(() => lifecycle.toggle(), Error, "mount failed");
  assertEquals(lifecycle.isMounted(), false);
  shouldFail = false;
  assertEquals(lifecycle.toggle(), true);
});

Deno.test("overlay lifecycle - destroy is safe before and after teardown", () => {
  let teardowns = 0;
  const lifecycle = createOverlayLifecycle(() => () => {
    teardowns += 1;
  });

  lifecycle.destroy();
  lifecycle.toggle();
  lifecycle.destroy();
  lifecycle.destroy();

  assertEquals(lifecycle.isMounted(), false);
  assertEquals(teardowns, 1);
});
