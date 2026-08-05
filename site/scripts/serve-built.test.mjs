import { assertEquals, assertMatch } from "@std/assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { startBuiltSite } from "./serve-built.mjs";

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "point-and-shoot-server-"));
  const distRoot = resolve(root, "dist");
  await mkdir(distRoot);
  await writeFile(resolve(distRoot, "index.html"), "<h1>Point & Shoot</h1>");
  const builtSite = await startBuiltSite({ distRoot, port: 0 });
  return { ...builtSite, root };
}

async function closeFixture({ root, server }) {
  await new Promise((resolveClosed, reject) => {
    server.close((error) => (error === undefined ? resolveClosed() : reject(error)));
  });
  await rm(root, { force: true, recursive: true });
}

Deno.test("built-site server serves files from the custom-domain root", async () => {
  const builtSite = await fixture();
  try {
    const response = await fetch(`${builtSite.origin}/`);
    assertEquals(response.status, 200);
    assertMatch(await response.text(), /Point & Shoot/);
  } finally {
    await closeFixture(builtSite);
  }
});

Deno.test("built-site server returns not found for missing paths", async () => {
  const builtSite = await fixture();
  try {
    const response = await fetch(`${builtSite.origin}/outside/`);
    assertEquals(response.status, 404);
  } finally {
    await closeFixture(builtSite);
  }
});

Deno.test("built-site server rejects malformed percent-encoding without crashing", async () => {
  const builtSite = await fixture();
  try {
    const response = await fetch(`${builtSite.origin}/%E0%A4%A`);
    assertEquals(response.status, 404);
  } finally {
    await closeFixture(builtSite);
  }
});
