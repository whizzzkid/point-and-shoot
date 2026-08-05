const STATUS_START = "<!-- point-and-shoot-store-status:start -->";
const STATUS_END = "<!-- point-and-shoot-store-status:end -->";

/** Store-side lifecycle states projected into a GitHub release body. */
export type StoreReleaseState =
  | "unpublished"
  | "submitted"
  | "reviewed"
  | "published"
  | "rejected";

/** Version and review information for one browser store. */
export interface StoreReleaseStatus {
  readonly expectedVersion: string;
  readonly failure?: string;
  readonly listingUrl?: string;
  readonly publicVersion?: string;
  readonly reconciledAt: string;
  readonly reviewedAt?: string;
  readonly state: StoreReleaseState;
  readonly submittedAt?: string;
  readonly submittedVersion?: string;
}

/** Complete store-publication projection for one GitHub release. */
export interface ReleaseStatus {
  readonly chrome: StoreReleaseStatus;
  readonly firefox: StoreReleaseStatus;
  readonly listingSummaryChanged: boolean;
  readonly version: string;
}

function optionalVersion(version: string | undefined): string {
  return version === undefined ? "—" : `\`${version}\``;
}

function versionAndTime(version: string | undefined, timestamp: string | undefined): string {
  if (version === undefined && timestamp === undefined) return "—";
  return [optionalVersion(version), timestamp === undefined ? undefined : `at ${timestamp}`]
    .filter((value) => value !== undefined)
    .join(" ");
}

function publicStatus(label: string, status: StoreReleaseStatus): string {
  if (status.publicVersion === undefined) return "—";
  const version = `\`${status.publicVersion}\``;
  if (status.state !== "published" || status.listingUrl === undefined) return version;
  return `${version} · [Install from ${label}](${status.listingUrl})`;
}

function statusRow(label: string, status: StoreReleaseStatus): string {
  return [
    label,
    `\`${status.expectedVersion}\``,
    `**${status.state}**`,
    versionAndTime(status.submittedVersion, status.submittedAt),
    status.reviewedAt ?? "—",
    publicStatus(label, status),
    status.reconciledAt,
  ].join(" | ");
}

function versionMismatch(label: string, status: StoreReleaseStatus): string | undefined {
  if (status.publicVersion === undefined || status.publicVersion === status.expectedVersion) {
    return undefined;
  }
  return `- ${label}: Version mismatch: expected \`${status.expectedVersion}\`, public \`${status.publicVersion}\`.`;
}

function isCurrentAndPublished(status: StoreReleaseStatus): boolean {
  return status.state === "published" && status.publicVersion === status.expectedVersion &&
    status.listingUrl !== undefined;
}

function assertConsistentStatus(status: ReleaseStatus): void {
  for (
    const [label, store] of [
      ["Chrome", status.chrome],
      ["Firefox", status.firefox],
    ] as const
  ) {
    if (store.expectedVersion !== status.version) {
      throw new Error(
        `release status: ${label} expected version ${store.expectedVersion} does not match ${status.version}`,
      );
    }
    if (store.state === "rejected" && store.failure === undefined) {
      throw new Error(`release status: ${label} rejection requires actionable failure text`);
    }
  }
}

/**
 * Renders the marked store-publication section for a GitHub release.
 *
 * @param status Expected and observed state for the Chrome and Firefox listings.
 * @returns Markdown bounded by stable idempotency markers.
 */
export function renderReleaseStatus(status: ReleaseStatus): string {
  assertConsistentStatus(status);
  const findings = [
    versionMismatch("Chrome", status.chrome),
    versionMismatch("Firefox", status.firefox),
    status.chrome.failure === undefined ? undefined : `- Chrome: ${status.chrome.failure}`,
    status.firefox.failure === undefined ? undefined : `- Firefox: ${status.firefox.failure}`,
  ].filter((finding) => finding !== undefined);
  if (status.listingSummaryChanged) {
    findings.push(
      "- Manual Chrome Web Store action required: update the listing summary in the Chrome Web " +
        "Store dashboard, then record confirmation during release closeout.",
    );
  }

  const complete = isCurrentAndPublished(status.chrome) &&
    isCurrentAndPublished(status.firefox) && !status.listingSummaryChanged;
  const summary = complete
    ? "Both browser stores publish the expected release version."
    : "Store publication is incomplete. Use the details below before release closeout.";

  return [
    STATUS_START,
    "## Browser store publication",
    "",
    `GitHub release version: \`${status.version}\``,
    "",
    summary,
    "",
    "Store | Expected | State | Submitted | Reviewed | Public | Last reconciliation",
    "--- | --- | --- | --- | --- | --- | ---",
    statusRow("Chrome", status.chrome),
    statusRow("Firefox", status.firefox),
    ...(findings.length === 0 ? [] : ["", "### Follow-up", "", ...findings]),
    "",
    "The attached ZIPs are store-submission and reviewer artifacts, not consumer install links.",
    STATUS_END,
  ].join("\n");
}

/**
 * Inserts or replaces the marked store status without changing surrounding release notes.
 *
 * @param releaseBody Existing GitHub release body.
 * @param status Store status to project.
 * @returns Release body containing exactly one current marked section.
 */
export function projectReleaseStatus(releaseBody: string, status: ReleaseStatus): string {
  const rendered = renderReleaseStatus(status);
  const range = findStatusRange(releaseBody);
  if (range === undefined) {
    const notes = releaseBody.trimEnd();
    return `${notes === "" ? "" : `${notes}\n\n`}${rendered}\n`;
  }
  const before = releaseBody.slice(0, range.start);
  const after = releaseBody.slice(range.end);
  return `${before}${rendered}${after}`;
}

function findStatusRange(
  releaseBody: string,
): { readonly end: number; readonly start: number } | undefined {
  const start = releaseBody.indexOf(STATUS_START);
  const end = releaseBody.indexOf(STATUS_END);
  const hasStart = start !== -1;
  const hasEnd = end !== -1;
  if (
    hasStart !== hasEnd || (hasStart && releaseBody.lastIndexOf(STATUS_START) !== start) ||
    (hasEnd && releaseBody.lastIndexOf(STATUS_END) !== end) || end < start
  ) {
    throw new Error("release status: body must contain both status markers exactly once");
  }
  return hasStart ? { end: end + STATUS_END.length, start } : undefined;
}

function unpublishedStatus(version: string, reconciledAt: string): StoreReleaseStatus {
  return {
    expectedVersion: version,
    reconciledAt,
    state: "unpublished",
  };
}

async function readStandardInput(): Promise<string> {
  return await new Response(Deno.stdin.readable).text();
}

/**
 * Runs the release-status command used by the release workflow.
 *
 * @param args Command arguments after the script path.
 * @param readBody Existing release-body reader, injectable for tests.
 * @returns The updated release body.
 */
export async function runReleaseStatusCommand(
  args: readonly string[],
  readBody: () => Promise<string> = readStandardInput,
): Promise<string> {
  const [command, version, reconciledAt, ...rest] = args;
  if (
    command !== "seed" || version === undefined || version === "" ||
    reconciledAt === undefined || Number.isNaN(Date.parse(reconciledAt)) || rest.length > 0
  ) {
    throw new Error("release status: usage: release-status.ts seed <version> <ISO timestamp>");
  }
  const releaseBody = await readBody();
  const existingRange = findStatusRange(releaseBody);
  if (existingRange !== undefined) {
    const existingStatus = releaseBody.slice(existingRange.start, existingRange.end);
    const versionMatch = /^GitHub release version: `([^`\n]+)`$/m.exec(existingStatus);
    if (versionMatch?.[1] !== version) {
      throw new Error("release status: existing status belongs to a different release version");
    }
    return releaseBody;
  }
  const unpublished = unpublishedStatus(version, reconciledAt);
  return projectReleaseStatus(releaseBody, {
    chrome: unpublished,
    firefox: unpublished,
    listingSummaryChanged: false,
    version,
  });
}

if (import.meta.main) {
  try {
    await Deno.stdout.write(new TextEncoder().encode(await runReleaseStatusCommand(Deno.args)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
