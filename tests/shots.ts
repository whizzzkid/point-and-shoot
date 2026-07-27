/**
 * Captures a full-page screenshot of every fixture page into `docs/assets/wave-1/`.
 *
 * Wave 1 ships no extension, so the fixture app is the only visible artifact a PR can show. This
 * task shoots it, and in doing so proves the Playwright plumbing works before waves 2 and 4 depend
 * on it for real E2E coverage.
 *
 * Determinism is the point of the fixed viewport: these PNGs are committed, so a viewport that
 * varied by machine would produce a diff on every run and the images would stop being reviewable.
 *
 * Run with `deno task shots`. Needs the browser binary once:
 * `deno run -A npm:playwright@1.62.0 install chromium`.
 *
 * @module
 */

import { chromium } from "playwright";
import { startFixtureServer } from "./fixtures/app/server.ts";

/** Fixed viewport so committed screenshots are comparable across runs and machines. */
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Pages to shoot, in the order they appear in the PR.
 *
 * Explicit rather than globbed: a glob would silently start shooting a page added for an unrelated
 * reason, and the order — ordinary page first — is what makes the set readable as a sequence.
 */
const PAGES = [
  "index.html",
  "shadow.html",
  "iframe.html",
  "canvas.html",
  "tall.html",
  "dark.html",
  "light.html",
] as const;

/** Directory the PNGs are written to, relative to the repository root. */
const OUTPUT_DIR = "docs/assets/wave-1";

/**
 * Shoots every page in {@link PAGES} and writes one PNG per page.
 *
 * @throws {Error} When a page logs a console error, since a fixture with a broken script produces
 *   a screenshot that looks fine and test failures three waves later.
 */
async function main(): Promise<void> {
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  const fixture = startFixtureServer();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: VIEWPORT });

    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`${page.url()}: ${error.message}`));

    for (const name of PAGES) {
      await page.goto(`${fixture.base}/${name}`, { waitUntil: "load" });

      // The cross-origin frame and the canvas script settle a tick after load; without this the
      // shot of iframe.html can catch an empty frame.
      await page.waitForTimeout(250);

      const path = `${OUTPUT_DIR}/${name.replace(/\.html$/, "")}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log(`wrote ${path}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`fixture pages logged console errors:\n${consoleErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
    await fixture.close();
  }
}

if (import.meta.main) {
  await main();
}
