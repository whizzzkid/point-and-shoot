import { fromFileUrl, relative } from "@std/path";
import { FIREFOX_EXTENSION_ID, forChrome, forFirefox, manifestBase } from "./manifest.ts";

const STORE_LISTING_FILE = "store-listing.json";
const SUPPORT_EMAIL = "support@pointandshoot.app";
const SUPPORT_URL = "https://pointandshoot.app/";
const PRIVACY_URL = "https://pointandshoot.app/privacy/";
const MAX_SHORT_DESCRIPTION_CHARACTERS = 132;
const MAX_FULL_DESCRIPTION_CHARACTERS = 16_000;
const MAX_PRIVACY_FIELD_CHARACTERS = 1_000;
const REQUIRED_LOCAL_DATA_CATEGORIES = [
  "websiteContent",
  "webHistory",
  "userActivity",
  "userGeneratedContent",
] as const;
const PUBLIC_SURFACE_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/design.md",
  "docs/specs/",
  "docs/tutorials/",
  "site/src/",
] as const;
const STORE_URL_SENTINELS = [
  "__CHROME_STORE_URL__",
  "__FIREFOX_STORE_URL__",
  "REPLACE_WITH_CHROME_STORE_URL",
  "REPLACE_WITH_FIREFOX_STORE_URL",
] as const;
const DUMMY_STORE_URL_PATTERNS = [
  /https:\/\/chromewebstore\.google\.com\/detail\/(?:placeholder|replace|todo)(?:[/?#\s]|$)/i,
  /https:\/\/addons\.mozilla\.org\/firefox\/addon\/(?:placeholder|replace|todo)(?:[/?#\s]|$)/i,
] as const;

type StoreState = "unpublished" | "submitted" | "published";

interface LocalDataDisclosure {
  category: string;
  description: string;
}

interface ChromeStoreListing {
  state: StoreState;
  extensionId: string | null;
  publisherId: string | null;
  listingUrl: string | null;
}

interface FirefoxStoreListing {
  state: StoreState;
  slug: string | null;
  extensionId: string | null;
  listingUrl: string | null;
}

/** Canonical browser-store copy, identity, publication state, and privacy disclosures. */
export interface StoreListing {
  schemaVersion: 1;
  support: {
    email: string;
    url: string;
  };
  listing: {
    name: string;
    shortDescription: string;
    currentVersionSummary: string;
    fullDescription: string;
  };
  privacy: {
    url: string;
    effectiveDate: string;
    singlePurpose: string;
    remoteCode: boolean;
    permissions: Record<string, string>;
    dataDisclosures: {
      handledLocally: LocalDataDisclosure[];
      collected: boolean;
      transmitted: boolean;
      sold: boolean;
      shared: boolean;
      usedForAdvertising: boolean;
      usedForCreditDecisions: boolean;
    };
  };
  stores: {
    chrome: ChromeStoreListing;
    firefox: FirefoxStoreListing;
  };
}

/** One actionable contract violation, addressed by its JSON or public-surface path. */
export interface StoreListingIssue {
  path: string;
  message: string;
}

class StoreListingParseError extends Error {
  issues: readonly StoreListingIssue[];

  constructor(issues: readonly StoreListingIssue[]) {
    super(`Invalid store listing:\n${issues.map(formatIssue).join("\n")}`);
    this.name = "StoreListingParseError";
    this.issues = issues;
  }
}

function formatIssue(issue: StoreListingIssue): string {
  return `- ${issue.path}: ${issue.message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(
  value: unknown,
  path: string,
  issues: StoreListingIssue[],
): Record<string, unknown> {
  if (isRecord(value)) return value;
  issues.push({ path, message: "must be an object" });
  return {};
}

function recordAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): Record<string, unknown> {
  return recordValue(record[key], path, issues);
}

function stringAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): string {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) return value;
  issues.push({ path, message: "must be a non-empty string" });
  return "";
}

function nullableStringAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): string | null {
  const value = record[key];
  if (value === null || (typeof value === "string" && value.length > 0)) return value;
  issues.push({ path, message: "must be null or a non-empty string" });
  return null;
}

function booleanAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): boolean {
  const value = record[key];
  if (typeof value === "boolean") return value;
  issues.push({ path, message: "must be a boolean" });
  return false;
}

function stateAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): StoreState {
  const value = record[key];
  if (value === "unpublished" || value === "submitted" || value === "published") return value;
  issues.push({ path, message: "must be unpublished, submitted, or published" });
  return "unpublished";
}

function stringRecordAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): Record<string, string> {
  const value = recordAt(record, key, path, issues);
  const result: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string" || entryValue.length === 0) {
      issues.push({ path: `${path}.${entryKey}`, message: "must be a non-empty string" });
      continue;
    }
    result[entryKey] = entryValue;
  }
  return result;
}

function localDataDisclosuresAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: StoreListingIssue[],
): LocalDataDisclosure[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
    return [];
  }
  return value.map((entry, index) => {
    const entryPath = `${path}.${index}`;
    const disclosure = recordValue(entry, entryPath, issues);
    return {
      category: stringAt(disclosure, "category", `${entryPath}.category`, issues),
      description: stringAt(disclosure, "description", `${entryPath}.description`, issues),
    };
  });
}

function parseSupport(
  root: Record<string, unknown>,
  issues: StoreListingIssue[],
): StoreListing["support"] {
  const support = recordAt(root, "support", "support", issues);
  return {
    email: stringAt(support, "email", "support.email", issues),
    url: stringAt(support, "url", "support.url", issues),
  };
}

function parseListingCopy(
  root: Record<string, unknown>,
  issues: StoreListingIssue[],
): StoreListing["listing"] {
  const listing = recordAt(root, "listing", "listing", issues);
  return {
    name: stringAt(listing, "name", "listing.name", issues),
    shortDescription: stringAt(
      listing,
      "shortDescription",
      "listing.shortDescription",
      issues,
    ),
    currentVersionSummary: stringAt(
      listing,
      "currentVersionSummary",
      "listing.currentVersionSummary",
      issues,
    ),
    fullDescription: stringAt(listing, "fullDescription", "listing.fullDescription", issues),
  };
}

function parseDataDisclosures(
  privacy: Record<string, unknown>,
  issues: StoreListingIssue[],
): StoreListing["privacy"]["dataDisclosures"] {
  const disclosures = recordAt(
    privacy,
    "dataDisclosures",
    "privacy.dataDisclosures",
    issues,
  );
  return {
    handledLocally: localDataDisclosuresAt(
      disclosures,
      "handledLocally",
      "privacy.dataDisclosures.handledLocally",
      issues,
    ),
    collected: booleanAt(disclosures, "collected", "privacy.dataDisclosures.collected", issues),
    transmitted: booleanAt(
      disclosures,
      "transmitted",
      "privacy.dataDisclosures.transmitted",
      issues,
    ),
    sold: booleanAt(disclosures, "sold", "privacy.dataDisclosures.sold", issues),
    shared: booleanAt(disclosures, "shared", "privacy.dataDisclosures.shared", issues),
    usedForAdvertising: booleanAt(
      disclosures,
      "usedForAdvertising",
      "privacy.dataDisclosures.usedForAdvertising",
      issues,
    ),
    usedForCreditDecisions: booleanAt(
      disclosures,
      "usedForCreditDecisions",
      "privacy.dataDisclosures.usedForCreditDecisions",
      issues,
    ),
  };
}

function parsePrivacy(
  root: Record<string, unknown>,
  issues: StoreListingIssue[],
): StoreListing["privacy"] {
  const privacy = recordAt(root, "privacy", "privacy", issues);
  return {
    url: stringAt(privacy, "url", "privacy.url", issues),
    effectiveDate: stringAt(privacy, "effectiveDate", "privacy.effectiveDate", issues),
    singlePurpose: stringAt(privacy, "singlePurpose", "privacy.singlePurpose", issues),
    remoteCode: booleanAt(privacy, "remoteCode", "privacy.remoteCode", issues),
    permissions: stringRecordAt(privacy, "permissions", "privacy.permissions", issues),
    dataDisclosures: parseDataDisclosures(privacy, issues),
  };
}

function parseChromeStore(
  stores: Record<string, unknown>,
  issues: StoreListingIssue[],
): ChromeStoreListing {
  const chrome = recordAt(stores, "chrome", "stores.chrome", issues);
  return {
    state: stateAt(chrome, "state", "stores.chrome.state", issues),
    extensionId: nullableStringAt(chrome, "extensionId", "stores.chrome.extensionId", issues),
    publisherId: nullableStringAt(chrome, "publisherId", "stores.chrome.publisherId", issues),
    listingUrl: nullableStringAt(chrome, "listingUrl", "stores.chrome.listingUrl", issues),
  };
}

function parseFirefoxStore(
  stores: Record<string, unknown>,
  issues: StoreListingIssue[],
): FirefoxStoreListing {
  const firefox = recordAt(stores, "firefox", "stores.firefox", issues);
  return {
    state: stateAt(firefox, "state", "stores.firefox.state", issues),
    slug: nullableStringAt(firefox, "slug", "stores.firefox.slug", issues),
    extensionId: nullableStringAt(
      firefox,
      "extensionId",
      "stores.firefox.extensionId",
      issues,
    ),
    listingUrl: nullableStringAt(firefox, "listingUrl", "stores.firefox.listingUrl", issues),
  };
}

function parseStores(
  root: Record<string, unknown>,
  issues: StoreListingIssue[],
): StoreListing["stores"] {
  const stores = recordAt(root, "stores", "stores", issues);
  return {
    chrome: parseChromeStore(stores, issues),
    firefox: parseFirefoxStore(stores, issues),
  };
}

/**
 * Parses the untrusted JSON contract into its stable schema.
 *
 * @param value - Decoded JSON value.
 * @returns The typed store listing.
 * @throws {Error} When any required field has the wrong shape.
 */
export function parseStoreListing(value: unknown): StoreListing {
  const issues: StoreListingIssue[] = [];
  const root = recordValue(value, "store listing", issues);
  if (root.schemaVersion !== 1) {
    issues.push({ path: "schemaVersion", message: "must equal 1" });
  }

  const result: StoreListing = {
    schemaVersion: 1,
    support: parseSupport(root, issues),
    listing: parseListingCopy(root, issues),
    privacy: parsePrivacy(root, issues),
    stores: parseStores(root, issues),
  };

  if (issues.length > 0) throw new StoreListingParseError(issues);
  return result;
}

function addExactValueIssue(
  issues: StoreListingIssue[],
  path: string,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) issues.push({ path, message: `must equal ${expected}` });
}

function addLengthIssue(
  issues: StoreListingIssue[],
  path: string,
  value: string,
  maximum: number,
): void {
  if (value.length > maximum) {
    issues.push({ path, message: `must not exceed ${maximum} characters` });
  }
}

function isCanonicalCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function hasCanonicalUrlComponents(url: URL): boolean {
  return url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "";
}

function expectedPermissions(): readonly string[] {
  const chromePermissions = forChrome().permissions as readonly string[];
  const firefoxPermissions = forFirefox().permissions as readonly string[];
  return [...new Set([...chromePermissions, ...firefoxPermissions])];
}

function validatePermissionExplanations(
  permissions: Record<string, string>,
): StoreListingIssue[] {
  const issues: StoreListingIssue[] = [];
  const expected = expectedPermissions();
  for (const permission of expected) {
    if (!(permission in permissions)) {
      issues.push({
        path: `privacy.permissions.${permission}`,
        message: "must explain every generated manifest permission",
      });
      continue;
    }
    addLengthIssue(
      issues,
      `privacy.permissions.${permission}`,
      permissions[permission] ?? "",
      MAX_PRIVACY_FIELD_CHARACTERS,
    );
  }
  for (const permission of Object.keys(permissions).sort()) {
    if (!expected.includes(permission)) {
      issues.push({
        path: `privacy.permissions.${permission}`,
        message: "does not correspond to a generated manifest permission",
      });
    }
  }
  return issues;
}

function isChromeListingUrl(value: string, extensionId: string): boolean {
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return hasCanonicalUrlComponents(url) &&
      url.hostname === "chromewebstore.google.com" &&
      pathSegments.length === 3 &&
      pathSegments[0] === "detail" &&
      /^[a-z0-9-]+$/.test(pathSegments[1] ?? "") &&
      pathSegments[2] === extensionId;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function isFirefoxListingUrl(value: string, slug: string): boolean {
  try {
    const url = new URL(value);
    return hasCanonicalUrlComponents(url) &&
      url.hostname === "addons.mozilla.org" &&
      /^[a-z0-9-]+$/.test(slug) &&
      url.pathname.replace(/\/$/, "") === `/firefox/addon/${slug}`;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function validateChromeStore(store: ChromeStoreListing): StoreListingIssue[] {
  const issues: StoreListingIssue[] = [];
  if (store.extensionId !== null && !/^[a-p]{32}$/.test(store.extensionId)) {
    issues.push({
      path: "stores.chrome.extensionId",
      message: "must be a 32-character Chrome extension ID",
    });
  }
  if (store.state !== "published") {
    if (store.listingUrl !== null) {
      issues.push({
        path: "stores.chrome.listingUrl",
        message: "must remain null until the listing is published",
      });
    }
    return issues;
  }
  if (store.extensionId === null) {
    issues.push({ path: "stores.chrome.extensionId", message: "is required when published" });
  }
  if (store.publisherId === null) {
    issues.push({ path: "stores.chrome.publisherId", message: "is required when published" });
  }
  if (store.listingUrl === null) {
    issues.push({ path: "stores.chrome.listingUrl", message: "is required when published" });
  } else if (
    store.extensionId !== null && !isChromeListingUrl(store.listingUrl, store.extensionId)
  ) {
    issues.push({
      path: "stores.chrome.listingUrl",
      message: "must be the canonical HTTPS listing URL",
    });
  }
  return issues;
}

function validateFirefoxStore(store: FirefoxStoreListing): StoreListingIssue[] {
  const issues: StoreListingIssue[] = [];
  if (store.extensionId !== FIREFOX_EXTENSION_ID) {
    issues.push({
      path: "stores.firefox.extensionId",
      message: `must equal ${FIREFOX_EXTENSION_ID}`,
    });
  }
  if (store.state !== "published") {
    if (store.listingUrl !== null) {
      issues.push({
        path: "stores.firefox.listingUrl",
        message: "must remain null until the listing is published",
      });
    }
    return issues;
  }
  if (store.slug === null) {
    issues.push({ path: "stores.firefox.slug", message: "is required when published" });
  }
  if (store.listingUrl === null) {
    issues.push({ path: "stores.firefox.listingUrl", message: "is required when published" });
  } else if (store.slug !== null && !isFirefoxListingUrl(store.listingUrl, store.slug)) {
    issues.push({
      path: "stores.firefox.listingUrl",
      message: "must be the canonical HTTPS listing URL",
    });
  }
  return issues;
}

function validateDataDisclosures(listing: StoreListing): StoreListingIssue[] {
  const issues: StoreListingIssue[] = [];
  const disclosure = listing.privacy.dataDisclosures;
  const categories = new Set(disclosure.handledLocally.map(({ category }) => category));
  for (const category of REQUIRED_LOCAL_DATA_CATEGORIES) {
    if (!categories.has(category)) {
      issues.push({
        path: `privacy.dataDisclosures.handledLocally.${category}`,
        message: "must disclose this locally processed data category",
      });
    }
  }
  const falseDeclarations = [
    "collected",
    "transmitted",
    "sold",
    "shared",
    "usedForAdvertising",
    "usedForCreditDecisions",
  ] as const;
  for (const declaration of falseDeclarations) {
    if (disclosure[declaration]) {
      issues.push({
        path: `privacy.dataDisclosures.${declaration}`,
        message: "must remain false for the local-only extension",
      });
    }
  }
  return issues;
}

async function publicSourceFiles(root: URL): Promise<readonly URL[]> {
  const files: URL[] = [];
  async function visit(url: URL): Promise<void> {
    let information: Deno.FileInfo;
    try {
      information = await Deno.stat(url);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return;
      throw error;
    }
    if (information.isFile) {
      files.push(url);
      return;
    }
    if (!information.isDirectory) return;
    const entries = [];
    for await (const entry of Deno.readDir(url)) entries.push(entry);
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await visit(new URL(entry.isDirectory ? `${entry.name}/` : entry.name, url));
    }
  }
  for (const surfacePath of PUBLIC_SURFACE_PATHS) {
    await visit(new URL(surfacePath, root));
  }
  return files.sort((left, right) =>
    relative(fromFileUrl(root), fromFileUrl(left)).localeCompare(
      relative(fromFileUrl(root), fromFileUrl(right)),
    )
  );
}

async function validatePublicSurfaceSentinels(root: URL): Promise<StoreListingIssue[]> {
  const issues: StoreListingIssue[] = [];
  const files = await publicSourceFiles(root);
  for (const file of files) {
    const content = await Deno.readTextFile(file);
    const hasSentinel = STORE_URL_SENTINELS.some((sentinel) => content.includes(sentinel));
    const hasDummyUrl = DUMMY_STORE_URL_PATTERNS.some((pattern) => pattern.test(content));
    if (hasSentinel || hasDummyUrl) {
      issues.push({
        path: relative(fromFileUrl(root), fromFileUrl(file)),
        message: "contains a placeholder store URL sentinel",
      });
    }
  }
  return issues;
}

/**
 * Validates the canonical contract against vendor limits, generated manifests, and public sources.
 *
 * @param root - Repository root containing `store-listing.json`.
 * @returns Every detected issue in deterministic path order.
 */
export async function validateStoreListing(root: URL): Promise<readonly StoreListingIssue[]> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(await Deno.readTextFile(new URL(STORE_LISTING_FILE, root)));
  } catch (error) {
    return [{
      path: STORE_LISTING_FILE,
      message: error instanceof Error ? error.message : String(error),
    }];
  }

  let storeListing: StoreListing;
  try {
    storeListing = parseStoreListing(decoded);
  } catch (error) {
    if (error instanceof StoreListingParseError) return error.issues;
    throw error;
  }

  const issues: StoreListingIssue[] = [];
  addExactValueIssue(issues, "support.email", storeListing.support.email, SUPPORT_EMAIL);
  addExactValueIssue(issues, "support.url", storeListing.support.url, SUPPORT_URL);
  addExactValueIssue(issues, "privacy.url", storeListing.privacy.url, PRIVACY_URL);
  addExactValueIssue(issues, "listing.name", storeListing.listing.name, manifestBase.name);
  addExactValueIssue(
    issues,
    "listing.shortDescription",
    storeListing.listing.shortDescription,
    manifestBase.description,
  );
  addLengthIssue(
    issues,
    "listing.shortDescription",
    storeListing.listing.shortDescription,
    MAX_SHORT_DESCRIPTION_CHARACTERS,
  );
  addLengthIssue(
    issues,
    "listing.fullDescription",
    storeListing.listing.fullDescription,
    MAX_FULL_DESCRIPTION_CHARACTERS,
  );
  if (!storeListing.listing.fullDescription.includes(storeListing.listing.currentVersionSummary)) {
    issues.push({
      path: "listing.fullDescription",
      message: "must include listing.currentVersionSummary verbatim",
    });
  }
  if (!storeListing.listing.fullDescription.includes(SUPPORT_EMAIL)) {
    issues.push({
      path: "listing.fullDescription",
      message: `must include ${SUPPORT_EMAIL}`,
    });
  }
  if (!isCanonicalCalendarDate(storeListing.privacy.effectiveDate)) {
    issues.push({
      path: "privacy.effectiveDate",
      message: "must be a real calendar date in YYYY-MM-DD format",
    });
  }
  addLengthIssue(
    issues,
    "privacy.singlePurpose",
    storeListing.privacy.singlePurpose,
    MAX_PRIVACY_FIELD_CHARACTERS,
  );
  if (storeListing.privacy.remoteCode) {
    issues.push({ path: "privacy.remoteCode", message: "must remain false" });
  }
  issues.push(...validatePermissionExplanations(storeListing.privacy.permissions));
  issues.push(...validateDataDisclosures(storeListing));
  issues.push(...validateChromeStore(storeListing.stores.chrome));
  issues.push(...validateFirefoxStore(storeListing.stores.firefox));
  issues.push(...await validatePublicSurfaceSentinels(root));
  return issues;
}

async function runCheck(): Promise<void> {
  if (Deno.args.length !== 1 || Deno.args[0] !== "check") {
    throw new Error("Usage: deno task store:check");
  }
  const root = new URL("../", import.meta.url);
  const issues = await validateStoreListing(root);
  if (issues.length > 0) {
    throw new Error(`Store listing validation failed:\n${issues.map(formatIssue).join("\n")}`);
  }
  console.log("store:check passed");
}

if (import.meta.main) await runCheck();
