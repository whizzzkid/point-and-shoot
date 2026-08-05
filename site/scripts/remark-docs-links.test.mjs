import { assertEquals } from "@std/assert";

import { testing } from "../src/markdown/remark-docs-links.mjs";

const sourcePath = "/repository/docs/specs/example.md";
const docsRoot = "/repository/docs";

Deno.test("docs links preserve published routes and repository-only references", () => {
  assertEquals(
    testing.rewriteRelativeUrl("../design.md#tokens", sourcePath, docsRoot),
    "/docs/design/#tokens",
  );
  assertEquals(
    testing.rewriteRelativeUrl("../adr/0001-example.md", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/blob/main/docs/adr/0001-example.md",
  );
});

Deno.test("docs links send code and directory references back to GitHub", () => {
  assertEquals(
    testing.rewriteRelativeUrl("../../src/shared/schema.ts", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/blob/main/src/shared/schema.ts",
  );
  assertEquals(
    testing.rewriteRelativeUrl("../../.claude-design/point-and-shoot/", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/tree/main/.claude-design/point-and-shoot",
  );
});
