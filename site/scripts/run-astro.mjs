import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..");
const astroCacheRoot = resolve(siteRoot, ".astro");
const astroContentCacheRoot = resolve(siteRoot, "node_modules/.astro");
const generatedRoot = resolve(siteRoot, ".generated");
const generatedDesignRoot = resolve(generatedRoot, "design");
const sourceDesignRoot = resolve(repositoryRoot, "src/shared/design");
const sourceDocsAssets = resolve(repositoryRoot, "docs/assets");
const sourceIcon = resolve(repositoryRoot, ".claude-design/point-and-shoot/assets/icon.svg");
const sourceProductPreview = resolve(repositoryRoot, "tests/visual/baselines/notes-dark.png");
const command = process.argv[2];
const supportedCommands = new Set(["build", "check", "dev"]);

if (!supportedCommands.has(command)) {
  throw new Error("Usage: node scripts/run-astro.mjs <build|check|dev>");
}

await Promise.all([
  rm(astroCacheRoot, { force: true, recursive: true }),
  rm(astroContentCacheRoot, { force: true, recursive: true }),
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
]);

const tokens = await readFile(resolve(sourceDesignRoot, "tokens.css"), "utf8");
const lightThemeBlocks = [...tokens.matchAll(/\[data-theme="light"\]\s*(\{[^}]*\})/g)]
  .map((match) => `:root ${match[1]}`)
  .join("\n");

if (lightThemeBlocks.length === 0) {
  throw new Error("The generated design tokens do not define a light theme.");
}

await writeFile(
  resolve(generatedDesignRoot, "tokens-site.css"),
  `${tokens}\n@media (prefers-color-scheme: light) {\n${lightThemeBlocks}\n}\n`,
);

const astro = resolve(siteRoot, "node_modules/astro/bin/astro.mjs");
const child = spawn(process.execPath, [astro, command], {
  cwd: siteRoot,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});

const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolveExit(code ?? 1));
});

if (command !== "dev") {
  await rm(generatedRoot, { force: true, recursive: true });
}

process.exitCode = exitCode;
