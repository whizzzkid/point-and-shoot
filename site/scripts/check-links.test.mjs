import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { checkSite } from "./check-links.mjs";

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "point-and-shoot-site-"));
  const distRoot = resolve(root, "dist");
  const docsRoot = resolve(root, "docs");
  await mkdir(resolve(distRoot, "docs"), { recursive: true });
  await mkdir(docsRoot, { recursive: true });
  await writeFile(resolve(distRoot, "index.html"), '<h1 id="home">Home</h1>');
  await writeFile(
    resolve(distRoot, "docs/index.html"),
    '<h1 id="docs">Docs</h1><a href="/point-and-shoot/#home">Home</a>',
  );
  await writeFile(resolve(docsRoot, "README.md"), "# Docs\n");
  return { distRoot, docsRoot, root };
}

test("site integrity accepts a complete published set", async () => {
  const paths = await fixture();
  try {
    const summary = await checkSite(paths);
    assert.equal(summary.pages, 2);
    assert.equal(summary.publishedDocs, 1);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects a broken internal anchor", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<a href="/point-and-shoot/#missing">Broken</a>',
    );
    await assert.rejects(checkSite(paths), /missing anchor #missing/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects a product doc without an output page", async () => {
  const paths = await fixture();
  try {
    await mkdir(resolve(paths.docsRoot, "specs"));
    await writeFile(resolve(paths.docsRoot, "specs/missing.md"), "# Missing\n");
    await assert.rejects(checkSite(paths), /Missing output page for docs\/specs\/missing\.md/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects a remote resource embedded in CSS", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<style>@import url("https://fonts.example.test/family.css");</style>',
    );
    await assert.rejects(checkSite(paths), /remote resource is not allowed/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});
