import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createInstallActionsModel } from "../src/lib/install-actions.mjs";
import { getInstallRecommendation } from "../src/lib/install-recommendation.ts";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function listing({ chrome, firefox }) {
  return {
    privacy: {
      singlePurpose:
        "Point & Shoot lets a user select a UI problem on the active page, annotate it, and export local visual and structural evidence for a coding agent.",
    },
    stores: {
      chrome,
      firefox,
    },
  };
}

function store(state, listingUrl = null) {
  return { listingUrl, state };
}

async function buildSite() {
  await new Promise((resolveBuild, reject) => {
    execFile("npm", ["run", "build"], { cwd: siteRoot }, (error, stdout, stderr) => {
      if (error === null) {
        resolveBuild();
        return;
      }
      reject(new Error(`site build failed:\n${stdout}\n${stderr}`));
    });
  });
}

test("models unpublished, partial, and published store actions from canonical listing data", () => {
  const unpublished = createInstallActionsModel(
    listing({ chrome: store("unpublished"), firefox: store("unpublished") }),
  );
  assert.deepEqual(unpublished.actions, []);
  assert.equal(unpublished.sourceIsPrimary, true);
  assert.match(unpublished.statuses.join(" "), /Chrome Web Store listing is unpublished/);
  assert.match(unpublished.statuses.join(" "), /Firefox Add-ons listing is unpublished/);

  const chromeUrl = "https://chromewebstore.google.com/detail/point-and-shoot/abcdefghijklmnop";
  const firefoxUrl = "https://addons.mozilla.org/firefox/addon/point-and-shoot/";
  const onePublished = createInstallActionsModel(
    listing({ chrome: store("published", chromeUrl), firefox: store("in-review") }),
  );
  assert.deepEqual(
    onePublished.actions.map((action) => action.url),
    [chromeUrl],
  );
  assert.equal(onePublished.sourceIsPrimary, false);
  assert.match(onePublished.statuses.join(" "), /Firefox Add-ons listing is in review/);

  const bothPublished = createInstallActionsModel(
    listing({ chrome: store("published", chromeUrl), firefox: store("published", firefoxUrl) }),
  );
  assert.deepEqual(
    bothPublished.actions.map((action) => [action.name, action.target, action.url]),
    [
      ["Chrome Web Store", "chromium", chromeUrl],
      ["Firefox Add-ons", "gecko", firefoxUrl],
    ],
  );
});

test("recommendations only change labels, attributes, and the single accent target", () => {
  assert.deepEqual(getInstallRecommendation("chromium"), {
    actionTarget: "chromium",
    announcement: "Chrome Web Store is recommended for this desktop browser.",
    label: "Recommended: install from Chrome Web Store",
  });
  assert.deepEqual(getInstallRecommendation("gecko"), {
    actionTarget: "gecko",
    announcement: "Firefox Add-ons is recommended for this desktop browser.",
    label: "Recommended: install from Firefox Add-ons",
  });
  assert.deepEqual(getInstallRecommendation("mobile-unsupported"), {
    actionTarget: null,
    announcement: "Desktop browser extension installation is unavailable on mobile.",
    label: null,
  });
  assert.deepEqual(getInstallRecommendation("unknown"), {
    actionTarget: null,
    announcement:
      "Safari support is deferred. Choose a supported desktop browser or build from source.",
    label: null,
  });
});

test("the built unpublished site provides accessible fallback, focus, motion, and responsive states", async () => {
  await buildSite();
  const [html, styles] = await Promise.all([
    readFile(resolve(siteRoot, "dist/index.html"), "utf8"),
    readFile(resolve(siteRoot, "src/styles/global.css"), "utf8"),
  ]);
  assert.match(html, /Build from source/);
  assert.match(html, /Chrome Web Store listing is unpublished/);
  assert.match(html, /Firefox Add-ons listing is unpublished/);
  assert.match(html, /data-no-script/);
  assert.equal((html.match(/<a[^>]*data-source-install/gu) ?? []).length, 2);
  assert.equal((html.match(/<p[^>]*data-install-status/gu) ?? []).length, 2);
  assert.match(html, /data-install-status role="status" aria-live="polite"/);
  assert.match(html, /href="\/privacy\/"/);
  assert.match(html, /mailto:support@pointandshoot\.app/);
  assert.doesNotMatch(html, /chromewebstore\.google\.com/);
  assert.doesNotMatch(html, /addons\.mozilla\.org/);
  assert.match(styles, /a:focus-visible/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.install-options/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
