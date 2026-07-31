import { assertEquals } from "@std/assert";
import { supportsBaselineUpdates } from "./run.ts";

Deno.test("visual baseline updates accept the documented Linux container", () => {
  assertEquals(
    supportsBaselineUpdates("linux", "x86_64", "ubuntu-24.04-playwright-1.62.0"),
    true,
  );
});

Deno.test("visual baseline updates reject other hosts and missing markers", () => {
  assertEquals(
    supportsBaselineUpdates("darwin", "x86_64", "ubuntu-24.04-playwright-1.62.0"),
    false,
  );
  assertEquals(
    supportsBaselineUpdates("linux", "aarch64", "ubuntu-24.04-playwright-1.62.0"),
    false,
  );
  assertEquals(supportsBaselineUpdates("linux", "x86_64", undefined), false);
});
