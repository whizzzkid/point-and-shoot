import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  normalizeVisualManifestVersion,
  supportsBaselineUpdates,
  withNormalizedVisualManifestVersion,
} from "./run.ts";

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
  assertThrows(() => normalizeVisualManifestVersion("{"), SyntaxError);
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

Deno.test("visual manifest scope exposes the fixture version and restores the source", async () => {
  const temporaryRoot = await Deno.makeTempDir();
  const manifestPath = `${temporaryRoot}/manifest.json`;
  const originalManifest = '{"manifest_version":3,"version":"2026.801.0"}\n';
  try {
    await Deno.writeTextFile(manifestPath, originalManifest);

    const result = await withNormalizedVisualManifestVersion(manifestPath, async () => {
      const activeManifest = JSON.parse(await Deno.readTextFile(manifestPath));
      assertEquals(activeManifest.version, "0.1.0");
      return "captured";
    });

    assertEquals(result, "captured");
    assertEquals(await Deno.readTextFile(manifestPath), originalManifest);
  } finally {
    await Deno.remove(temporaryRoot, { recursive: true });
  }
});

Deno.test("visual manifest scope restores the source after capture failure", async () => {
  const temporaryRoot = await Deno.makeTempDir();
  const manifestPath = `${temporaryRoot}/manifest.json`;
  const originalManifest = '{"manifest_version":3,"version":"2026.801.0"}\n';
  try {
    await Deno.writeTextFile(manifestPath, originalManifest);

    await assertRejects(
      () =>
        withNormalizedVisualManifestVersion(
          manifestPath,
          () => Promise.reject(new Error("capture failed")),
        ),
      Error,
      "capture failed",
    );
    assertEquals(await Deno.readTextFile(manifestPath), originalManifest);
  } finally {
    await Deno.remove(temporaryRoot, { recursive: true });
  }
});
