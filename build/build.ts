/**
 * Bundles every extension surface with esbuild and assembles `dist/chrome/` and `dist/firefox/` —
 * each a complete, loadable extension tree. `deno task build:release` (`--release`) additionally
 * minifies, drops sourcemaps, and zips each tree to `dist/<target>-<version>.zip`.
 *
 * Two esbuild passes run because the two output formats are load-bearing, not a style choice:
 * `background/background.js` is a Chrome MV3 module service worker but a Firefox MV3 classic
 * background script (see `build/manifest.ts`'s `forChrome`/`forFirefox`), and `content/content.js`
 * runs as a classic content script for cross-browser compatibility — both bundle
 * as IIFE. `sidepanel`/`popup`/`options` load via `<script type="module">` in their own HTML shells
 * (this script's own output, copied verbatim), so they bundle as ESM.
 *
 * @module
 */

import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { forChrome, forFirefox, manifestBase, SUPPORTED } from "./manifest.ts";
import { extensionIconPng, ICON_SIZES } from "./icons.ts";
import { preactResolverPlugin } from "./preact.ts";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT);
const DIST = new URL("dist/", ROOT);

const TARGETS = ["chrome", "firefox"] as const;

type BuildOptions =
  | { readonly release: true; readonly outDir?: URL }
  | { readonly release: false; readonly branch: string; readonly outDir?: URL };

/** `esbuild.build()`'s `target` array, derived from `SUPPORTED` rather than hardcoded literals. */
export function esbuildTargetFrom(
  supported: { readonly chrome: number; readonly firefox: number },
): string[] {
  return [`chrome${supported.chrome}`, `firefox${supported.firefox}`];
}

/**
 * Formats the descriptive version shown by a development build.
 *
 * @param version Packaged numeric version used for browser update ordering.
 * @param branch Current git branch identifying the local build.
 * @returns A descriptive `<version>-dev-<branch>` label.
 * @throws When no branch is available to identify the development build.
 */
export function developmentVersionName(version: string, branch: string): string {
  if (branch === "") {
    throw new Error("build: cannot label a development build without a git branch");
  }
  return `${version}-dev-${branch}`;
}

const IIFE_ENTRY_POINTS: Record<string, string> = {
  "background/background": fromFileUrl(new URL("background/index.ts", SRC)),
  "content/content": fromFileUrl(new URL("content/index.ts", SRC)),
};

const ESM_ENTRY_POINTS: Record<string, string> = {
  "sidepanel/sidepanel": fromFileUrl(new URL("sidepanel/index.tsx", SRC)),
  "popup/popup": fromFileUrl(new URL("popup/index.tsx", SRC)),
  "options/options": fromFileUrl(new URL("options/index.tsx", SRC)),
};

const HTML_SHELLS: ReadonlyArray<{ readonly from: string; readonly to: string }> = [
  { from: "sidepanel/index.html", to: "sidepanel/sidepanel.html" },
  { from: "popup/index.html", to: "popup/popup.html" },
  { from: "options/index.html", to: "options/options.html" },
];

async function removeIfExists(target: URL): Promise<void> {
  try {
    await Deno.remove(target, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

/** Recursively copies `src` (a directory URL, trailing slash) into `dest`, creating `dest`. */
async function copyRecursive(src: URL, dest: URL): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    if (entry.isDirectory) {
      await copyRecursive(new URL(`${entry.name}/`, src), new URL(`${entry.name}/`, dest));
    } else {
      await Deno.copyFile(new URL(entry.name, src), new URL(entry.name, dest));
    }
  }
}

/**
 * Copies the manifest-relative design assets `build/manifest.ts`'s `WEB_ACCESSIBLE_RESOURCES` and
 * the HTML shells reference — the vendored fonts, icon sprite, and generated token CSS — preserving
 * the `src/shared/design/` path both rely on, not the whole design dir (its
 * `.ts` sources have no runtime use in the shipped bundle).
 */
async function copyDesignAssets(targetDir: URL): Promise<void> {
  const designSrc = new URL("shared/design/", SRC);
  const designDest = new URL("src/shared/design/", targetDir);
  const fontsDest = new URL("fonts/", designDest);
  await Deno.mkdir(fontsDest, { recursive: true });
  await Deno.copyFile(new URL("icons.svg", designSrc), new URL("icons.svg", designDest));
  await Deno.copyFile(new URL("tokens.css", designSrc), new URL("tokens.css", designDest));
  const fontsSrc = new URL("fonts/", designSrc);
  for await (const entry of Deno.readDir(fontsSrc)) {
    if (entry.isFile && entry.name.endsWith(".woff2")) {
      await Deno.copyFile(new URL(entry.name, fontsSrc), new URL(entry.name, fontsDest));
    }
  }
}

async function writeIcons(targetDir: URL): Promise<void> {
  const iconsDir = new URL("icons/", targetDir);
  await Deno.mkdir(iconsDir, { recursive: true });
  for (const size of ICON_SIZES) {
    await Deno.writeFile(new URL(`icon-${size}.png`, iconsDir), await extensionIconPng(size));
  }
}

/** Recursively lists absolute paths of every `.js`/`.css`/`.html` file under `dir` containing a
 * literal `http://` or `https://` — ADR-0009 forbids the shipped extension from ever fetching
 * remote code or assets. */
/**
 * XML namespace identifiers, not fetchable URLs — Preact's DOM renderer embeds these verbatim to
 * pick `createElementNS` targets for `<svg>`/`<math>`/plain elements. Never dereferenced over the
 * network, so excluded before the remote-URL scan below rather than left to trip it.
 */
const XML_NAMESPACE_URIS = [
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xhtml",
  "http://www.w3.org/1999/xlink",
];

function withoutKnownNamespaceUris(text: string): string {
  return XML_NAMESPACE_URIS.reduce((sanitized, uri) => sanitized.split(uri).join(""), text);
}

export async function collectRemoteUrlOffenders(dir: URL): Promise<string[]> {
  const offenders: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) {
      offenders.push(...await collectRemoteUrlOffenders(new URL(`${entry.name}/`, dir)));
      continue;
    }
    // `.svg` is in the list because the icon sprite ships inside the extension and can carry a
    // remote reference in an `<image href>` or a `url()` fill — the namespace declarations that
    // every SVG carries are why `withoutKnownNamespaceUris` exists above.
    if (!/\.(js|css|html|json|svg)$/.test(entry.name)) continue;
    const fileUrl = new URL(entry.name, dir);
    const text = await Deno.readTextFile(fileUrl);
    if (/https?:\/\//.test(withoutKnownNamespaceUris(text))) offenders.push(fromFileUrl(fileUrl));
  }
  return offenders;
}

async function assertNoRemoteUrls(dir: URL): Promise<void> {
  const offenders = await collectRemoteUrlOffenders(dir);
  if (offenders.length > 0) {
    throw new Error(
      `build: ADR-0009 forbids remote assets — found an absolute http(s) URL in: ${
        offenders.join(", ")
      }`,
    );
  }
}

async function zipDir(dir: URL, outZip: URL): Promise<void> {
  await removeIfExists(outZip);
  const command = new Deno.Command("zip", {
    args: ["-r", "-X", fromFileUrl(outZip), "."],
    cwd: fromFileUrl(dir),
    stdout: "inherit",
    stderr: "inherit",
  });
  const { success, code } = await command.output();
  if (!success) {
    throw new Error(`build: \`zip\` exited with code ${code} while zipping ${fromFileUrl(dir)}`);
  }
}

async function currentGitBranch(): Promise<string> {
  const result = await new Deno.Command("git", {
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    cwd: fromFileUrl(ROOT),
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    const detail = new TextDecoder().decode(result.stderr).trim();
    throw new Error(
      `build: could not read the current git branch${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  return new TextDecoder().decode(result.stdout).trim();
}

/**
 * Resolves the branch identifying a development build without requiring git in GitHub Actions.
 *
 * @param environment Environment reader supplying GitHub's branch metadata when available.
 * @param readGitBranch Fallback that reads the current branch from the local git checkout.
 * @returns The pull-request head, workflow ref, or local git branch in that order.
 */
export async function currentDevelopmentBranch(
  environment: { readonly get: (name: string) => string | undefined } = Deno.env,
  readGitBranch: () => Promise<string> = currentGitBranch,
): Promise<string> {
  for (const name of ["GITHUB_HEAD_REF", "GITHUB_REF_NAME"] as const) {
    const branch = environment.get(name)?.trim();
    if (branch !== undefined && branch !== "") return branch;
  }
  const branch = await readGitBranch();
  if (branch === "HEAD") {
    throw new Error("build: cannot label a development build from a detached HEAD");
  }
  return branch;
}

/**
 * Builds both targets into `options.outDir` (default `dist/`), wiping it first.
 *
 * `outDir` exists so the build tests can point at a temp directory. They cannot run against the
 * default: `deno task ci` is the lefthook pre-push hook, so every push would wipe the developer's
 * real `dist/` on the way out — and the documented `deno task build && deno task e2e:smoke` flow
 * needs it to still be there.
 *
 * @param options.release - Minify, drop sourcemaps, and emit a zip per target. Development builds
 * add a descriptive version containing `options.branch`.
 * @param options.branch - Current git branch identifying a development build.
 * @param options.outDir - Where to write. Wiped before the build; defaults to the repo's `dist/`.
 * @returns A promise that settles after both browser packages are written.
 */
export async function build(options: BuildOptions): Promise<void> {
  const target = esbuildTargetFrom(SUPPORTED);
  const outDir = options.outDir ?? DIST;
  const bundleDir = new URL(".bundle/", outDir);
  const versionName = options.release
    ? undefined
    : developmentVersionName(manifestBase.version, options.branch);

  await removeIfExists(outDir);
  await Deno.mkdir(outDir, { recursive: true });

  try {
    await esbuild.build({
      entryPoints: IIFE_ENTRY_POINTS,
      absWorkingDir: fromFileUrl(ROOT),
      outdir: fromFileUrl(bundleDir),
      bundle: true,
      format: "iife",
      target,
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      sourcemap: !options.release,
      minify: options.release,
      legalComments: "none",
    });
    await esbuild.build({
      entryPoints: ESM_ENTRY_POINTS,
      absWorkingDir: fromFileUrl(ROOT),
      outdir: fromFileUrl(bundleDir),
      bundle: true,
      format: "esm",
      target,
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      sourcemap: !options.release,
      minify: options.release,
      legalComments: "none",
    });
  } finally {
    await esbuild.stop();
  }

  await assertNoRemoteUrls(bundleDir);

  for (const t of TARGETS) {
    const targetDir = new URL(`${t}/`, outDir);
    await copyRecursive(bundleDir, targetDir);
    for (const shell of HTML_SHELLS) {
      await Deno.copyFile(new URL(shell.from, SRC), new URL(shell.to, targetDir));
    }
    await copyDesignAssets(targetDir);
    await writeIcons(targetDir);
    const baseManifest = t === "chrome" ? forChrome() : forFirefox();
    const manifest = versionName === undefined ? baseManifest : {
      ...baseManifest,
      version_name: versionName,
    };
    await Deno.writeTextFile(
      new URL("manifest.json", targetDir),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    console.log(`build: wrote dist/${t}`);
  }

  await removeIfExists(bundleDir);

  if (options.release) {
    for (const t of TARGETS) {
      const zipName = `${t}-${manifestBase.version}.zip`;
      const zipPath = new URL(zipName, outDir);
      await zipDir(new URL(`${t}/`, outDir), zipPath);
      console.log(`build: wrote dist/${zipName}`);
    }
  }
}

if (import.meta.main) {
  if (Deno.args.includes("--release")) {
    await build({ release: true });
  } else {
    await build({ release: false, branch: await currentDevelopmentBranch() });
  }
}
