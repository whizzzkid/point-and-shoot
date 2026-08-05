import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Copies normalized canonical store JSON into Astro's disposable generated directory.
 *
 * @param {string} source - Root contract path.
 * @param {string} destination - Generated site-data path.
 * @returns {Promise<void>} Completion after the normalized projection is written.
 */
export async function projectStoreListing(source, destination) {
  const decoded = JSON.parse(await readFile(source, "utf8"));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(decoded, null, 2)}\n`);
}

/**
 * Runs the canonical non-writing contract gate before a site projection can be created.
 *
 * @param {string} repositoryRoot - Repository root containing `deno.json`.
 * @param {{spawnProcess?: typeof spawn}} options - Optional process seam for tests.
 * @returns {Promise<void>} Completion after `store:check` succeeds.
 */
export async function runStoreListingCheck(repositoryRoot, { spawnProcess = spawn } = {}) {
  const child = spawnProcess("deno", ["task", "store:check"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`store:check failed with exit code ${exitCode}`);
  }
}
