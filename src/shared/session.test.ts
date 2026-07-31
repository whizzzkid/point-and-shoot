import { assertEquals } from "@std/assert";
import type { Session } from "./schema.ts";
import {
  DEFAULT_EXPORT_SIZE_BUDGET_BYTES,
  nextSessionRevision,
  pageUrlForExport,
  projectedSessionSize,
  shouldStripQueryByDefault,
} from "./session.ts";

const SESSION: Session = {
  createdAt: "2026-07-28T12:00:00.000Z",
  endedAt: null,
  id: "session-1",
  name: "Checkout review",
  notes: [],
  schemaVersion: 1,
};

Deno.test("nextSessionRevision advances valid revisions and resets invalid values", () => {
  assertEquals(nextSessionRevision(4), 5);
  assertEquals(nextSessionRevision("stale"), 1);
  assertEquals(nextSessionRevision(-1), 1);
  assertEquals(nextSessionRevision(Number.MAX_SAFE_INTEGER), 1);
});

Deno.test("shouldStripQueryByDefault detects sensitive parameter names case-insensitively", () => {
  for (
    const url of [
      "https://example.com/path?access_token=secret",
      "https://example.com/path?api_key=secret",
      "https://example.com/path?clientSecret=secret",
      "https://example.com/path?Authorization=secret",
      "https://example.com/path?SessionId=secret",
    ]
  ) {
    assertEquals(shouldStripQueryByDefault(url), true, url);
  }
  assertEquals(shouldStripQueryByDefault("https://example.com/path?page=2&sort=name"), false);
  assertEquals(shouldStripQueryByDefault("not a URL"), false);
});

Deno.test("pageUrlForExport removes only the query when a note opts in", () => {
  const recorded = "https://example.com/path?access_token=secret#details";
  assertEquals(pageUrlForExport(recorded, true), "https://example.com/path#details");
  assertEquals(pageUrlForExport(recorded, false), recorded);
  assertEquals(pageUrlForExport("not a URL", true), "not a URL");
});

Deno.test("projectedSessionSize measures canonical UTF-8 JSON against the settled budget", () => {
  const expected = new TextEncoder().encode(JSON.stringify(SESSION)).byteLength;
  assertEquals(projectedSessionSize(SESSION), expected);
  assertEquals(DEFAULT_EXPORT_SIZE_BUDGET_BYTES, 2_000_000);
});
