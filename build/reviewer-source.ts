import { dirname, fromFileUrl, toFileUrl } from "@std/path";

import { manifestBase } from "./manifest.ts";

const REQUIRED_ROOT_FILES = [
  ".release-please-manifest.json",
  "deno.json",
  "deno.lock",
  "LICENSE",
  "mise.toml",
  "version.txt",
] as const;
const REQUIRED_BUILD_FILES = [
  "build/build.ts",
  "build/icons.ts",
  "build/manifest.ts",
  "build/preact.ts",
  "build/reviewer-source.ts",
] as const;
const INCLUDED_PREFIXES = ["build/", "src/"] as const;
const METADATA_FILE = ".point-and-shoot-review-source.json";
const SOURCE_ARCHIVE_FILE = "firefox-source.zip";
const INSTRUCTIONS_FILE = "firefox-build-instructions.md";
const FIXED_ARCHIVE_TIME = new Date("1980-01-01T00:00:00.000Z");

/** Inputs used to create the source and instruction artifacts supplied to Firefox reviewers. */
export interface ReviewerSourceOptions {
  readonly commitSha: string;
  readonly outDir: URL;
  readonly root: URL;
  readonly trackedFiles: readonly string[];
  readonly version: string;
}

/** Paths of the generated Firefox reviewer artifacts. */
export interface ReviewerArtifacts {
  readonly instructionsPath: string;
  readonly sourceArchivePath: string;
}

/** Expected identity and paths for validating the Firefox reviewer artifacts. */
export interface ValidateReviewerArtifactsOptions extends ReviewerArtifacts {
  readonly expectedCommitSha: string;
  readonly expectedVersion: string;
}

interface ReviewerSourceMetadata {
  readonly commitSha: string;
  readonly files: readonly string[];
  readonly schemaVersion: 1;
  readonly version: string;
}

function isSafeRelativePath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\")) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  return !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function isIncluded(path: string): boolean {
  return (REQUIRED_ROOT_FILES as readonly string[]).includes(path) ||
    INCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function selectSourceFiles(trackedFiles: readonly string[]): string[] {
  for (const path of trackedFiles) {
    if (!isSafeRelativePath(path)) {
      throw new Error(`reviewer source: unsafe tracked path ${path}`);
    }
  }

  const tracked = new Set(trackedFiles);
  for (const required of [...REQUIRED_ROOT_FILES, ...REQUIRED_BUILD_FILES]) {
    if (!tracked.has(required)) {
      throw new Error(`reviewer source: required source file ${required} is not tracked`);
    }
  }
  return trackedFiles.filter(isIncluded).toSorted();
}

/**
 * Rejects reviewer-source creation when tracked build inputs differ from the recorded commit.
 *
 * @param statusOutput NUL-delimited `git status --porcelain` output for the selected inputs.
 */
export function assertReviewerSourceClean(statusOutput: string): void {
  if (statusOutput !== "") {
    throw new Error("reviewer source: tracked build inputs differ from HEAD");
  }
}

async function removeIfExists(path: URL): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function runCommand(
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string } = {},
): Promise<Uint8Array> {
  const result = await new Deno.Command(command, {
    args: [...args],
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    env: { TZ: "UTC" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    const detail = new TextDecoder().decode(result.stderr).trim();
    throw new Error(
      `reviewer source: \`${command}\` exited with code ${result.code}${
        detail === "" ? "" : `: ${detail}`
      }`,
    );
  }
  return result.stdout;
}

async function copySourceFile(root: URL, staging: URL, path: string): Promise<void> {
  const source = new URL(path, root);
  const sourceInfo = await Deno.lstat(source);
  if (sourceInfo.isSymlink) {
    throw new Error(`reviewer source: refusing symbolic link ${path}`);
  }
  if (!sourceInfo.isFile) {
    throw new Error(`reviewer source: expected tracked file ${path}`);
  }

  const destination = new URL(path, staging);
  await Deno.mkdir(dirname(fromFileUrl(destination)), { recursive: true });
  await Deno.copyFile(source, destination);
  await Deno.chmod(destination, 0o644);
  await Deno.utime(destination, FIXED_ARCHIVE_TIME, FIXED_ARCHIVE_TIME);
}

function buildInstructions(version: string, commitSha: string): string {
  return `# Firefox reviewer build instructions

This source archive contains the tracked inputs needed to reproduce the Point and Shoot Firefox
release package. It intentionally excludes local files, dependencies, generated output, and files
that are not used by the extension build.

- Version: \`${version}\`
- Commit: \`${commitSha}\`

## Build

1. Extract \`${SOURCE_ARCHIVE_FILE}\` into an empty directory.
2. Install the exact tool versions recorded in \`mise.toml\`:

   \`\`\`bash
   mise install
   \`\`\`

3. Build both release packages from the included source:

   \`\`\`bash
   mise exec -- deno task build:release
   \`\`\`

4. Compare the rebuilt Firefox package with the submitted package. ZIP container metadata can
   differ, so this command compares the sorted entry paths and uncompressed bytes:

   \`\`\`bash
   mise exec -- deno task release:compare /path/to/submitted-firefox.zip dist/firefox.zip
   \`\`\`
`;
}

/**
 * Creates a deterministic source archive and standalone Firefox reviewer instructions.
 *
 * @param options Repository, output, version, commit, and tracked-file inputs.
 * @returns Paths to the generated artifacts.
 */
export async function createReviewerArtifacts(
  options: ReviewerSourceOptions,
): Promise<ReviewerArtifacts> {
  const files = selectSourceFiles(options.trackedFiles);
  const temporaryDirectory = await Deno.makeTempDir();
  const staging = new URL("staging/", `${toFileUrl(temporaryDirectory).href}/`);
  const sourceArchive = new URL(SOURCE_ARCHIVE_FILE, options.outDir);
  const instructions = new URL(INSTRUCTIONS_FILE, options.outDir);
  try {
    await Deno.mkdir(staging, { recursive: true });
    await Deno.mkdir(options.outDir, { recursive: true });
    for (const path of files) await copySourceFile(options.root, staging, path);

    const metadata: ReviewerSourceMetadata = {
      commitSha: options.commitSha,
      files,
      schemaVersion: 1,
      version: options.version,
    };
    const metadataPath = new URL(METADATA_FILE, staging);
    await Deno.writeTextFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    await Deno.chmod(metadataPath, 0o644);
    await Deno.utime(metadataPath, FIXED_ARCHIVE_TIME, FIXED_ARCHIVE_TIME);

    await removeIfExists(sourceArchive);
    await runCommand(
      "zip",
      ["-X", "-q", fromFileUrl(sourceArchive), METADATA_FILE, ...files],
      { cwd: fromFileUrl(staging) },
    );
    await Deno.writeTextFile(
      instructions,
      buildInstructions(options.version, options.commitSha),
    );
    return {
      instructionsPath: fromFileUrl(instructions),
      sourceArchivePath: fromFileUrl(sourceArchive),
    };
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
}

async function archiveEntries(archivePath: string): Promise<string[]> {
  const listing = new TextDecoder().decode(
    await runCommand("unzip", ["-Z1", archivePath]),
  );
  return parseArchiveEntries(listing);
}

/**
 * Parses and validates the line-oriented entry listing emitted by `unzip -Z1`.
 *
 * @param listing Raw archive-entry output from `unzip`.
 * @returns Validated archive paths in deterministic lexical order.
 */
export function parseArchiveEntries(listing: string): string[] {
  const normalizedListing = listing.trim();
  if (normalizedListing === "") return [];
  const entries = normalizedListing.split(/\r?\n/u);
  for (const entry of entries) {
    const path = entry.endsWith("/") ? entry.slice(0, -1) : entry;
    if (!isSafeRelativePath(path)) {
      throw new Error(`reviewer source: archive contains unsafe entry ${entry}`);
    }
  }
  return entries.toSorted();
}

function parseReviewerMetadata(value: unknown): ReviewerSourceMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("reviewer source: metadata must contain an object");
  }
  const metadata = value as Record<string, unknown>;
  if (
    metadata.schemaVersion !== 1 || typeof metadata.commitSha !== "string" ||
    typeof metadata.version !== "string" || !Array.isArray(metadata.files) ||
    !metadata.files.every((path) => typeof path === "string")
  ) {
    throw new Error("reviewer source: metadata has an unsupported shape");
  }
  return metadata as unknown as ReviewerSourceMetadata;
}

/**
 * Validates that reviewer source and instructions carry the expected version and commit identity.
 *
 * @param options Artifact paths and the release identity they must match.
 * @returns A promise that settles after both artifacts pass validation.
 */
export async function validateReviewerArtifacts(
  options: ValidateReviewerArtifactsOptions,
): Promise<void> {
  const entries = await archiveEntries(options.sourceArchivePath);
  if (!entries.includes(METADATA_FILE)) {
    throw new Error(`reviewer source: archive is missing ${METADATA_FILE}`);
  }
  const metadataText = new TextDecoder().decode(
    await runCommand("unzip", ["-p", options.sourceArchivePath, METADATA_FILE]),
  );
  const metadata = parseReviewerMetadata(JSON.parse(metadataText));
  if (metadata.version !== options.expectedVersion) {
    throw new Error(
      `reviewer source: version ${metadata.version} does not match expected version ${options.expectedVersion}`,
    );
  }
  if (metadata.commitSha !== options.expectedCommitSha) {
    throw new Error(
      `reviewer source: commit ${metadata.commitSha} does not match expected commit ${options.expectedCommitSha}`,
    );
  }

  const archivedSources = entries.filter((entry) => entry !== METADATA_FILE);
  const metadataFiles = [...metadata.files].toSorted();
  if (JSON.stringify(archivedSources) !== JSON.stringify(metadataFiles)) {
    throw new Error("reviewer source: archived paths do not match source metadata");
  }
  const selectedFiles = selectSourceFiles(metadataFiles);
  if (JSON.stringify(selectedFiles) !== JSON.stringify(metadataFiles)) {
    const excludedPath = metadataFiles.find((path) => !isIncluded(path));
    throw new Error(`reviewer source: archive contains excluded source path ${excludedPath}`);
  }

  const instructions = await Deno.readTextFile(options.instructionsPath);
  if (instructions !== buildInstructions(options.expectedVersion, options.expectedCommitSha)) {
    throw new Error("reviewer source: build instructions do not match the release identity");
  }
}

/**
 * Compares two ZIP archives by sorted entry path and uncompressed file bytes.
 *
 * @param expectedArchivePath Path to the submitted or expected archive.
 * @param actualArchivePath Path to the rebuilt archive.
 * @returns A promise that settles when every path and file byte matches.
 * @throws When the archives contain different paths or file bytes.
 */
export async function compareArchiveContents(
  expectedArchivePath: string,
  actualArchivePath: string,
): Promise<void> {
  const expectedEntries = await archiveEntries(expectedArchivePath);
  const actualEntries = await archiveEntries(actualArchivePath);
  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    throw new Error("reviewer source: archive contents differ: entry paths do not match");
  }

  for (const entry of expectedEntries) {
    const expected = await runCommand("unzip", ["-p", expectedArchivePath, entry]);
    const actual = await runCommand("unzip", ["-p", actualArchivePath, entry]);
    if (
      !expected.every((byte, index) => byte === actual[index]) || expected.length !== actual.length
    ) {
      throw new Error(`reviewer source: archive contents differ at ${entry}`);
    }
  }
}

async function repositoryValue(args: readonly string[], root: URL): Promise<string> {
  return new TextDecoder().decode(
    await runCommand("git", args, { cwd: fromFileUrl(root) }),
  ).trim();
}

/**
 * Runs the reviewer-source artifact command.
 *
 * @param args Command-line arguments after the script path.
 * @returns A printable artifact or comparison report.
 */
export async function runReviewerSourceCommand(args: readonly string[]): Promise<string> {
  const [command, expectedArchivePath, actualArchivePath, ...rest] = args;
  if (
    command === "compare" && expectedArchivePath !== undefined &&
    actualArchivePath !== undefined && rest.length === 0
  ) {
    await compareArchiveContents(expectedArchivePath, actualArchivePath);
    return "release: archive contents match";
  }
  if ((command === undefined || command === "create") && expectedArchivePath === undefined) {
    const root = new URL("../", import.meta.url);
    const trackedOutput = await runCommand("git", ["ls-files", "-z"], {
      cwd: fromFileUrl(root),
    });
    const trackedFiles = new TextDecoder().decode(trackedOutput).split("\0").filter(Boolean);
    const sourceFiles = selectSourceFiles(trackedFiles);
    const sourceStatus = await runCommand(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=no", "-z", "--", ...sourceFiles],
      { cwd: fromFileUrl(root) },
    );
    assertReviewerSourceClean(new TextDecoder().decode(sourceStatus));
    const artifacts = await createReviewerArtifacts({
      commitSha: await repositoryValue(["rev-parse", "HEAD"], root),
      outDir: new URL("dist/", root),
      root,
      trackedFiles,
      version: manifestBase.version,
    });
    return [artifacts.sourceArchivePath, artifacts.instructionsPath].join("\n");
  }
  throw new Error(
    "reviewer source: usage: reviewer-source.ts create | compare <expected.zip> <actual.zip>",
  );
}

if (import.meta.main) {
  try {
    console.log(await runReviewerSourceCommand(Deno.args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
