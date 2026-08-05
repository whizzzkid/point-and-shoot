import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..");
const astroCacheRoot = resolve(siteRoot, ".astro");
const generatedRoot = resolve(siteRoot, ".generated");
const generatedDesignRoot = resolve(generatedRoot, "design");
const sourceDesignRoot = resolve(repositoryRoot, "src/shared/design");
const sourceDocsAssets = resolve(repositoryRoot, "docs/assets");
const sourceIcon = resolve(repositoryRoot, ".claude-design/point-and-shoot/assets/icon.svg");
const sourceProductPreview = resolve(repositoryRoot, "tests/visual/baselines/notes-dark.png");
const command = Deno.args[0];
const supportedCommands = new Set(["build", "check", "dev"]);

if (!supportedCommands.has(command)) {
  throw new Error("Usage: deno task site:<build|check|dev>");
}

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
