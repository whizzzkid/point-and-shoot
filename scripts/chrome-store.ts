import type { StoreReleaseStatus } from "../build/release-status.ts";

const API_ROOT = "https://chromewebstore.googleapis.com";
const DEFAULT_MAX_POLL_ATTEMPTS = 6;
const DEFAULT_POLL_DELAY_MS = 5_000;

interface ChromeRevisionStatus {
  readonly distributionChannels?: readonly unknown[];
  readonly state?: unknown;
}

interface ChromeFetchStatus {
  readonly lastAsyncUploadState?: unknown;
  readonly publishedItemRevisionStatus?: ChromeRevisionStatus;
  readonly submittedItemRevisionStatus?: ChromeRevisionStatus;
  readonly takenDown?: unknown;
  readonly warned?: unknown;
}

interface ChromeUploadResponse {
  readonly crxVersion?: unknown;
  readonly uploadState?: unknown;
}

/** Dependencies and immutable identity used by the Chrome Web Store API v2 client. */
export interface ChromeStoreClientOptions {
  readonly accessToken: string;
  readonly extensionId: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly listingUrl?: string;
  readonly maxPollAttempts?: number;
  readonly now?: () => string;
  readonly pollDelayMs?: number;
  readonly publisherId: string;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

interface ReconcileChromeStatusOptions {
  readonly expectedVersion: string;
  readonly listingUrl: string | undefined;
  readonly now: string;
  readonly status: ChromeFetchStatus;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function revisionVersion(revision: ChromeRevisionStatus | undefined): string | undefined {
  for (const channel of revision?.distributionChannels ?? []) {
    const version = recordOf(channel).crxVersion;
    if (typeof version === "string") return version;
  }
  return undefined;
}

function revisionState(revision: ChromeRevisionStatus | undefined): string | undefined {
  return typeof revision?.state === "string" ? revision.state : undefined;
}

function optionalListingUrl(listingUrl: string | undefined): { readonly listingUrl?: string } {
  return listingUrl === undefined ? {} : { listingUrl };
}

/**
 * Maps a Chrome fetch-status response to the repository's release lifecycle.
 *
 * @param options Expected release identity and untrusted API response.
 * @returns A fail-closed status for the marked GitHub release section.
 */
export function reconcileChromeStatus(
  options: ReconcileChromeStatusOptions,
): StoreReleaseStatus {
  const publicVersion = revisionVersion(options.status.publishedItemRevisionStatus);
  const submittedVersion = revisionVersion(options.status.submittedItemRevisionStatus);
  if (submittedVersion !== undefined && submittedVersion !== options.expectedVersion) {
    throw new Error(
      `Chrome submitted version ${submittedVersion}; expected ${options.expectedVersion}`,
    );
  }
  if (options.status.takenDown === true || options.status.warned === true) {
    return {
      expectedVersion: options.expectedVersion,
      failure: options.status.takenDown === true
        ? "Chrome reports that the listing was taken down for a policy violation."
        : "Chrome reports an unresolved policy warning for the listing.",
      ...(publicVersion === undefined ? {} : { publicVersion }),
      reconciledAt: options.now,
      state: "rejected",
    };
  }
  if (publicVersion === options.expectedVersion) {
    return {
      expectedVersion: options.expectedVersion,
      ...optionalListingUrl(options.listingUrl),
      publicVersion,
      reconciledAt: options.now,
      state: "published",
    };
  }
  if (submittedVersion === options.expectedVersion) {
    const state = revisionState(options.status.submittedItemRevisionStatus);
    if (
      state !== "PENDING_REVIEW" && state !== "STAGED" && state !== "PUBLISHED" &&
      state !== "PUBLISHED_TO_TESTERS" && state !== "REJECTED" && state !== "CANCELLED"
    ) {
      throw new Error(`Chrome returned unsupported submission state ${String(state)}`);
    }
    const rejected = state === "REJECTED" || state === "CANCELLED";
    const reviewed = state === "STAGED" || state === "PUBLISHED" ||
      state === "PUBLISHED_TO_TESTERS";
    return {
      expectedVersion: options.expectedVersion,
      ...(rejected ? { failure: `Chrome reports terminal submission state ${state}.` } : {}),
      ...(publicVersion === undefined ? {} : { publicVersion }),
      reconciledAt: options.now,
      ...(reviewed ? { reviewedAt: options.now } : {}),
      state: rejected ? "rejected" : reviewed ? "reviewed" : "submitted",
      submittedAt: options.now,
      submittedVersion,
    };
  }
  return {
    expectedVersion: options.expectedVersion,
    ...(publicVersion === undefined ? {} : { publicVersion }),
    reconciledAt: options.now,
    state: "unpublished",
  };
}

function warningCodes(value: unknown): string[] {
  const codes = new Set<string>();
  const visit = (entry: unknown, depth: number): void => {
    if (depth > 8) return;
    if (Array.isArray(entry)) {
      for (const child of entry) visit(child, depth + 1);
      return;
    }
    const record = recordOf(entry);
    for (const key of ["warningCode", "reason"] as const) {
      const code = record[key];
      if (typeof code === "string" && code !== "") codes.add(code);
    }
    for (const key of ["details", "error", "warningInfo", "warnings"] as const) {
      if (key in record) visit(record[key], depth + 1);
    }
  };
  visit(value, 0);
  return [...codes];
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Copies request headers and replaces any caller-supplied authorization value.
 *
 * @param accessToken Short-lived Chrome Web Store access token.
 * @param headers Optional headers in any Fetch API-supported shape.
 * @returns A fresh header collection with the authoritative bearer token.
 */
export function authenticatedHeaders(
  accessToken: string,
  headers: HeadersInit | undefined,
): Headers {
  const authenticated = new Headers(headers);
  authenticated.set("authorization", `Bearer ${accessToken}`);
  return authenticated;
}

/** Chrome Web Store API v2 client with bounded polling and idempotent reconciliation. */
export class ChromeStoreClient {
  readonly #accessToken: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #listingUrl: string | undefined;
  readonly #maxPollAttempts: number;
  readonly #now: () => string;
  readonly #pollDelayMs: number;
  readonly #resourceName: string;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  /**
   * Creates a client for one established Chrome listing.
   *
   * @param options Vendor identity, short-lived credential, and injectable I/O.
   */
  constructor(options: ChromeStoreClientOptions) {
    if (options.accessToken === "" || options.extensionId === "" || options.publisherId === "") {
      throw new Error("Chrome store identity and access token must be non-empty");
    }
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#listingUrl = options.listingUrl;
    this.#maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
    this.#now = options.now ?? (() => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
    this.#pollDelayMs = options.pollDelayMs ?? DEFAULT_POLL_DELAY_MS;
    this.#resourceName = `publishers/${options.publisherId}/items/${options.extensionId}`;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.#fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: authenticatedHeaders(this.#accessToken, init.headers),
    });
    let decoded: unknown = {};
    try {
      decoded = await response.json();
    } catch {
      if (response.ok) throw new Error("Chrome response was not valid JSON");
      decoded = {};
    }
    if (!response.ok) {
      const codes = warningCodes(decoded);
      const suffix = codes.length === 0 ? `HTTP ${response.status}` : codes.join(", ");
      throw new Error(`Chrome publish failed: ${suffix}`);
    }
    return decoded;
  }

  async #fetchStatus(): Promise<ChromeFetchStatus> {
    return recordOf(
      await this.#request(`/v2/${this.#resourceName}:fetchStatus`),
    ) as ChromeFetchStatus;
  }

  async #waitForUpload(): Promise<void> {
    for (let attempt = 0; attempt < this.#maxPollAttempts; attempt += 1) {
      if (attempt > 0) await this.#sleep(this.#pollDelayMs);
      const status = await this.#fetchStatus();
      const state = status.lastAsyncUploadState;
      if (state === "SUCCEEDED") return;
      if (state === "FAILED" || state === "UPLOAD_FAILED") {
        throw new Error("Chrome upload failed");
      }
    }
    throw new Error("Chrome upload timed out while waiting for API acceptance");
  }

  async #waitForSubmission(expectedVersion: string): Promise<StoreReleaseStatus> {
    for (let attempt = 0; attempt < this.#maxPollAttempts; attempt += 1) {
      if (attempt > 0) await this.#sleep(this.#pollDelayMs);
      const status = await this.reconcile(expectedVersion);
      if (status.state !== "unpublished") return status;
    }
    throw new Error("Chrome publish timed out while waiting for API acceptance");
  }

  /**
   * Reconciles the current store state without uploading bytes.
   *
   * @param expectedVersion Exact manifest version attached to the GitHub release.
   * @returns Current Chrome lifecycle status.
   */
  async reconcile(expectedVersion: string): Promise<StoreReleaseStatus> {
    return reconcileChromeStatus({
      expectedVersion,
      listingUrl: this.#listingUrl,
      now: this.#now(),
      status: await this.#fetchStatus(),
    });
  }

  /**
   * Uploads and publishes exact release bytes unless the version already exists.
   *
   * @param archive Chrome release ZIP bytes.
   * @param expectedVersion Exact manifest version expected from the vendor.
   * @returns Reconciled post-submit lifecycle status.
   */
  async submit(archive: Uint8Array, expectedVersion: string): Promise<StoreReleaseStatus> {
    const existing = await this.reconcile(expectedVersion);
    if (existing.state !== "unpublished") return existing;

    const upload = recordOf(
      await this.#request(`/upload/v2/${this.#resourceName}:upload`, {
        body: Uint8Array.from(archive).buffer,
        headers: { "content-type": "application/zip" },
        method: "POST",
      }),
    ) as ChromeUploadResponse;
    if (typeof upload.crxVersion === "string" && upload.crxVersion !== expectedVersion) {
      throw new Error(
        `Chrome accepted upload version ${upload.crxVersion}; expected ${expectedVersion}`,
      );
    }
    if (upload.uploadState === "IN_PROGRESS") await this.#waitForUpload();
    else if (upload.uploadState !== "SUCCEEDED") {
      throw new Error(`Chrome upload failed with state ${String(upload.uploadState)}`);
    }

    const published = await this.#request(`/v2/${this.#resourceName}:publish`, {
      body: JSON.stringify({
        blockOnWarnings: true,
        publishType: "DEFAULT_PUBLISH",
        skipReview: false,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const codes = warningCodes(published);
    if (codes.length > 0) throw new Error(`Chrome publish failed: ${codes.join(", ")}`);
    return await this.#waitForSubmission(expectedVersion);
  }
}
