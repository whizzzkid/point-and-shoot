import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeRepositoryProjection } from "./repository.mjs";
import { projectStoreListing, runStoreListingCheck } from "./store-listing.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..");
const astroCacheRoot = resolve(siteRoot, ".astro");
const generatedRoot = resolve(siteRoot, ".generated");
const generatedDesignRoot = resolve(generatedRoot, "design");
const sourceDesignRoot = resolve(repositoryRoot, "src/shared/design");
const sourceDocsAssets = resolve(repositoryRoot, "docs/assets");
const sourceIcon = resolve(repositoryRoot, ".claude-design/point-and-shoot/assets/icon.svg");
const sourceProductPreview = resolve(repositoryRoot, "tests/visual/baselines/notes-dark.png");
const sourceStoreListing = resolve(repositoryRoot, "store-listing.json");
const command = Deno.args[0];
const supportedCommands = new Set(["build", "check", "dev"]);
// The star badge is decoration, so an air-gapped build gets an explicit way to skip the one network
// call this build makes. Read here, not in the projection module: this is the entry point.
const starCountEnabled = Deno.env.get("PNS_SITE_SKIP_STAR_COUNT") !== "1";

if (!supportedCommands.has(command)) {
  throw new Error("Usage: deno task site:<build|check|dev>");
}

await runStoreListingCheck(repositoryRoot);
await Promise.all([
  rm(astroCacheRoot, { force: true, recursive: true }),
  rm(generatedRoot, { force: true, recursive: true }),
]);
await mkdir(resolve(generatedDesignRoot, "fonts"), { recursive: true });
await mkdir(resolve(generatedRoot, "public/brand"), { recursive: true });
await mkdir(resolve(generatedRoot, "public/docs"), { recursive: true });
await mkdir(resolve(generatedRoot, "public/product"), { recursive: true });
await Promise.all([
  cp(resolve(sourceDesignRoot, "fonts"), resolve(generatedDesignRoot, "fonts"), {
    recursive: true,
  }),
  cp(resolve(sourceDesignRoot, "tokens.css"), resolve(generatedDesignRoot, "tokens.css")),
  cp(sourceDocsAssets, resolve(generatedRoot, "public/docs/assets"), {
    recursive: true,
  }),
  cp(resolve(sourceDesignRoot, "icons.svg"), resolve(generatedRoot, "public/brand/icons.svg")),
  cp(sourceIcon, resolve(generatedRoot, "public/brand/icon.svg")),
  cp(sourceProductPreview, resolve(generatedRoot, "public/product/notes-panel.png")),
  projectStoreListing(sourceStoreListing, resolve(generatedRoot, "store-listing.json")),
  writeRepositoryProjection(resolve(generatedRoot, "repository.json"), {
    enabled: starCountEnabled,
  }),
]);

const tokens = await readFile(resolve(sourceDesignRoot, "tokens.css"), "utf8");
const lightThemeBodies = [...tokens.matchAll(/\[data-theme="light"\]\s*(\{[^}]*\})/g)]
  .map((match) => match[1]);

if (lightThemeBodies.length === 0) {
  throw new Error("The generated design tokens do not define a light theme.");
}

// The token source already carries `[data-theme="light"]`, so an explicit override on `<html>` works
// without translation. Only the operating-system branch is rewritten, and it is narrowed to
// `:root:not([data-theme])` so `prefers-color-scheme` stays the default while a stored override
// wins. Re-hoisting it to a bare `:root` would make the OS preference beat an explicit choice.
const systemLightBlocks = lightThemeBodies
  .map((body) => `:root:not([data-theme]) ${body}`)
  .join("\n");

await writeFile(
  resolve(generatedDesignRoot, "tokens-site.css"),
  `${tokens}\n@media (prefers-color-scheme: light) {\n${systemLightBlocks}\n}\n`,
);

const child = new Deno.Command(Deno.execPath(), {
  args: [
    "run",
    "-A",
    "--allow-scripts=npm:esbuild@0.28.1",
    "npm:astro@7.1.6",
    command,
  ],
  cwd: siteRoot,
  env: { ...Deno.env.toObject(), ASTRO_TELEMETRY_DISABLED: "1" },
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
}).spawn();
const { code: exitCode } = await child.status;

if (command !== "dev") {
  await rm(generatedRoot, { force: true, recursive: true });
}

Deno.exitCode = exitCode;
