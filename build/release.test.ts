import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import { build } from "./build.ts";
import { forChrome, forFirefox, manifestBase } from "./manifest.ts";
import {
  assertTagMatchesVersion,
  assertTagResolvesToCommit,
  assertVersionSources,
  nextCalver,
  type ReleaseTarget,
  runReleaseCommand,
  validateArchivePaths,
  validateReleaseArchive,
} from "./release.ts";

async function withArchive(
  mutatePackage: (root: URL) => Promise<void>,
  assertArchive: (archivePath: string) => Promise<void>,
): Promise<void> {
  await withTargetArchive("chrome", mutatePackage, assertArchive);
}

async function withTargetArchive(
  target: ReleaseTarget,
  mutatePackage: (root: URL) => Promise<void>,
  assertArchive: (archivePath: string) => Promise<void>,
): Promise<void> {
  const tempDir = await Deno.makeTempDir();
  const root = new URL("package/", `${toFileUrl(tempDir).href}/`);
  const archivePath = `${tempDir}/package.zip`;
  try {
    await Deno.mkdir(new URL("background/", root), { recursive: true });
    await Deno.writeTextFile(
      new URL("manifest.json", root),
      `${JSON.stringify(target === "chrome" ? forChrome() : forFirefox(), null, 2)}\n`,
    );
    await Deno.writeTextFile(new URL("background/background.js", root), "console.log('ready');");
    await mutatePackage(root);

    const zip = new Deno.Command("zip", {
      args: ["-r", "-X", archivePath, "."],
      cwd: new URL(".", root).pathname,
      stdout: "null",
      stderr: "piped",
    });
    const result = await zip.output();
    if (!result.success) {
      throw new Error(new TextDecoder().decode(result.stderr));
    }
    await assertArchive(archivePath);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

Deno.test("nextCalver - transitions the bootstrap SemVer to a UTC CalVer", () => {
  assertEquals(nextCalver("0.1.0", new Date("2026-07-31T23:59:59Z")), "2026.731.0");
});

Deno.test("nextCalver - increments the sequence for another release on the same UTC day", () => {
  assertEquals(nextCalver("2026.731.3", new Date("2026-07-31T00:00:00Z")), "2026.731.4");
});

Deno.test("nextCalver - resets the sequence when the UTC date advances", () => {
  assertEquals(nextCalver("2026.731.9", new Date("2026-08-01T00:00:00Z")), "2026.801.0");
});

Deno.test("nextCalver - rejects a non-bootstrap SemVer and invalid calendar date", () => {
  assertThrows(() => nextCalver("1.2.3", new Date("2026-07-31T00:00:00Z")));
  assertThrows(() => nextCalver("2026.231.0", new Date("2026-07-31T00:00:00Z")));
  assertThrows(() => nextCalver("2026.0731.0", new Date("2026-07-31T00:00:00Z")));
});

Deno.test("nextCalver - rejects a version later than the UTC release date", () => {
  assertThrows(() => nextCalver("2026.801.0", new Date("2026-07-31T00:00:00Z")));
});

Deno.test("nextCalver - rejects an invalid release instant", () => {
  assertThrows(() => nextCalver("0.1.0", new Date("invalid")));
});

Deno.test("assertTagMatchesVersion - accepts the matching release tag", () => {
  assertTagMatchesVersion("v2026.731.0", "2026.731.0");
});

Deno.test("assertTagMatchesVersion - rejects a missing prefix or version drift", () => {
  assertThrows(() => assertTagMatchesVersion("2026.731.0", "2026.731.0"));
  assertThrows(() => assertTagMatchesVersion("v2026.731.1", "2026.731.0"));
});

Deno.test("assertTagResolvesToCommit - rejects a same-version tag on another commit", () => {
  assertTagResolvesToCommit("v2026.731.0", "abc123", "abc123");
  assertThrows(
    () => assertTagResolvesToCommit("v2026.731.0", "def456", "abc123"),
    Error,
    "resolves to def456 instead of release commit abc123",
  );
});

Deno.test("assertVersionSources - accepts aligned release metadata", () => {
  assertVersionSources("2026.731.0", "2026.731.0", { ".": "2026.731.0" });
});

Deno.test("assertVersionSources - rejects release metadata drift", () => {
  assertThrows(() =>
    assertVersionSources("2026.731.0", "2026.731.1", {
      ".": "2026.731.0",
    })
  );
  assertThrows(() =>
    assertVersionSources("2026.731.0", "2026.731.0", {
      ".": "2026.731.1",
    })
  );
});

Deno.test("runReleaseCommand - prints the next version", async () => {
  assertEquals(
    await runReleaseCommand(
      ["next", "0.1.0"],
      { now: new Date("2026-07-31T12:00:00Z") },
    ),
    "2026.731.0",
  );
});

Deno.test("runReleaseCommand - prints the packaged manifest version", async () => {
  assertEquals(await runReleaseCommand(["current"]), manifestBase.version);
});

Deno.test("runReleaseCommand - rejects unsupported commands", async () => {
  await assertRejects(() => runReleaseCommand(["unknown"]));
});

Deno.test("runReleaseCommand - reports missing reviewer artifacts before inspecting them", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const distDir = new URL(`${toFileUrl(temporaryDirectory).href}/`);
  try {
    await build({ outDir: distDir, release: true });
    const options = {
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      distDir,
    };
    await assertRejects(
      () => runReleaseCommand(["validate"], options),
      Error,
      "missing reviewer artifact firefox-source.zip",
    );

    await Deno.writeTextFile(new URL("firefox-source.zip", distDir), "placeholder");
    await assertRejects(
      () => runReleaseCommand(["validate"], options),
      Error,
      "missing reviewer artifact firefox-build-instructions.md",
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});

Deno.test("validateArchivePaths - rejects sourcemaps", () => {
  assertThrows(() => validateArchivePaths(["manifest.json", "background/background.js.map"]));
});

Deno.test("validateArchivePaths - rejects path traversal", () => {
  assertThrows(() => validateArchivePaths(["manifest.json", "../outside.txt"]));
});

Deno.test("validateArchivePaths - rejects dist leakage", () => {
  assertThrows(() => validateArchivePaths(["dist/chrome/manifest.json"]));
});

Deno.test("validateReleaseArchive - reports a valid Chrome package and its size", async () => {
  await withArchive(
    async () => {},
    async (archivePath) => {
      const report = await validateReleaseArchive({
        archivePath,
        expectedVersion: manifestBase.version,
        target: "chrome",
      });
      assertEquals(report.target, "chrome");
      assertEquals(report.version, manifestBase.version);
      assert(report.sizeBytes > 0);
    },
  );
});

Deno.test("validateReleaseArchive - rejects manifest version drift", async () => {
  const mismatchedVersion = manifestBase.version === "0.1.0" ? "2026.731.0" : "0.1.0";
  await withArchive(
    async () => {},
    async (archivePath) => {
      await assertRejects(
        () =>
          validateReleaseArchive({
            archivePath,
            expectedVersion: mismatchedVersion,
            target: "chrome",
          }),
        Error,
        `does not match ${mismatchedVersion}`,
      );
    },
  );
});

Deno.test("validateReleaseArchive - rejects missing manifest keys", async () => {
  await withArchive(
    async (root) => {
      await Deno.writeTextFile(
        new URL("manifest.json", root),
        `${JSON.stringify({ manifest_version: 3, version: manifestBase.version })}\n`,
      );
    },
    async (archivePath) => {
      await assertRejects(
        () =>
          validateReleaseArchive({
            archivePath,
            expectedVersion: manifestBase.version,
            target: "chrome",
          }),
        Error,
        "manifest is missing required key action",
      );
    },
  );
});

Deno.test("validateReleaseArchive - rejects optional host eligibility drift", async () => {
  await withArchive(
    async (root) => {
      const manifestPath = new URL("manifest.json", root);
      const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
      manifest.optional_host_permissions = ["https://unexpected.example/*"];
      await Deno.writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
    async (archivePath) => {
      await assertRejects(
        () =>
          validateReleaseArchive({
            archivePath,
            expectedVersion: manifestBase.version,
            target: "chrome",
          }),
        Error,
        "optional host eligibility",
      );
    },
  );
});

Deno.test("validateReleaseArchive - rejects a target's non-canonical optional host key", async () => {
  await Promise.all(
    (["chrome", "firefox"] as const).map((target) =>
      withTargetArchive(
        target,
        async (root) => {
          const manifestPath = new URL("manifest.json", root);
          const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
          const nonCanonicalKey = target === "chrome"
            ? "optional_permissions"
            : "optional_host_permissions";
          manifest[nonCanonicalKey] = [];
          await Deno.writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        },
        async (archivePath) => {
          await assertRejects(
            () =>
              validateReleaseArchive({
                archivePath,
                expectedVersion: manifestBase.version,
                target,
              }),
            Error,
            "non-canonical optional host key",
          );
        },
      )
    ),
  );
});

Deno.test("validateReleaseArchive - rejects remote URLs in non-permission manifest fields", async () => {
  await withArchive(
    async (root) => {
      const manifestPath = new URL("manifest.json", root);
      const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
      manifest.homepage_url = "https://unexpected.example/remote";
      await Deno.writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
    async (archivePath) => {
      await assertRejects(
        () =>
          validateReleaseArchive({
            archivePath,
            expectedVersion: manifestBase.version,
            target: "chrome",
          }),
        Error,
        "archive contains forbidden remote URL",
      );
    },
  );
});

Deno.test("validateReleaseArchive - rejects remote URLs in an otherwise valid package", async () => {
  await withArchive(
    async (root) => {
      await Deno.writeTextFile(
        new URL("background/background.js", root),
        "fetch('https://example.invalid/payload.js');",
      );
    },
    async (archivePath) => {
      await assertRejects(
        () =>
          validateReleaseArchive({
            archivePath,
            expectedVersion: manifestBase.version,
            target: "chrome",
          }),
        Error,
        "archive contains forbidden remote URL",
      );
    },
  );
});
