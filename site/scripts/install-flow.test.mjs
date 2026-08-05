import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { createInstallActionsModel } from "../src/lib/install-actions.mjs";
import { getInstallRecommendation } from "../src/lib/install-recommendation.ts";
import { startBuiltSite } from "./serve-built.mjs";

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
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["task", "site:build"],
    cwd: siteRoot,
    stderr: "piped",
    stdout: "piped",
  }).output();
  const decoder = new TextDecoder();
  assert.equal(
    output.code,
    0,
    `site build failed:\n${decoder.decode(output.stdout)}\n${decoder.decode(output.stderr)}`,
  );
}

async function closeBuiltSite(server) {
  await new Promise((resolveClosed, reject) => {
    server.close((error) => (error === undefined ? resolveClosed() : reject(error)));
    server.closeAllConnections();
  });
}

async function storeFixture({ chrome = false, firefox = false, firefoxStatus = "unpublished" }) {
  const root = await mkdtemp(resolve(tmpdir(), "point-and-shoot-install-fixture-"));
  const distRoot = resolve(root, "dist");
  const indexPath = resolve(distRoot, "index.html");
  try {
    await cp(resolve(siteRoot, "dist"), distRoot, { recursive: true });
    const storeActions = [
      chrome
        ? '<div class="install-store"><a data-store-action="chromium" href="https://chromewebstore.google.com/detail/point-and-shoot/abcdefghijklmnop">Install from Chrome Web Store</a></div>'
        : "",
      firefox
        ? '<div class="install-store"><a data-store-action="gecko" href="https://addons.mozilla.org/firefox/addon/point-and-shoot/">Install from Firefox Add-ons</a></div>'
        : "",
    ].join("");
    const html = (await readFile(indexPath, "utf8"))
      .replaceAll('<div class="install-source">', `${storeActions}<div class="install-source">`)
      .replaceAll(
        "Firefox Add-ons listing is unpublished.",
        `Firefox Add-ons listing is ${firefoxStatus}.`,
      );
    await writeFile(indexPath, html);
    return { distRoot, root };
  } catch (error) {
    await rm(root, { force: true, recursive: true });
    throw error;
  }
}

Deno.test("models unpublished, partial, and published store actions from canonical listing data", () => {
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

Deno.test("recommendations only change labels, attributes, and the single accent target", () => {
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
  assert.deepEqual(getInstallRecommendation("chromium", new Set()), {
    actionTarget: null,
    announcement: null,
    label: null,
  });
  assert.deepEqual(getInstallRecommendation("chromium", new Set(["gecko"])), {
    actionTarget: null,
    announcement: null,
    label: null,
  });
  assert.deepEqual(getInstallRecommendation("gecko", new Set(["chromium"])), {
    actionTarget: null,
    announcement: null,
    label: null,
  });
});

Deno.test("the built unpublished site provides accessible fallback, focus, motion, and responsive states", async () => {
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
  assert.equal((html.match(/<p[^>]*data-install-recommendation/gu) ?? []).length, 1);
  assert.match(html, /data-install-recommendation role="status" aria-live="polite"/);
  assert.match(html, /href="\/privacy\/"/);
  assert.match(html, /mailto:support@pointandshoot\.app/);
  assert.doesNotMatch(html, /chromewebstore\.google\.com/);
  assert.doesNotMatch(html, /addons\.mozilla\.org/);
  assert.match(styles, /a:focus-visible/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.install-options/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

Deno.test("browser enhancement preserves unavailable-store status and keeps store choices operable", async () => {
  await buildSite();
  const browser = await chromium.launch();
  try {
    const unavailable = await startBuiltSite({ port: 0 });
    try {
      const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__pointAndShootFocusCalls = 0;
          const originalFocus = HTMLElement.prototype.focus;
          HTMLElement.prototype.focus = function (...argumentsList) {
            window.__pointAndShootFocusCalls += 1;
            return originalFocus.apply(this, argumentsList);
          };
        });
        await page.goto(`${unavailable.origin}/`, { waitUntil: "networkidle" });
        assert.match(
          await page.locator("[data-install-status]").first().textContent(),
          /Chrome Web Store listing is unpublished/,
        );
        assert.equal(await page.locator("[data-recommended]").count(), 0);
        assert.equal(await page.evaluate(() => window.__pointAndShootFocusCalls), 0);
      } finally {
        await context.close();
      }
    } finally {
      await closeBuiltSite(unavailable.server);
    }

    const firefoxOnlyFixture = await storeFixture({ firefox: true, firefoxStatus: "published" });
    try {
      const firefoxOnly = await startBuiltSite({ distRoot: firefoxOnlyFixture.distRoot, port: 0 });
      try {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.goto(`${firefoxOnly.origin}/`, { waitUntil: "networkidle" });
          assert.match(
            await page.locator("[data-install-status]").first().textContent(),
            /Chrome Web Store listing is unpublished/,
          );
          assert.equal(await page.locator('[data-store-action="gecko"]').count(), 2);
          assert.equal(await page.locator('[data-store-action="gecko"]').first().isVisible(), true);
          assert.equal(
            await page.locator('[data-store-action="gecko"]').first().getAttribute("href"),
            "https://addons.mozilla.org/firefox/addon/point-and-shoot/",
          );
          assert.equal(await page.locator("[data-recommended]").count(), 0);
        } finally {
          await context.close();
        }

        const compatibleContext = await browser.newContext({
          userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
        });
        try {
          const page = await compatibleContext.newPage();
          await page.goto(`${firefoxOnly.origin}/`, { waitUntil: "networkidle" });
          assert.match(
            await page.locator("[data-install-status]").first().textContent(),
            /Chrome Web Store listing is unpublished/,
          );
          assert.equal(await page.locator("[data-install-recommendation]").count(), 1);
          assert.match(
            await page.locator("[data-install-recommendation]").textContent(),
            /Firefox Add-ons is recommended/,
          );
          assert.equal(await page.locator('[role="status"]').count(), 1);
        } finally {
          await compatibleContext.close();
        }
      } finally {
        await closeBuiltSite(firefoxOnly.server);
      }
    } finally {
      await rm(firefoxOnlyFixture.root, { force: true, recursive: true });
    }

    const bothFixture = await storeFixture({ chrome: true, firefox: true });
    try {
      const both = await startBuiltSite({ distRoot: bothFixture.distRoot, port: 0 });
      try {
        const desktop = await browser.newContext({ viewport: { height: 900, width: 1440 } });
        try {
          const page = await desktop.newPage();
          await page.goto(`${both.origin}/`, { waitUntil: "networkidle" });
          assert.equal(await page.locator('[data-store-action="chromium"]').count(), 2);
          assert.equal(await page.locator('[data-store-action="gecko"]').count(), 2);
          assert.equal(
            await page.locator('[data-store-action="chromium"]').first().isVisible(),
            true,
          );
          assert.equal(await page.locator('[data-store-action="gecko"]').first().isVisible(), true);
          assert.equal(
            await page.locator('[data-store-action="chromium"][data-recommended]').count(),
            2,
          );
          assert.equal(
            await page.locator('[data-store-action="gecko"][data-recommended]').count(),
            0,
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            true,
          );

          const focusedStoreTargets = new Set();
          for (let index = 0; index < 12; index += 1) {
            await page.keyboard.press("Tab");
            const target = await page.evaluate(
              () => document.activeElement?.getAttribute("data-store-action") ?? null,
            );
            if (target !== null) {
              focusedStoreTargets.add(target);
            }
          }
          assert.deepEqual(focusedStoreTargets, new Set(["chromium", "gecko"]));
        } finally {
          await desktop.close();
        }

        const gecko = await browser.newContext({
          userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
          viewport: { height: 900, width: 1440 },
        });
        try {
          const page = await gecko.newPage();
          await page.goto(`${both.origin}/`, { waitUntil: "networkidle" });
          assert.equal(
            await page.locator('[data-store-action="gecko"][data-recommended]').count(),
            2,
          );
          assert.equal(
            await page.locator('[data-store-action="chromium"][data-recommended]').count(),
            0,
          );
        } finally {
          await gecko.close();
        }

        const zoomed = await browser.newContext({ viewport: { height: 450, width: 640 } });
        try {
          const page = await zoomed.newPage();
          await page.goto(`${both.origin}/`, { waitUntil: "networkidle" });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            true,
          );
        } finally {
          await zoomed.close();
        }

        const mobile = await browser.newContext({
          hasTouch: true,
          isMobile: true,
          userAgent:
            "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
          viewport: { height: 844, width: 320 },
        });
        try {
          const page = await mobile.newPage();
          await page.goto(`${both.origin}/`, { waitUntil: "networkidle" });
          assert.match(
            await page.locator("[data-install-recommendation]").textContent(),
            /Desktop browser extension installation is unavailable on mobile/,
          );
          assert.equal(await page.locator("[data-recommended]").count(), 0);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            true,
          );
        } finally {
          await mobile.close();
        }

        const withoutJavaScript = await browser.newContext({ javaScriptEnabled: false });
        try {
          const page = await withoutJavaScript.newPage();
          await page.goto(`${both.origin}/`, { waitUntil: "networkidle" });
          assert.equal(await page.locator("[data-no-script]").count(), 2);
          assert.equal(await page.locator('[data-store-action="chromium"]').count(), 2);
          assert.equal(await page.locator('[data-store-action="gecko"]').count(), 2);
        } finally {
          await withoutJavaScript.close();
        }
      } finally {
        await closeBuiltSite(both.server);
      }
    } finally {
      await rm(bothFixture.root, { force: true, recursive: true });
    }
  } finally {
    await browser.close();
  }
});
