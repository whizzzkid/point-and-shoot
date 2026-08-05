import { fromFileUrl, toFileUrl } from "@std/path";

import { collectRemoteUrlOffenders } from "./build.ts";
import { manifestBase } from "./manifest.ts";
import { validateReviewerArtifacts } from "./reviewer-source.ts";

/** Browser extension targets emitted by the release build. */
export type ReleaseTarget = "chrome" | "firefox";

/** Result of validating one packaged browser extension. */
export interface ReleaseReport {
  readonly sizeBytes: number;
  readonly target: ReleaseTarget;
  readonly version: string;
}

/** Options for validating one release archive. */
export interface ValidateReleaseArchiveOptions {
  readonly archivePath: string;
  readonly expectedVersion: string;
  readonly target: ReleaseTarget;
}

/** Dependencies that make the release command deterministic in tests. */
export interface ReleaseCommandOptions {
  readonly commitSha?: string;
  readonly distDir?: URL;
  readonly now?: Date;
  readonly tagCommitSha?: string;
}

interface Calver {
  readonly dateKey: number;
  readonly sequence: number;
}

const CALVER_DATE_COMPONENT_FACTOR = 100;
const CALVER_DATE_KEY_FACTOR = 10_000;
const CALVER_PATTERN = /^(?<year>\d{4})\.(?<monthDay>[1-9]\d{2,3})\.(?<sequence>0|[1-9]\d*)$/;
const BOOTSTRAP_VERSION = "0.1.0";
const REQUIRED_MANIFEST_KEYS = [
  "action",
  "background",
  "commands",
  "content_security_policy",
  "description",
  "icons",
  "manifest_version",
  "name",
  "options_ui",
  "permissions",
  "version",
  "web_accessible_resources",
] as const;

function parseCalver(version: string): Calver {
  const match = CALVER_PATTERN.exec(version);
  const groups = match?.groups;
  if (groups === undefined) {
    throw new Error(
      `release: expected CalVer YYYY.MMDD.N without leading zeroes, received ${version}`,
    );
  }

  const { year: yearText, monthDay: monthDayText, sequence: sequenceText } = groups;
  const year = Number(yearText);
  const monthDay = Number(monthDayText);
  const sequence = Number(sequenceText);
  const month = Math.floor(monthDay / CALVER_DATE_COMPONENT_FACTOR);
  const day = monthDay % CALVER_DATE_COMPONENT_FACTOR;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 || day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`release: ${version} does not contain a valid UTC calendar date`);
  }

  return { dateKey: year * CALVER_DATE_KEY_FACTOR + monthDay, sequence };
}

/**
 * Returns the next UTC calendar version after `currentVersion`.
 *
 * @param currentVersion The last released CalVer, or the one permitted bootstrap SemVer.
 * @param now The release instant; only its UTC date is used.
 * @returns The next version in `YYYY.MMDD.N` form.
 */
export function nextCalver(currentVersion: string, now: Date): string {
  if (Number.isNaN(now.getTime())) throw new Error("release: the supplied date is invalid");
  const year = now.getUTCFullYear();
  const monthDay = (now.getUTCMonth() + 1) * CALVER_DATE_COMPONENT_FACTOR + now.getUTCDate();
  const dateKey = year * CALVER_DATE_KEY_FACTOR + monthDay;

  if (currentVersion === BOOTSTRAP_VERSION) return `${year}.${monthDay}.0`;

  const current = parseCalver(currentVersion);
  if (current.dateKey > dateKey) {
    throw new Error(
      `release: current version ${currentVersion} is later than the UTC release date`,
    );
  }
  const sequence = current.dateKey === dateKey ? current.sequence + 1 : 0;
  return `${year}.${monthDay}.${sequence}`;
}

/**
 * Asserts that `tag` is the `v`-prefixed form of `version`.
 *
 * @param tag The Git tag Release Please created.
 * @param version The packaged manifest version.
 */
export function assertTagMatchesVersion(tag: string, version: string): void {
  parseCalver(version);
  if (tag !== `v${version}`) {
    throw new Error(`release: tag ${tag} does not match manifest version ${version}`);
  }
}

/**
 * Asserts that a release tag resolves to the commit whose artifacts are being validated.
 *
 * @param tag The Git tag being validated.
 * @param tagCommitSha Commit resolved from the peeled tag.
 * @param releaseCommitSha Commit recorded in the reviewer source and current checkout.
 */
export function assertTagResolvesToCommit(
  tag: string,
  tagCommitSha: string,
  releaseCommitSha: string,
): void {
  if (tagCommitSha !== releaseCommitSha) {
    throw new Error(
      `release: tag ${tag} resolves to ${tagCommitSha} instead of release commit ${releaseCommitSha}`,
    );
  }
}

/**
 * Asserts that Release Please's tracked version sources match the packaged manifest version.
 *
 * @param version The version exported by the browser-manifest source.
 * @param versionFile The trimmed contents of `version.txt`.
 * @param releaseManifest The parsed Release Please manifest.
 */
export function assertVersionSources(
  version: string,
  versionFile: string,
  releaseManifest: Readonly<Record<string, unknown>>,
): void {
  if (versionFile !== version) {
    throw new Error(
      `release: version.txt ${versionFile} does not match manifest version ${version}`,
    );
  }
  if (releaseManifest["."] !== version) {
    throw new Error(
      `release: Release Please manifest version ${
        String(releaseManifest["."])
      } does not match ${version}`,
    );
  }
}

/**
 * Rejects paths that cannot appear in a release archive.
 *
 * @param paths Archive entry paths reported by `unzip`.
 */
export function validateArchivePaths(paths: readonly string[]): void {
  for (const path of paths) {
    const normalized = path.replaceAll("\\", "/");
    const segments = normalized.split("/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:/.test(normalized) ||
      segments.includes("..")
    ) {
      throw new Error(`release: archive contains unsafe path ${path}`);
    }
    if (segments.includes("dist")) {
      throw new Error(`release: archive leaks a dist/ path through ${path}`);
    }
    if (normalized.endsWith(".map")) {
      throw new Error(`release: archive contains forbidden sourcemap ${path}`);
    }
  }
}

async function validateReleaseSet(
  distDir: URL,
  version: string,
  commitSha: string,
  tag: string | undefined,
): Promise<string> {
  const sourceRoot = new URL("../", import.meta.url);
  const versionFile = (await Deno.readTextFile(new URL("version.txt", sourceRoot))).trim();
  const releaseManifestValue: unknown = JSON.parse(
    await Deno.readTextFile(new URL(".release-please-manifest.json", sourceRoot)),
  );
  if (
    typeof releaseManifestValue !== "object" ||
    releaseManifestValue === null ||
    Array.isArray(releaseManifestValue)
  ) {
    throw new Error("release: .release-please-manifest.json must contain an object");
  }
  assertVersionSources(
    version,
    versionFile,
    releaseManifestValue as Record<string, unknown>,
  );
  if (tag !== undefined) assertTagMatchesVersion(tag, version);
  const reports = await Promise.all(
    (["chrome", "firefox"] as const).map((target) =>
      validateReleaseArchive({
        archivePath: fromFileUrl(new URL(`${target}.zip`, distDir)),
        expectedVersion: version,
        target,
      })
    ),
  );
  const sourceArchivePath = fromFileUrl(new URL("firefox-source.zip", distDir));
  const instructionsPath = fromFileUrl(new URL("firefox-build-instructions.md", distDir));
  await assertReviewerArtifactExists(sourceArchivePath, "firefox-source.zip");
  await assertReviewerArtifactExists(instructionsPath, "firefox-build-instructions.md");
  await validateReviewerArtifacts({
    expectedCommitSha: commitSha,
    expectedVersion: version,
    instructionsPath,
    sourceArchivePath,
  });
  const sourceSizeBytes = (await Deno.stat(sourceArchivePath)).size;
  const instructionsSizeBytes = (await Deno.stat(instructionsPath)).size;
  const totalSizeBytes = reports.reduce((sum, report) => sum + report.sizeBytes, 0) +
    sourceSizeBytes + instructionsSizeBytes;
  return [
    ...reports.map((report) =>
      `${report.target}: ${report.sizeBytes} bytes (version ${report.version})`
    ),
    `firefox reviewer source: ${sourceSizeBytes} bytes (commit ${commitSha})`,
    `firefox build instructions: ${instructionsSizeBytes} bytes`,
    `total: ${totalSizeBytes} bytes`,
  ].join("\n");
}

async function assertReviewerArtifactExists(
  artifactPath: string,
  artifactName: string,
): Promise<void> {
  try {
    const artifact = await Deno.stat(artifactPath);
    if (!artifact.isFile) {
      throw new Error(`release: missing reviewer artifact ${artifactName}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`release: missing reviewer artifact ${artifactName}`);
    }
    throw error;
  }
}

/**
 * Runs a release command and returns its printable report.
 *
 * @param args Command arguments after the script name.
 * @param options Deterministic clock and output-directory overrides for tests.
 * @returns The computed version or package validation report.
 */
export async function runReleaseCommand(
  args: readonly string[],
  options: ReleaseCommandOptions = {},
): Promise<string> {
  const [command, value, ...rest] = args;
  if (command === "current" && value === undefined) {
    return manifestBase.version;
  }
  if (command === "next" && value !== undefined && rest.length === 0) {
    return nextCalver(value, options.now ?? new Date());
  }
  if (command === "validate" && rest.length === 0) {
    const sourceRoot = new URL("../", import.meta.url);
    const commitSha = options.commitSha ??
      (await commandOutput("git", ["rev-parse", "HEAD"], fromFileUrl(sourceRoot))).trim();
    if (value !== undefined) {
      const tagCommitSha = options.tagCommitSha ??
        (await commandOutput(
          "git",
          ["rev-parse", `${value}^{commit}`],
          fromFileUrl(sourceRoot),
        )).trim();
      assertTagResolvesToCommit(value, tagCommitSha, commitSha);
    }
    return await validateReleaseSet(
      options.distDir ?? new URL("../dist/", import.meta.url),
      manifestBase.version,
      commitSha,
      value,
    );
  }
  throw new Error(
    "release: usage: release.ts current | next <current-version> | validate [v<version>]",
  );
}

async function commandOutput(
  command: string,
  args: readonly string[],
  cwd?: string,
): Promise<string> {
  const result = await new Deno.Command(command, {
    args: [...args],
    ...(cwd === undefined ? {} : { cwd }),
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    const detail = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`release: \`${command}\` exited with code ${result.code}: ${detail}`);
  }
  return new TextDecoder().decode(result.stdout);
}

function validateManifest(
  manifest: Record<string, unknown>,
  target: ReleaseTarget,
  expectedVersion: string,
): void {
  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (!(key in manifest)) throw new Error(`release: manifest is missing required key ${key}`);
  }
  if (manifest.manifest_version !== 3) {
    throw new Error("release: manifest_version must be 3");
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `release: ${target} manifest version ${
        String(manifest.version)
      } does not match ${expectedVersion}`,
    );
  }
  const targetKey = target === "chrome" ? "side_panel" : "sidebar_action";
  if (!(targetKey in manifest)) {
    throw new Error(`release: ${target} manifest is missing required key ${targetKey}`);
  }
}

async function validateExtractedArchive(
  root: URL,
  target: ReleaseTarget,
  expectedVersion: string,
): Promise<void> {
  const manifestText = await Deno.readTextFile(new URL("manifest.json", root));
  const parsed: unknown = JSON.parse(manifestText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("release: manifest.json must contain an object");
  }
  validateManifest(parsed as Record<string, unknown>, target, expectedVersion);

  const remoteUrlOffenders = await collectRemoteUrlOffenders(root);
  if (remoteUrlOffenders.length > 0) {
    throw new Error(
      `release: archive contains forbidden remote URL in ${remoteUrlOffenders.join(", ")}`,
    );
  }
}

/**
 * Validates one Chrome or Firefox release zip.
 *
 * @param options Archive path, target, and expected packaged version.
 * @returns The validated target, version, and archive size.
 */
export async function validateReleaseArchive(
  options: ValidateReleaseArchiveOptions,
): Promise<ReleaseReport> {
  const archive = await Deno.stat(options.archivePath);
  if (!archive.isFile || archive.size === 0) {
    throw new Error(`release: ${options.archivePath} is not a non-empty archive`);
  }

  const listing = await commandOutput("unzip", ["-Z1", options.archivePath]);
  const paths = listing.split(/\r?\n/).filter((path) => path.length > 0);
  validateArchivePaths(paths);
  if (!paths.includes("manifest.json")) {
    throw new Error("release: archive must contain manifest.json at its root");
  }

  const tempDir = await Deno.makeTempDir();
  try {
    await commandOutput("unzip", ["-q", options.archivePath, "-d", tempDir]);
    await validateExtractedArchive(
      new URL(`${toFileUrl(tempDir).href}/`),
      options.target,
      options.expectedVersion,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }

  return {
    sizeBytes: archive.size,
    target: options.target,
    version: options.expectedVersion,
  };
}

if (import.meta.main) {
  console.log(await runReleaseCommand(Deno.args));
}
