import { assertEquals } from "@std/assert";

import { formatStarCount } from "./star-count.mjs";

Deno.test("star count renders small counts verbatim", () => {
  assertEquals(formatStarCount(1), "1");
  assertEquals(formatStarCount(42), "42");
  assertEquals(formatStarCount(999), "999");
});

Deno.test("star count collapses thousands and truncates instead of rounding", () => {
  assertEquals(formatStarCount(1000), "1k");
  assertEquals(formatStarCount(1234), "1.2k");
  assertEquals(formatStarCount(1949), "1.9k");
  assertEquals(formatStarCount(1999), "1.9k");
  assertEquals(formatStarCount(12345), "12.3k");
  assertEquals(formatStarCount(999999), "999.9k");
});

Deno.test("star count collapses millions rather than reporting four-digit thousands", () => {
  assertEquals(formatStarCount(1000000), "1m");
  assertEquals(formatStarCount(2500000), "2.5m");
});

Deno.test("star count rejects a failed or absent projection", () => {
  assertEquals(formatStarCount(null), null);
  assertEquals(formatStarCount(undefined), null);
  assertEquals(formatStarCount("1234"), null);
  assertEquals(formatStarCount({ stargazers_count: 12 }), null);
  assertEquals(formatStarCount(Number.NaN), null);
  assertEquals(formatStarCount(Number.POSITIVE_INFINITY), null);
});

Deno.test("star count rejects counts with nothing worth showing", () => {
  assertEquals(formatStarCount(0), null);
  assertEquals(formatStarCount(0.5), null);
  assertEquals(formatStarCount(-7), null);
});

Deno.test("star count floors a fractional count instead of inventing a decimal", () => {
  assertEquals(formatStarCount(42.9), "42");
});
