import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { startBuiltSite } from "./serve-built.mjs";

const surfaces = [
  { name: "marketing", path: "/" },
  { name: "documentation", path: "/docs/" },
  { name: "privacy policy", path: "/privacy/" },
];

function formatViolation(surface, violation) {
  const targets = violation.nodes.flatMap((node) => node.target).join(", ");
  return `${surface}: ${violation.id} (${violation.impact}) at ${targets}: ${violation.help}`;
}

const probeFailure = Deno.env.get("PNS_A11Y_PROBE") === "1";
const failures = [];
const browser = await chromium.launch();

try {
  const { origin, server } = await startBuiltSite({ port: 0 });
  try {
    for (const surface of surfaces) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(message.text());
          }
        });
        await page.goto(`${origin}${surface.path}`, { waitUntil: "networkidle" });
        if (probeFailure) {
          await page.addStyleTag({
            content: "body, body * { color: rgb(119 119 119) !important; " +
              "background-color: rgb(119 119 119) !important; }",
          });
        }

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        failures.push(
          ...results.violations
            .filter(
              (violation) => violation.impact === "serious" || violation.impact === "critical",
            )
            .map((violation) => formatViolation(surface.name, violation)),
        );
        failures.push(
          ...consoleErrors.map((message) => `${surface.name}: console error: ${message}`),
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await new Promise((resolveClosed, reject) => {
      server.close((error) => (error === undefined ? resolveClosed() : reject(error)));
    });
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  throw new Error(`Accessibility check failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
}

console.log(`Axe found no serious or critical violations on ${surfaces.length} surfaces.`);
