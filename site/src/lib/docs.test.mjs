import { assertEquals } from "@std/assert";

import { sortDocs } from "./docs.ts";

/**
 * Builds the minimal documentation entry shape `sortDocs` reads.
 *
 * @param {string} id - The collection entry ID.
 * @returns {{id: string}} A stand-in for an Astro content entry.
 */
function entry(id) {
  return { id };
}

Deno.test("tutorials sort into the user-story reading order rather than alphabetically", () => {
  const tutorials = [
    "tutorials/exporting",
    "tutorials/releasing",
    "tutorials/getting-started",
    "tutorials/building-from-source",
    "tutorials/troubleshooting",
    "tutorials/playwright-companion",
    "tutorials/options",
    "tutorials/sessions",
  ].map(entry);

  assertEquals(sortDocs(tutorials).map((item) => item.id), [
    "tutorials/getting-started",
    "tutorials/options",
    "tutorials/sessions",
    "tutorials/exporting",
    "tutorials/playwright-companion",
    "tutorials/building-from-source",
    "tutorials/troubleshooting",
    "tutorials/releasing",
  ]);
});

Deno.test("index documents lead and specifications keep their alphabetical fallback", () => {
  const entries = [
    "tutorials/getting-started",
    "specs/store-publication",
    "design",
    "specs/readme",
    "readme",
    "specs/design-system",
    "tutorials/readme",
  ].map(entry);

  assertEquals(sortDocs(entries).map((item) => item.id), [
    "readme",
    "design",
    "specs/readme",
    "tutorials/readme",
    "specs/design-system",
    "specs/store-publication",
    "tutorials/getting-started",
  ]);
});

Deno.test("the Markdown extension and letter case do not change a document's rank", () => {
  const entries = ["tutorials/Releasing.md", "tutorials/getting-started.md"].map(entry);

  assertEquals(sortDocs(entries).map((item) => item.id), [
    "tutorials/getting-started.md",
    "tutorials/Releasing.md",
  ]);
});
