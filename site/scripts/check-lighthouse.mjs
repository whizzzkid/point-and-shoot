import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

import { startBuiltSite } from "./serve-built.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportRoot = resolve(siteRoot, ".lighthouse");
const surfaces = [
  { name: "marketing", path: "/" },
  { name: "documentation", path: "/docs/" },
];
const thresholds = {
  accessibility: 1,
  "best-practices": 0.95,
  performance: 0.9,
  seo: 0.9,
};

await mkdir(reportRoot, { recursive: true });
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless", "--no-sandbox"],
});
const failures = [];

try {
  const { origin, server } = await startBuiltSite({ port: 0 });
  try {
    for (const surface of surfaces) {
      const result = await lighthouse(`${origin}${surface.path}`, {
        logLevel: "error",
        onlyCategories: Object.keys(thresholds),
        output: "json",
        port: chrome.port,
      });
      if (result === undefined) {
        throw new Error(`Lighthouse produced no result for ${surface.name}.`);
      }
      await writeFile(resolve(reportRoot, `${surface.name}.json`), result.report);

      for (const [category, minimum] of Object.entries(thresholds)) {
        const score = result.lhr.categories[category]?.score;
        if (score === null || score === undefined || score < minimum) {
          failures.push(
            `${surface.name}: ${category} scored ${score ?? "none"}, requires ${minimum}`,
          );
        }
      }
    }
  } finally {
    await new Promise((resolveClosed, reject) => {
      server.close((error) => (error === undefined ? resolveClosed() : reject(error)));
    });
  }
} finally {
  chrome.kill();
}

if (failures.length > 0) {
  throw new Error(
    `Lighthouse thresholds failed:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
}

console.log(`Lighthouse thresholds passed on ${surfaces.length} surfaces.`);
