import {
  projectReleaseStatus,
  type ReleaseStatus,
  type StoreReleaseStatus,
} from "../build/release-status.ts";
import { parseStoreListing } from "../build/store-listing.ts";
import { ChromeStoreClient } from "./chrome-store.ts";
import { FirefoxStoreClient, validateFirefoxManifest } from "./firefox-store.ts";

const DISABLED_MESSAGE =
  "Automatic store publishing is disabled. Complete the first manual publication and activation packet.";
const AUTOMATION_NOTICE_START = "<!-- point-and-shoot-store-automation:start -->";
const AUTOMATION_NOTICE_END = "<!-- point-and-shoot-store-automation:end -->";
const STATUS_START = "<!-- point-and-shoot-store-status:start -->";
const STATUS_END = "<!-- point-and-shoot-store-status:end -->";
const USAGE = [
  "Usage:",
  "  store-release.ts disabled <version> <ISO timestamp> <input body> <output body>",
  "  store-release.ts <submit|reconcile> <version> <ISO timestamp> <input body> " +
  "<output body> <assets directory>",
].join("\n");

/** Independently callable store operations for submit or reconcile mode. */
export interface StoreOperations {
  readonly chrome: () => Promise<StoreReleaseStatus>;
  readonly firefox: () => Promise<StoreReleaseStatus>;
}

/** Secret values are returned only after the enablement gate passes. */
export interface StoreSecrets {
  readonly values: readonly string[];
}

/** Inputs for projecting one exact release's store-publication result. */
export interface StoreReleaseOptions {
  readonly enabled: boolean;
  readonly expectedVersion: string;
  readonly listingSummaryChanged: boolean;
  readonly now: string;
  readonly readReleaseBody: () => Promise<string>;
  readonly readSecrets: () => StoreSecrets;
  readonly stores: StoreOperations | undefined;
}

/** Store-publication outcome and idempotently updated release body. */
export interface StoreReleaseResult {
  readonly failed: boolean;
  readonly releaseBody: string;
}

function failedStatus(
  expectedVersion: string,
  now: string,
  failure: string,
): StoreReleaseStatus {
  return {
    expectedVersion,
    failure,
    reconciledAt: now,
    state: "rejected",
  };
}

function automationNotice(): string {
  return [
    AUTOMATION_NOTICE_START,
    `> ${DISABLED_MESSAGE}`,
    AUTOMATION_NOTICE_END,
  ].join("\n");
}

function projectAutomationNotice(body: string, disabled: boolean): string {
  const start = body.indexOf(AUTOMATION_NOTICE_START);
  const end = body.indexOf(AUTOMATION_NOTICE_END);
  if (
    (start === -1) !== (end === -1) || (start !== -1 && end < start) ||
    (start !== -1 && body.lastIndexOf(AUTOMATION_NOTICE_START) !== start) ||
    (end !== -1 && body.lastIndexOf(AUTOMATION_NOTICE_END) !== end)
  ) {
    throw new Error("release status: malformed store automation notice markers");
  }
  const withoutNotice = start === -1
    ? body.trimEnd()
    : `${body.slice(0, start)}${body.slice(end + AUTOMATION_NOTICE_END.length)}`.trimEnd();
  return disabled
    ? `${withoutNotice === "" ? "" : `${withoutNotice}\n\n`}${automationNotice()}\n`
    : `${withoutNotice}${withoutNotice === "" ? "" : "\n"}`;
}

function assertReleaseBodyVersion(body: string, expectedVersion: string): void {
  const start = body.indexOf(STATUS_START);
  const end = body.indexOf(STATUS_END);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error("release status: malformed store status markers");
  }
  if (start === -1) return;
  const section = body.slice(start, end + STATUS_END.length);
  const actualVersion = /^GitHub release version: `([^`\n]+)`$/m.exec(section)?.[1];
  if (actualVersion !== expectedVersion) {
    throw new Error("release status: existing status belongs to a different release version");
  }
}

/**
 * Removes known credentials and authorization terminology from surfaced vendor errors.
 *
 * @param message Untrusted caught error text.
 * @param secrets Exact credential values that must never leave the process.
 * @returns Actionable text safe for logs and the public release body.
 */
export function redactStoreError(message: string, secrets: readonly string[]): string {
  let result = message.replaceAll(/authorization/gi, "[REDACTED]");
  for (const secret of secrets) {
    if (secret !== "") result = result.replaceAll(secret, "[REDACTED]");
  }
  return result;
}

function releaseStatus(
  options: StoreReleaseOptions,
  chrome: StoreReleaseStatus,
  firefox: StoreReleaseStatus,
): ReleaseStatus {
  return {
    chrome,
    firefox,
    listingSummaryChanged: options.listingSummaryChanged,
    version: options.expectedVersion,
  };
}

/**
 * Executes stores independently and projects both outcomes into the marked release section.
 *
 * @param options Enablement gate, release identity, lazy secrets, and store operations.
 * @returns Updated release body plus whether an enabled vendor operation failed.
 */
export async function runStoreRelease(
  options: StoreReleaseOptions,
): Promise<StoreReleaseResult> {
  const body = await options.readReleaseBody();
  assertReleaseBodyVersion(body, options.expectedVersion);
  if (!options.enabled) {
    return {
      failed: false,
      releaseBody: projectAutomationNotice(body, true),
    };
  }
  if (options.stores === undefined) throw new Error("Enabled publication requires store clients");
  const secrets = options.readSecrets().values;
  const [chromeResult, firefoxResult] = await Promise.allSettled([
    options.stores.chrome(),
    options.stores.firefox(),
  ]);
  const statusFor = (
    result: PromiseSettledResult<StoreReleaseStatus>,
  ): StoreReleaseStatus =>
    result.status === "fulfilled" ? result.value : failedStatus(
      options.expectedVersion,
      options.now,
      redactStoreError(
        result.reason instanceof Error ? result.reason.message : String(result.reason),
        secrets,
      ),
    );
  return {
    failed: chromeResult.status === "rejected" || firefoxResult.status === "rejected" ||
      (chromeResult.status === "fulfilled" && chromeResult.value.state === "rejected") ||
      (firefoxResult.status === "fulfilled" && firefoxResult.value.state === "rejected"),
    releaseBody: projectReleaseStatus(
      projectAutomationNotice(body, false),
      releaseStatus(options, statusFor(chromeResult), statusFor(firefoxResult)),
    ),
  };
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`Store publication requires ${name}`);
  }
  return value;
}

function assertIdentity(name: string, configured: string | null, environment: string): string {
  if (configured === null) throw new Error(`store-listing.json does not define ${name}`);
  if (environment !== configured) {
    throw new Error(`${name} does not match store-listing.json`);
  }
  return configured;
}

/**
 * Runs the workflow-facing command without resolving vendor secrets in disabled mode.
 *
 * @param args Command, exact version, timestamp, body paths, and optional asset directory.
 * @returns A machine-readable result for the workflow's final failure gate.
 */
export async function runStoreReleaseCommand(args: readonly string[]): Promise<string> {
  const [operation, version, now, inputBodyPath, outputBodyPath, assetsDir, ...rest] = args;
  if (
    (operation !== "disabled" && operation !== "submit" && operation !== "reconcile") ||
    version === undefined || version === "" || now === undefined || Number.isNaN(Date.parse(now)) ||
    inputBodyPath === undefined || outputBodyPath === undefined || rest.length > 0
  ) {
    throw new Error(USAGE);
  }

  const readReleaseBody = () => Deno.readTextFile(inputBodyPath);
  if (operation === "disabled") {
    if (assetsDir !== undefined) throw new Error(USAGE);
    const result = await runStoreRelease({
      enabled: false,
      expectedVersion: version,
      listingSummaryChanged: false,
      now,
      readReleaseBody,
      readSecrets: () => {
        throw new Error("disabled mode must not resolve vendor secrets");
      },
      stores: undefined,
    });
    await Deno.writeTextFile(outputBodyPath, result.releaseBody);
    return `${JSON.stringify({ failed: result.failed })}\n`;
  }
  if (assetsDir === undefined || assetsDir === "") throw new Error(USAGE);

  const listing = parseStoreListing(JSON.parse(await Deno.readTextFile("store-listing.json")));
  const chromeExtensionId = assertIdentity(
    "CHROME_EXTENSION_ID",
    listing.stores.chrome.extensionId,
    requiredEnvironment("CHROME_EXTENSION_ID"),
  );
  const chromePublisherId = assertIdentity(
    "CHROME_PUBLISHER_ID",
    listing.stores.chrome.publisherId,
    requiredEnvironment("CHROME_PUBLISHER_ID"),
  );
  const firefoxExtensionId = assertIdentity(
    "FIREFOX_EXTENSION_ID",
    listing.stores.firefox.extensionId,
    requiredEnvironment("FIREFOX_EXTENSION_ID"),
  );
  const chromeAccessToken = requiredEnvironment("CHROME_ACCESS_TOKEN");
  const firefoxApiKey = requiredEnvironment("WEB_EXT_API_KEY");
  const firefoxApiSecret = requiredEnvironment("WEB_EXT_API_SECRET");
  const assetRoot = assetsDir;
  await validateFirefoxManifest(
    `${assetRoot}/firefox/manifest.json`,
    firefoxExtensionId,
    version,
  );
  const chrome = new ChromeStoreClient({
    accessToken: chromeAccessToken,
    extensionId: chromeExtensionId,
    ...(listing.stores.chrome.listingUrl === null
      ? {}
      : { listingUrl: listing.stores.chrome.listingUrl }),
    publisherId: chromePublisherId,
  });
  const firefox = new FirefoxStoreClient({
    apiKey: firefoxApiKey,
    apiSecret: firefoxApiSecret,
    extensionId: firefoxExtensionId,
    ...(listing.stores.firefox.listingUrl === null
      ? {}
      : { listingUrl: listing.stores.firefox.listingUrl }),
  });
  const result = await runStoreRelease({
    enabled: true,
    expectedVersion: version,
    listingSummaryChanged: Deno.env.get("LISTING_SUMMARY_CHANGED") === "true",
    now,
    readReleaseBody,
    readSecrets: () => ({
      values: [chromeAccessToken, firefoxApiKey, firefoxApiSecret],
    }),
    stores: {
      chrome: () =>
        operation === "reconcile"
          ? chrome.reconcile(version)
          : Deno.readFile(`${assetRoot}/chrome-${version}.zip`).then((archive) =>
            chrome.submit(archive, version)
          ),
      firefox: () =>
        operation === "reconcile" ? firefox.reconcile(version) : firefox.submit({
          approvalNotes:
            "No remote code. Reproduce this release using firefox-build-instructions.md and " +
            "compare it with the submitted package using deno task release:compare.",
          artifactsDir: `${assetRoot}/signed-firefox`,
          expectedVersion: version,
          metadataPath: `${assetRoot}/firefox-metadata.json`,
          releaseNotes: listing.listing.currentVersionSummary,
          sourceArchivePath: `${assetRoot}/firefox-source.zip`,
          sourceDir: `${assetRoot}/firefox`,
        }),
    },
  });
  await Deno.writeTextFile(outputBodyPath, result.releaseBody);
  return `${JSON.stringify({ failed: result.failed })}\n`;
}

if (import.meta.main) {
  try {
    await Deno.stdout.write(new TextEncoder().encode(await runStoreReleaseCommand(Deno.args)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
