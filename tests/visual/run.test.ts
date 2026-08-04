import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  normalizeVisualManifestVersions,
  supportsBaselineUpdates,
  withNormalizedVisualManifestVersions,
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

Deno.test("visual manifest normalization fixes mutable version metadata across branches", () => {
  const normalize = (versionName: string): unknown =>
    JSON.parse(
      normalizeVisualManifestVersions(
        JSON.stringify({
          manifest_version: 3,
          name: "Point and Shoot",
          version: "2026.801.0",
          version_name: versionName,
        }),
      ),
    );
  const expected = {
    manifest_version: 3,
    name: "Point and Shoot",
    version: "0.1.0",
    version_name: "0.1.0-dev-visual-fixture",
  };

  assertEquals(normalize("2026.801.0-dev-fix/calver-display"), expected);
  assertEquals(normalize("2026.801.0-dev-main"), expected);
});

Deno.test("visual manifest normalization rejects a missing packaged version", () => {
  assertThrows(() => normalizeVisualManifestVersions("{"), SyntaxError);
  assertThrows(
    () => normalizeVisualManifestVersions(JSON.stringify({ manifest_version: 3 })),
    Error,
    "visual manifest must contain a string version",
  );
});

Deno.test("visual manifest normalization is stable for the fixture version", () => {
  const first = normalizeVisualManifestVersions(
    JSON.stringify({ manifest_version: 3, version: "0.1.0" }),
  );

  assertEquals(normalizeVisualManifestVersions(first), first);
});

Deno.test("visual manifest scope exposes the fixture version and restores the source", async () => {
  const temporaryRoot = await Deno.makeTempDir();
  const manifestPath = `${temporaryRoot}/manifest.json`;
  const originalManifest = '{"manifest_version":3,"version":"2026.801.0"}\n';
  try {
    await Deno.writeTextFile(manifestPath, originalManifest);

    const result = await withNormalizedVisualManifestVersions(manifestPath, async () => {
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
        withNormalizedVisualManifestVersions(
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
