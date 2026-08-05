import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import { build } from "./build.ts";
import { manifestBase } from "./manifest.ts";
import {
  assertReviewerSourceClean,
  compareArchiveContents,
  createReviewerArtifacts,
  type ReviewerSourceOptions,
  validateReviewerArtifacts,
} from "./reviewer-source.ts";

const REQUIRED_ROOT_FILES = [
  ".release-please-manifest.json",
  "deno.json",
  "deno.lock",
  "LICENSE",
  "mise.toml",
  "version.txt",
] as const;

async function writeFixture(root: URL): Promise<string[]> {
  const trackedFiles = [
    ...REQUIRED_ROOT_FILES,
    "build/build.ts",
    "build/icons.ts",
    "build/manifest.ts",
    "build/preact.ts",
    "build/reviewer-source.ts",
    "src/background/index.ts",
    ".env",
    "dist/firefox.zip",
    "node_modules/cache.js",
  ];
  for (const path of trackedFiles) {
    const file = new URL(path, root);
    await Deno.mkdir(new URL("./", file), { recursive: true });
    await Deno.writeTextFile(file, `${path}\n`);
  }
  return trackedFiles;
}

async function withFixture(
  run: (root: URL, outDir: URL, trackedFiles: string[]) => Promise<void>,
): Promise<void> {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("source/", `${toFileUrl(temporaryDirectory).href}/`);
  const outDir = new URL("artifacts/", `${toFileUrl(temporaryDirectory).href}/`);
  try {
    await Deno.mkdir(root, { recursive: true });
    await run(root, outDir, await writeFixture(root));
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
}

function options(
  root: URL,
  outDir: URL,
  trackedFiles: readonly string[],
): ReviewerSourceOptions {
  return {
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    outDir,
    root,
    trackedFiles,
    version: "2026.805.0",
  };
}

Deno.test("reviewer source artifacts are deterministic and exclude non-build paths", async () => {
  await withFixture(async (root, outDir, trackedFiles) => {
    const first = await createReviewerArtifacts(options(root, outDir, trackedFiles));
    const firstBytes = await Deno.readFile(first.sourceArchivePath);
    const firstInstructions = await Deno.readTextFile(first.instructionsPath);

    const second = await createReviewerArtifacts(options(root, outDir, trackedFiles));
    const secondBytes = await Deno.readFile(second.sourceArchivePath);
    assertEquals(firstBytes, secondBytes);

    const listing = new TextDecoder().decode(
      (await new Deno.Command("unzip", {
        args: ["-Z1", second.sourceArchivePath],
        stdout: "piped",
      }).output()).stdout,
    ).trim().split("\n");
    assertEquals(listing, [
      ".point-and-shoot-review-source.json",
      ".release-please-manifest.json",
      "LICENSE",
      "build/build.ts",
      "build/icons.ts",
      "build/manifest.ts",
      "build/preact.ts",
      "build/reviewer-source.ts",
      "deno.json",
      "deno.lock",
      "mise.toml",
      "src/background/index.ts",
      "version.txt",
    ]);
    assertStringIncludes(firstInstructions, "Version: `2026.805.0`");
    assertStringIncludes(firstInstructions, "Commit: `0123456789abcdef0123456789abcdef01234567`");
    assertStringIncludes(firstInstructions, "mise exec -- deno task build:release");
    assertStringIncludes(firstInstructions, "mise exec -- deno task release:compare");
  });
});

Deno.test("reviewer source rejects missing required files, unsafe paths, and symlinks", async () => {
  await withFixture(async (root, outDir, trackedFiles) => {
    await assertRejects(
      () =>
        createReviewerArtifacts(
          options(root, outDir, trackedFiles.filter((path) => path !== "deno.lock")),
        ),
      Error,
      "required source file deno.lock",
    );
    await assertRejects(
      () => createReviewerArtifacts(options(root, outDir, [...trackedFiles, "../secret"])),
      Error,
      "unsafe tracked path ../secret",
    );

    await Deno.symlink(new URL("build/build.ts", root), new URL("build/link.ts", root));
    await assertRejects(
      () => createReviewerArtifacts(options(root, outDir, [...trackedFiles, "build/link.ts"])),
      Error,
      "symbolic link build/link.ts",
    );
  });
});

Deno.test("reviewer source rejects tracked build inputs that differ from HEAD", () => {
  assertReviewerSourceClean("");
  assertThrows(
    () => assertReviewerSourceClean(" M build/build.ts\0"),
    Error,
    "tracked build inputs differ from HEAD",
  );
});

Deno.test("archive comparison ignores ZIP metadata but rejects content drift", async () => {
  await withFixture(async (root, outDir, trackedFiles) => {
    const first = await createReviewerArtifacts(options(root, outDir, trackedFiles));
    const comparisonDirectory = new URL("comparison/", outDir);
    const second = await createReviewerArtifacts(
      options(root, comparisonDirectory, trackedFiles),
    );
    await compareArchiveContents(first.sourceArchivePath, second.sourceArchivePath);

    await Deno.writeTextFile(new URL("build/build.ts", root), "changed\n");
    const changed = await createReviewerArtifacts(
      options(root, new URL("changed/", outDir), trackedFiles),
    );
    await assertRejects(
      () => compareArchiveContents(first.sourceArchivePath, changed.sourceArchivePath),
      Error,
      "archive contents differ",
    );
  });
});

Deno.test("reviewer artifact validation binds source and instructions to version and commit", async () => {
  await withFixture(async (root, outDir, trackedFiles) => {
    const artifacts = await createReviewerArtifacts(options(root, outDir, trackedFiles));
    await validateReviewerArtifacts({
      expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
      expectedVersion: "2026.805.0",
      ...artifacts,
    });

    await assertRejects(
      () =>
        validateReviewerArtifacts({
          expectedCommitSha: "fedcba9876543210fedcba9876543210fedcba98",
          expectedVersion: "2026.805.0",
          ...artifacts,
        }),
      Error,
      "does not match expected commit",
    );
    await Deno.writeTextFile(artifacts.instructionsPath, "wrong instructions\n");
    await assertRejects(
      () =>
        validateReviewerArtifacts({
          expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
          expectedVersion: "2026.805.0",
          ...artifacts,
        }),
      Error,
      "build instructions do not match",
    );
  });
});

Deno.test("reviewer artifact validation rejects metadata that admits excluded paths", async () => {
  await withFixture(async (root, outDir, trackedFiles) => {
    const artifacts = await createReviewerArtifacts(options(root, outDir, trackedFiles));
    const mutationDirectory = new URL("mutation/", outDir);
    await Deno.mkdir(mutationDirectory, { recursive: true });
    const extraction = await new Deno.Command("unzip", {
      args: ["-q", artifacts.sourceArchivePath, "-d", mutationDirectory.pathname],
      stderr: "piped",
    }).output();
    assertEquals(extraction.success, true, new TextDecoder().decode(extraction.stderr));

    const metadataPath = new URL(".point-and-shoot-review-source.json", mutationDirectory);
    const metadata = JSON.parse(await Deno.readTextFile(metadataPath)) as {
      files: string[];
    };
    metadata.files.push(".env");
    metadata.files.sort();
    await Deno.writeTextFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    await Deno.writeTextFile(new URL(".env", mutationDirectory), "SECRET=not-a-secret\n");
    const mutation = await new Deno.Command("zip", {
      args: ["-q", artifacts.sourceArchivePath, ".point-and-shoot-review-source.json", ".env"],
      cwd: mutationDirectory,
      stderr: "piped",
    }).output();
    assertEquals(mutation.success, true, new TextDecoder().decode(mutation.stderr));

    await assertRejects(
      () =>
        validateReviewerArtifacts({
          expectedCommitSha: "0123456789abcdef0123456789abcdef01234567",
          expectedVersion: "2026.805.0",
          ...artifacts,
        }),
      Error,
      "contains excluded source path .env",
    );
  });
});

Deno.test("reviewer source reproduces the Firefox release in a clean directory", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const temporaryRoot = new URL(`${toFileUrl(temporaryDirectory).href}/`);
  const repositoryRoot = new URL("../", import.meta.url);
  try {
    const trackedOutput = await new Deno.Command("git", {
      args: ["ls-files", "-z"],
      cwd: repositoryRoot,
      stdout: "piped",
    }).output();
    assertEquals(trackedOutput.success, true);
    const trackedFiles = new TextDecoder().decode(trackedOutput.stdout).split("\0").filter(Boolean);
    const artifacts = await createReviewerArtifacts({
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      outDir: new URL("artifacts/", temporaryRoot),
      root: repositoryRoot,
      trackedFiles,
      version: manifestBase.version,
    });
    const originalOutput = new URL("original/", temporaryRoot);
    await build({ outDir: originalOutput, release: true });

    const cleanRoot = new URL("clean/", temporaryRoot);
    await Deno.mkdir(cleanRoot, { recursive: true });
    const extraction = await new Deno.Command("unzip", {
      args: ["-q", artifacts.sourceArchivePath, "-d", cleanRoot.pathname],
      stderr: "piped",
    }).output();
    assertEquals(extraction.success, true, new TextDecoder().decode(extraction.stderr));
    const rebuild = await new Deno.Command(Deno.execPath(), {
      args: ["task", "build:release"],
      cwd: cleanRoot,
      stderr: "piped",
      stdout: "piped",
    }).output();
    assertEquals(
      rebuild.success,
      true,
      new TextDecoder().decode(rebuild.stderr) + new TextDecoder().decode(rebuild.stdout),
    );
    await compareArchiveContents(
      new URL("firefox.zip", originalOutput).pathname,
      new URL("dist/firefox.zip", cleanRoot).pathname,
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});
