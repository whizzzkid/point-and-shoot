import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { checkSite, parseHttpStatus } from "./check-links.mjs";

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "point-and-shoot-site-"));
  const distRoot = resolve(root, "dist");
  const docsRoot = resolve(root, "docs");
  const siteUrl = "https://pages.example.test";
  await mkdir(resolve(distRoot, "docs"), { recursive: true });
  await mkdir(docsRoot, { recursive: true });
  await writeFile(
    resolve(distRoot, "index.html"),
    '<link rel="canonical" href="https://pages.example.test/"><h1 id="home">Home</h1>',
  );
  await writeFile(
    resolve(distRoot, "docs/index.html"),
    '<link rel="canonical" href="https://pages.example.test/docs/">' +
      '<h1 id="docs">Docs</h1><a href="/#home">Home</a>',
  );
  await writeFile(resolve(docsRoot, "README.md"), "# Docs\n");
  return { distRoot, docsRoot, root, siteUrl };
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
    await writeFile(resolve(paths.distRoot, "docs/index.html"), '<a href="/#missing">Broken</a>');
    await assert.rejects(checkSite(paths), /missing anchor #missing/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects the obsolete repository prefix on assets", async () => {
  const paths = await fixture();
  try {
    await mkdir(resolve(paths.distRoot, "brand"));
    await writeFile(resolve(paths.distRoot, "brand/icon.svg"), "<svg></svg>");
    await writeFile(
      resolve(paths.distRoot, "index.html"),
      '<img src="/point-and-shoot/brand/icon.svg" alt="">',
    );
    await writeFile(resolve(paths.distRoot, "docs/index.html"), "<h1>Docs</h1>");
    await assert.rejects(checkSite(paths), /missing target \/point-and-shoot\/brand\/icon\.svg/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects a canonical URL outside the configured Pages origin", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "index.html"),
      '<link rel="canonical" href="https://stale.example.test/"><h1 id="home">Home</h1>',
    );
    await assert.rejects(checkSite(paths), /unexpected canonical https:\/\/stale\.example\.test\//);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity requires exactly one canonical URL per page", async () => {
  const paths = await fixture();
  try {
    await writeFile(resolve(paths.distRoot, "index.html"), '<h1 id="home">Home</h1>');
    await assert.rejects(checkSite(paths), /expected one canonical link, found 0/);
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

test("site integrity rejects a quoted remote CSS import", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<style>@import "https://fonts.example.test/family.css";</style>',
    );
    await assert.rejects(checkSite(paths), /remote resource is not allowed/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("HTTP status parsing rejects an indeterminate curl response", () => {
  assert.equal(parseHttpStatus("200"), 200);
  assert.throws(() => parseHttpStatus(""), /invalid HTTP status/);
  assert.throws(() => parseHttpStatus("not-a-status"), /invalid HTTP status/);
});

test("site integrity reports a malformed URL", async () => {
  const paths = await fixture();
  try {
    await writeFile(resolve(paths.distRoot, "docs/index.html"), '<a href="https://%">Bad</a>');
    await assert.rejects(checkSite(paths), /malformed link https:\/\/%/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity accepts contact links", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<link rel="canonical" href="https://pages.example.test/docs/">' +
        '<a href="mailto:hello@example.test">Email</a><a href="tel:+15555550123">Call</a>',
    );
    await checkSite(paths);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity resolves same-repository main links from the checked worktree", async () => {
  const paths = await fixture();
  try {
    await mkdir(resolve(paths.docsRoot, "adr"));
    await writeFile(resolve(paths.docsRoot, "adr/0019-new.md"), "# New ADR\n");
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<link rel="canonical" href="https://pages.example.test/docs/">' +
        '<a href="https://github.com/whizzzkid/point-and-shoot/blob/main/docs/adr/0019-new.md">' +
        "New ADR</a>",
    );

    const summary = await checkSite(paths);
    assert.equal(summary.externalLinks, 0);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity rejects a missing same-repository main target locally", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<link rel="canonical" href="https://pages.example.test/docs/">' +
        '<a href="https://github.com/whizzzkid/point-and-shoot/blob/main/docs/adr/missing.md">' +
        "Missing ADR</a>",
    );

    await assert.rejects(checkSite(paths), /missing repository target docs\/adr\/missing\.md/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity keeps unrelated GitHub links in the external set", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<link rel="canonical" href="https://pages.example.test/docs/">' +
        '<a href="https://github.com/a2aproject/A2A">A2A</a>',
    );

    const summary = await checkSite(paths);
    assert.equal(summary.externalLinks, 1);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});

test("site integrity reports a malformed anchor encoding", async () => {
  const paths = await fixture();
  try {
    await writeFile(
      resolve(paths.distRoot, "docs/index.html"),
      '<a href="/#%E0%A4%A">Bad anchor</a>',
    );
    await assert.rejects(checkSite(paths), /malformed anchor #%E0%A4%A/);
  } finally {
    await rm(paths.root, { force: true, recursive: true });
  }
});
