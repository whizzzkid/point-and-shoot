import assert from "node:assert/strict";
import test from "node:test";

import { testing } from "../src/markdown/remark-docs-links.mjs";

const sourcePath = "/repository/docs/specs/example.md";
const docsRoot = "/repository/docs";

test("docs links preserve published routes and repository-only references", () => {
  assert.equal(
    testing.rewriteRelativeUrl("../design.md#tokens", sourcePath, docsRoot),
    "/docs/design/#tokens",
  );
  assert.equal(
    testing.rewriteRelativeUrl("../adr/0001-example.md", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/blob/main/docs/adr/0001-example.md",
  );
});

test("docs links send code and directory references back to GitHub", () => {
  assert.equal(
    testing.rewriteRelativeUrl("../../src/shared/schema.ts", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/blob/main/src/shared/schema.ts",
  );
  assert.equal(
    testing.rewriteRelativeUrl("../../.claude-design/point-and-shoot/", sourcePath, docsRoot),
    "https://github.com/whizzzkid/point-and-shoot/tree/main/.claude-design/point-and-shoot",
  );
});
