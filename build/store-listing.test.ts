import { assertEquals, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import { FIREFOX_EXTENSION_ID, manifestBase } from "./manifest.ts";
import { parseStoreListing, type StoreListing, validateStoreListing } from "./store-listing.ts";

const CHROME_EXTENSION_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const REQUIRED_LOCAL_DATA_CATEGORIES = [
  "websiteContent",
  "webHistory",
  "userActivity",
  "userGeneratedContent",
] as const;

function validStoreListing(): StoreListing {
  const currentVersionSummary =
    "Capture annotated UI evidence and export a local fix prompt from Chrome or Firefox.";
  return {
    schemaVersion: 1,
    support: {
      email: "support@pointandshoot.app",
      url: "https://pointandshoot.app/",
    },
    listing: {
      name: "Point & Shoot",
      shortDescription: manifestBase.description,
      currentVersionSummary,
      fullDescription: [
        "Point & Shoot turns a UI problem into local evidence a coding agent can act on.",
        "",
        "Current version",
        "",
        currentVersionSummary,
        "",
        "Support",
        "",
        "Send support requests to support@pointandshoot.app.",
      ].join("\n"),
    },
    privacy: {
      url: "https://pointandshoot.app/privacy/",
      effectiveDate: "2026-08-04",
      singlePurpose:
        "Point & Shoot lets a user select a UI problem on the active page, annotate it, and export local visual and structural evidence for a coding agent.",
      remoteCode: false,
      permissions: {
        activeTab:
          "Temporarily accesses only the active tab after the user invokes Point & Shoot, so it can inspect the selected region and capture the visible page. It does not request persistent host access.",
        storage:
          "Saves extension settings and session pointers locally. Captures, screenshots, and notes remain in the browser's local IndexedDB storage until the user deletes them.",
        scripting:
          "Injects the packaged capture interface into the active tab after an explicit user gesture. It does not download or execute remote code.",
        downloads:
          "Creates a Markdown prompt or ZIP bundle only when the user chooses an export action.",
        clipboardWrite:
          "Copies the compiled prompt only when the user selects Copy prompt. The extension cannot read clipboard contents.",
        sidePanel:
          "Opens the Chrome review workspace where the user edits notes, compiles the prompt, and starts an export.",
      },
      dataDisclosures: {
        handledLocally: REQUIRED_LOCAL_DATA_CATEGORIES.map((category) => ({
          category,
          description: `The extension processes ${category} only on the user's device.`,
        })),
        collected: false,
        transmitted: false,
        sold: false,
        shared: false,
        usedForAdvertising: false,
        usedForCreditDecisions: false,
      },
    },
    stores: {
      chrome: {
        state: "unpublished",
        extensionId: null,
        publisherId: null,
        listingUrl: null,
      },
      firefox: {
        state: "unpublished",
        slug: null,
        extensionId: FIREFOX_EXTENSION_ID,
        listingUrl: null,
      },
    },
  };
}

async function validateFixture(
  listing: StoreListing,
  additionalFiles: Readonly<Record<string, string>> = {},
): Promise<readonly string[]> {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  try {
    await Deno.writeTextFile(
      new URL("store-listing.json", root),
      `${JSON.stringify(listing, null, 2)}\n`,
    );
    await Promise.all(
      Object.entries(additionalFiles).map(async ([relativePath, content]) => {
        const destination = new URL(relativePath, root);
        await Deno.mkdir(new URL("./", destination), { recursive: true });
        await Deno.writeTextFile(destination, content);
      }),
    );
    const issues = await validateStoreListing(root);
    return issues.map(({ path }) => path);
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
}

Deno.test("store listing - parses and validates the initial unpublished state", async () => {
  const listing = parseStoreListing(validStoreListing());
  assertEquals(listing.stores.chrome.listingUrl, null);
  assertEquals(listing.stores.firefox.listingUrl, null);
  assertEquals(await validateFixture(listing), []);
});

Deno.test("store listing - published stores require valid vendor identities and URLs", async () => {
  const missingIdentity = validStoreListing();
  missingIdentity.stores.chrome.state = "published";
  assertEquals(await validateFixture(missingIdentity), [
    "stores.chrome.extensionId",
    "stores.chrome.publisherId",
    "stores.chrome.listingUrl",
  ]);

  const published = validStoreListing();
  published.stores.chrome = {
    state: "published",
    extensionId: CHROME_EXTENSION_ID,
    publisherId: "point-and-shoot",
    listingUrl: `https://chromewebstore.google.com/detail/point-shoot/${CHROME_EXTENSION_ID}`,
  };
  published.stores.firefox = {
    state: "published",
    slug: "point-shoot",
    extensionId: FIREFOX_EXTENSION_ID,
    listingUrl: "https://addons.mozilla.org/firefox/addon/point-shoot/",
  };
  assertEquals(await validateFixture(published), []);
});

Deno.test("store listing - unpublished stores cannot expose public listing URLs", async () => {
  const listing = validStoreListing();
  listing.stores.chrome.listingUrl =
    `https://chromewebstore.google.com/detail/point-shoot/${CHROME_EXTENSION_ID}`;
  listing.stores.firefox.listingUrl = "https://addons.mozilla.org/firefox/addon/point-shoot/";
  assertEquals(await validateFixture(listing), [
    "stores.chrome.listingUrl",
    "stores.firefox.listingUrl",
  ]);
});

Deno.test("store listing - rejects wrong schemes, hosts, and identity paths", async () => {
  const listing = validStoreListing();
  listing.stores.chrome = {
    state: "published",
    extensionId: CHROME_EXTENSION_ID,
    publisherId: "point-and-shoot",
    listingUrl: `http://example.com/detail/${CHROME_EXTENSION_ID}`,
  };
  listing.stores.firefox = {
    state: "published",
    slug: "point-shoot",
    extensionId: FIREFOX_EXTENSION_ID,
    listingUrl: "https://addons.mozilla.org/firefox/addon/someone-else/",
  };
  assertEquals(await validateFixture(listing), [
    "stores.chrome.listingUrl",
    "stores.firefox.listingUrl",
  ]);
});

Deno.test("store listing - rejects malformed URLs and invalid Chrome extension IDs", async () => {
  const listing = validStoreListing();
  listing.stores.chrome = {
    state: "published",
    extensionId: "not-a-chrome-id",
    publisherId: "point-and-shoot",
    listingUrl: "not a URL",
  };
  assertEquals(await validateFixture(listing), [
    "stores.chrome.extensionId",
    "stores.chrome.listingUrl",
  ]);
});

Deno.test("store listing - validates non-null Chrome IDs before publication", async () => {
  const listing = validStoreListing();
  listing.stores.chrome.state = "submitted";
  listing.stores.chrome.extensionId = "not-a-chrome-id";
  listing.stores.chrome.publisherId = "point-and-shoot";
  assertEquals(await validateFixture(listing), ["stores.chrome.extensionId"]);
});

Deno.test("store listing - rejects non-canonical vendor URL components", async () => {
  const listing = validStoreListing();
  listing.stores.chrome = {
    state: "published",
    extensionId: CHROME_EXTENSION_ID,
    publisherId: "point-and-shoot",
    listingUrl:
      `https://user:pass@chromewebstore.google.com:444/detail/extra/path/${CHROME_EXTENSION_ID}?source=test#fragment`,
  };
  listing.stores.firefox = {
    state: "published",
    slug: "point-shoot",
    extensionId: FIREFOX_EXTENSION_ID,
    listingUrl:
      "https://user:pass@addons.mozilla.org:444/firefox/addon/point-shoot/?source=test#fragment",
  };
  assertEquals(await validateFixture(listing), [
    "stores.chrome.listingUrl",
    "stores.firefox.listingUrl",
  ]);
});

Deno.test("store listing - enforces store and privacy form character limits", async () => {
  const listing = validStoreListing();
  listing.listing.shortDescription = "s".repeat(133);
  listing.listing.fullDescription = "d".repeat(16_001);
  listing.privacy.singlePurpose = "p".repeat(1_001);
  listing.privacy.permissions.activeTab = "a".repeat(1_001);
  assertEquals(await validateFixture(listing), [
    "listing.shortDescription",
    "listing.shortDescription",
    "listing.fullDescription",
    "listing.fullDescription",
    "listing.fullDescription",
    "privacy.singlePurpose",
    "privacy.permissions.activeTab",
  ]);
});

Deno.test("store listing - permission explanations match the generated manifest union", async () => {
  const listing = validStoreListing();
  delete listing.privacy.permissions.activeTab;
  listing.privacy.permissions.tabs = "This permission is not requested.";
  assertEquals(await validateFixture(listing), [
    "privacy.permissions.activeTab",
    "privacy.permissions.tabs",
  ]);
});

Deno.test("store listing - Firefox identity stays aligned with the packaged manifest", async () => {
  const listing = validStoreListing();
  listing.stores.firefox.extensionId = "different@example.invalid";
  assertEquals(await validateFixture(listing), ["stores.firefox.extensionId"]);
});

Deno.test("store listing - remote code and required local data declarations fail closed", async () => {
  const listing = validStoreListing();
  listing.privacy.remoteCode = true;
  listing.privacy.dataDisclosures.handledLocally = listing.privacy.dataDisclosures.handledLocally
    .filter(({ category }) => category !== "websiteContent");
  listing.privacy.dataDisclosures.collected = true;
  assertEquals(await validateFixture(listing), [
    "privacy.remoteCode",
    "privacy.dataDisclosures.handledLocally.websiteContent",
    "privacy.dataDisclosures.collected",
  ]);
});

Deno.test("store listing - support, privacy, and current-version copy stay canonical", async () => {
  const listing = validStoreListing();
  listing.support.email = "help@example.invalid";
  listing.support.url = "https://example.invalid/";
  listing.privacy.url = "https://example.invalid/privacy/";
  listing.listing.name = "A different extension";
  listing.listing.shortDescription = "A different manifest description.";
  listing.listing.fullDescription = "The current-version summary is absent.";
  assertEquals(await validateFixture(listing), [
    "support.email",
    "support.url",
    "privacy.url",
    "listing.name",
    "listing.shortDescription",
    "listing.fullDescription",
    "listing.fullDescription",
  ]);
});

Deno.test("store listing - full description keeps the support address", async () => {
  const listing = validStoreListing();
  listing.listing.fullDescription = listing.listing.fullDescription.replace(
    "support@pointandshoot.app",
    "help@example.invalid",
  );
  assertEquals(await validateFixture(listing), ["listing.fullDescription"]);
});

Deno.test("store listing - effective date is a real canonical calendar date", async () => {
  for (const effectiveDate of ["not-a-date", "2026-02-30", "2026-8-4"]) {
    const listing = validStoreListing();
    listing.privacy.effectiveDate = effectiveDate;
    assertEquals(await validateFixture(listing), ["privacy.effectiveDate"]);
  }
});

Deno.test("store listing - rejects placeholder store URLs on public surfaces", async () => {
  const listing = validStoreListing();
  for (
    const publicCopy of [
      "Install from __CHROME_STORE_URL__ after publication.\n",
      "Install from https://chromewebstore.google.com/detail/placeholder after publication.\n",
    ]
  ) {
    assertEquals(await validateFixture(listing, { "README.md": publicCopy }), ["README.md"]);
  }
});

Deno.test("store listing - scans nested site and published documentation sources", async () => {
  const listing = validStoreListing();
  assertEquals(
    await validateFixture(listing, {
      "docs/specs/example.md": "Install from __CHROME_STORE_URL__.\n",
      "site/src/pages/install.astro": "Install from __FIREFOX_STORE_URL__.\n",
    }),
    ["docs/specs/example.md", "site/src/pages/install.astro"],
  );
});

Deno.test("store listing - parser rejects malformed schema values", () => {
  const listing = validStoreListing() as unknown as Record<string, unknown>;
  listing.schemaVersion = 2;
  assertThrows(() => parseStoreListing(listing), Error, "schemaVersion");
  assertThrows(() => parseStoreListing(null), Error, "store listing");
});
