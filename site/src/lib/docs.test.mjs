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
    "specs/design-system",
    "specs/store-publication",
    "tutorials/readme",
    "tutorials/getting-started",
  ]);
});

Deno.test("the flat prev/next order equals the section-grouped sidebar order", () => {
  // Mirrors the fixed section split in DocsSidebar.astro: Overview, then Specifications, then
  // Tutorials. The prev/next pagination walks the flat sortDocs order, so the two views agree only
  // when each section occupies a contiguous rank band. This pins the spec's guarantee that the
  // sidebar and the pagination cannot disagree.
  const all = [
    "readme",
    "design",
    "specs/readme",
    "specs/store-publication",
    "specs/build-release-and-verification",
    // Documents outside DOCS_ORDER (a future spec and a future tutorial) both take the fallback
    // rank. The alphabetical tiebreak keeps every "specs/" id ahead of every "tutorials/" id, so an
    // unlisted tutorial still lands in the tutorial band rather than interleaving with the specs.
    "specs/unlisted-later",
    "tutorials/unlisted-later",
    "tutorials/releasing",
    "tutorials/getting-started",
    "tutorials/readme",
    "tutorials/options",
  ].map(entry);

  const flat = sortDocs(all).map((item) => item.id);

  const inOrder = (predicate) =>
    sortDocs(all.filter((item) => predicate(item.id))).map((item) => item.id);
  const grouped = [
    ...inOrder((id) => id === "readme" || id === "design"),
    ...inOrder((id) => id.startsWith("specs/")),
    ...inOrder((id) => id.startsWith("tutorials/")),
  ];

  assertEquals(flat, grouped);
});

Deno.test("the Markdown extension and letter case do not change a document's rank", () => {
  const entries = ["tutorials/Releasing.md", "tutorials/getting-started.md"].map(entry);

  assertEquals(sortDocs(entries).map((item) => item.id), [
    "tutorials/getting-started.md",
    "tutorials/Releasing.md",
  ]);
});
