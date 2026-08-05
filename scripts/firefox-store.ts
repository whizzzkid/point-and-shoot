import type { StoreReleaseStatus } from "../build/release-status.ts";

const AMO_API_ROOT = "https://addons.mozilla.org/api/v5/addons/addon";

interface FirefoxVersionResponse {
  readonly file?: { readonly status?: unknown };
  readonly reviewed?: unknown;
  readonly version?: unknown;
}

/** One subprocess invocation, injectable so credentials and arguments can be asserted in tests. */
export interface ProcessInvocation {
  readonly args: readonly string[];
  readonly command: string;
  readonly env: Readonly<Record<string, string>>;
}

/** Captured subprocess result without throwing or logging credential-bearing environment data. */
export interface ProcessResult {
  readonly code: number;
  readonly stderr: string;
  readonly stdout: string;
}

/** Dependencies and immutable identity used by the Firefox Add-ons client. */
export interface FirefoxStoreClientOptions {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly extensionId: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly listingUrl?: string;
  readonly now?: () => string;
  readonly run?: (invocation: ProcessInvocation) => Promise<ProcessResult>;
}

/** Paths and release metadata required for one listed Firefox submission. */
export interface FirefoxSubmission {
  readonly approvalNotes: string;
  readonly artifactsDir: string;
  readonly expectedVersion: string;
  readonly metadataPath: string;
  readonly releaseNotes: string;
  readonly sourceArchivePath: string;
  readonly sourceDir: string;
}

interface ReconcileFirefoxStatusOptions {
  readonly expectedVersion: string;
  readonly listingUrl: string | undefined;
  readonly now: string;
  readonly version: FirefoxVersionResponse;
}

function optionalListingUrl(listingUrl: string | undefined): { readonly listingUrl?: string } {
  return listingUrl === undefined ? {} : { listingUrl };
}

/**
 * Maps an AMO version resource to the repository's release lifecycle.
 *
 * @param options Expected release identity and untrusted AMO response.
 * @returns A fail-closed status for the marked GitHub release section.
 */
export function reconcileFirefoxStatus(
  options: ReconcileFirefoxStatusOptions,
): StoreReleaseStatus {
  if (typeof options.version.version !== "string") {
    throw new Error("Firefox version response does not contain a version");
  }
  if (options.version.version !== options.expectedVersion) {
    throw new Error(
      `Firefox returned version ${options.version.version}; expected ${options.expectedVersion}`,
    );
  }
  const fileStatus = options.version.file?.status;
  if (typeof fileStatus !== "string") {
    throw new Error("Firefox version response does not contain a file status");
  }
  const reviewedAt = typeof options.version.reviewed === "string"
    ? options.version.reviewed
    : undefined;
  if (fileStatus === "public") {
    return {
      expectedVersion: options.expectedVersion,
      ...optionalListingUrl(options.listingUrl),
      publicVersion: options.expectedVersion,
      reconciledAt: options.now,
      ...(reviewedAt === undefined ? {} : { reviewedAt }),
      state: "published",
    };
  }
  if (fileStatus === "disabled") {
    return {
      expectedVersion: options.expectedVersion,
      failure: "Firefox Add-ons reports the submitted file as disabled.",
      reconciledAt: options.now,
      state: "rejected",
      submittedVersion: options.expectedVersion,
    };
  }
  if (fileStatus !== "unreviewed") {
    throw new Error(`Firefox returned unsupported file status ${fileStatus}`);
  }
  return {
    expectedVersion: options.expectedVersion,
    reconciledAt: options.now,
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
    state: "submitted",
    submittedAt: options.now,
    submittedVersion: options.expectedVersion,
  };
}

async function defaultRun(invocation: ProcessInvocation): Promise<ProcessResult> {
  const output = await new Deno.Command(invocation.command, {
    args: [...invocation.args],
    env: { ...invocation.env },
    stderr: "piped",
    stdout: "piped",
  }).output();
  const decoder = new TextDecoder();
  return {
    code: output.code,
    stderr: decoder.decode(output.stderr),
    stdout: decoder.decode(output.stdout),
  };
}

/** Firefox Add-ons client using pinned web-ext for listed submissions. */
export class FirefoxStoreClient {
  readonly #apiKey: string;
  readonly #apiSecret: string;
  readonly #extensionId: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #listingUrl: string | undefined;
  readonly #now: () => string;
  readonly #run: (invocation: ProcessInvocation) => Promise<ProcessResult>;

  /**
   * Creates a client for one stable Gecko extension identity.
   *
   * @param options Vendor identity, credentials, and injectable I/O.
   */
  constructor(options: FirefoxStoreClientOptions) {
    if (options.apiKey === "" || options.apiSecret === "" || options.extensionId === "") {
      throw new Error("Firefox store identity and API credentials must be non-empty");
    }
    this.#apiKey = options.apiKey;
    this.#apiSecret = options.apiSecret;
    this.#extensionId = options.extensionId;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#listingUrl = options.listingUrl;
    this.#now = options.now ?? (() => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
    this.#run = options.run ?? defaultRun;
  }

  async #version(expectedVersion: string): Promise<FirefoxVersionResponse | undefined> {
    const response = await this.#fetch(
      `${AMO_API_ROOT}/${encodeURIComponent(this.#extensionId)}/versions/v${
        encodeURIComponent(expectedVersion)
      }/`,
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Firefox status request failed: HTTP ${response.status}`);
    return await response.json() as FirefoxVersionResponse;
  }

  /**
   * Reconciles one exact AMO version without submitting package bytes.
   *
   * @param expectedVersion Exact manifest version attached to the GitHub release.
   * @returns Current Firefox lifecycle status.
   */
  async reconcile(expectedVersion: string): Promise<StoreReleaseStatus> {
    const version = await this.#version(expectedVersion);
    if (version === undefined) {
      return {
        expectedVersion,
        reconciledAt: this.#now(),
        state: "unpublished",
      };
    }
    return reconcileFirefoxStatus({
      expectedVersion,
      listingUrl: this.#listingUrl,
      now: this.#now(),
      version,
    });
  }

  /**
   * Submits a listed version with reviewer source unless it already exists.
   *
   * @param submission Exact extracted package, source archive, and reviewer metadata.
   * @returns Reconciled post-submit lifecycle status.
   */
  async submit(submission: FirefoxSubmission): Promise<StoreReleaseStatus> {
    const existing = await this.reconcile(submission.expectedVersion);
    if (existing.state !== "unpublished") return existing;
    await Deno.writeTextFile(
      submission.metadataPath,
      `${
        JSON.stringify(
          {
            version: {
              approval_notes: submission.approvalNotes,
              release_notes: { "en-US": submission.releaseNotes },
            },
          },
          null,
          2,
        )
      }\n`,
    );
    const result = await this.#run({
      args: [
        "run",
        "-A",
        "npm:web-ext@10.5.0",
        "sign",
        "--source-dir",
        submission.sourceDir,
        "--artifacts-dir",
        submission.artifactsDir,
        "--channel",
        "listed",
        "--amo-metadata",
        submission.metadataPath,
        "--upload-source-code",
        submission.sourceArchivePath,
        "--approval-timeout",
        "0",
        "--timeout",
        "300000",
        "--no-input",
      ],
      command: Deno.execPath(),
      env: {
        WEB_EXT_API_KEY: this.#apiKey,
        WEB_EXT_API_SECRET: this.#apiSecret,
      },
    });
    if (result.code !== 0) {
      if (/\b(?:already exists|duplicate|409)\b/i.test(result.stderr)) {
        return {
          expectedVersion: submission.expectedVersion,
          reconciledAt: this.#now(),
          state: "submitted",
          submittedAt: this.#now(),
          submittedVersion: submission.expectedVersion,
        };
      }
      throw new Error(`Firefox submission failed: ${result.stderr.trim() || "web-ext failed"}`);
    }
    const reconciled = await this.reconcile(submission.expectedVersion);
    return reconciled.state === "unpublished"
      ? {
        expectedVersion: submission.expectedVersion,
        reconciledAt: this.#now(),
        state: "submitted",
        submittedAt: this.#now(),
        submittedVersion: submission.expectedVersion,
      }
      : reconciled;
  }
}

/**
 * Verifies the extracted Firefox package is bound to the expected stable ID and version.
 *
 * @param manifestPath Path to the extracted manifest.json.
 * @param extensionId Expected stable Gecko ID.
 * @param expectedVersion Exact GitHub release version.
 * @returns Nothing after identity validation succeeds.
 */
export async function validateFirefoxManifest(
  manifestPath: string,
  extensionId: string,
  expectedVersion: string,
): Promise<void> {
  const manifest = JSON.parse(await Deno.readTextFile(manifestPath)) as Record<string, unknown>;
  const gecko = (manifest.browser_specific_settings as Record<string, unknown> | undefined)?.gecko;
  const actualId = (gecko as Record<string, unknown> | undefined)?.id;
  if (actualId !== extensionId) {
    throw new Error(`Firefox package ID ${String(actualId)} does not match ${extensionId}`);
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `Firefox package version ${String(manifest.version)} does not match ${expectedVersion}`,
    );
  }
}
