import { assertEquals, assertThrows } from "@std/assert";
import { normalizeVisualManifestVersion, supportsBaselineUpdates } from "./run.ts";

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

Deno.test("visual manifest normalization fixes the version and preserves package metadata", () => {
  const normalized = JSON.parse(
    normalizeVisualManifestVersion(
      JSON.stringify({ manifest_version: 3, name: "Point and Shoot", version: "2026.801.0" }),
    ),
  );

  assertEquals(normalized, {
    manifest_version: 3,
    name: "Point and Shoot",
    version: "0.1.0",
  });
});

Deno.test("visual manifest normalization rejects a missing packaged version", () => {
  assertThrows(
    () => normalizeVisualManifestVersion(JSON.stringify({ manifest_version: 3 })),
    Error,
    "visual manifest must contain a string version",
  );
});

Deno.test("visual manifest normalization is stable for the fixture version", () => {
  const first = normalizeVisualManifestVersion(
    JSON.stringify({ manifest_version: 3, version: "0.1.0" }),
  );

  assertEquals(normalizeVisualManifestVersion(first), first);
});
