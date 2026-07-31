import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..");
const generatedRoot = resolve(siteRoot, ".generated");
const generatedDesignRoot = resolve(generatedRoot, "design");
const sourceDesignRoot = resolve(repositoryRoot, "src/shared/design");
const command = process.argv[2];
const supportedCommands = new Set(["build", "check", "dev"]);

if (!supportedCommands.has(command)) {
  throw new Error("Usage: node scripts/run-astro.mjs <build|check|dev>");
}

await rm(generatedRoot, { force: true, recursive: true });
await mkdir(resolve(generatedDesignRoot, "fonts"), { recursive: true });
await Promise.all([
  cp(resolve(sourceDesignRoot, "fonts"), resolve(generatedDesignRoot, "fonts"), {
    recursive: true,
  }),
  cp(resolve(sourceDesignRoot, "tokens.css"), resolve(generatedDesignRoot, "tokens.css")),
]);

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
