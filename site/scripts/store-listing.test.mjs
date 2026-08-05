import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { projectStoreListing, runStoreListingCheck } from "./store-listing.mjs";

function storeCheckProcess(exitCode, record) {
  return (command, args, options) => {
    record.push({ command, args, options });
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("exit", exitCode));
    return child;
  };
}

test("store listing projection copies normalized canonical JSON", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "point-and-shoot-store-listing-"));
  try {
    const source = resolve(temporaryDirectory, "store-listing.json");
    const destination = resolve(temporaryDirectory, ".generated/store-listing.json");
    await writeFile(source, '{"schemaVersion":1,"stores":{}}');
    await projectStoreListing(source, destination);
    assert.equal(
      await readFile(destination, "utf8"),
      '{\n  "schemaVersion": 1,\n  "stores": {}\n}\n',
    );
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("store listing projection rejects malformed JSON before Astro starts", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "point-and-shoot-store-listing-"));
  try {
    const source = resolve(temporaryDirectory, "store-listing.json");
    const destination = resolve(temporaryDirectory, ".generated/store-listing.json");
    await writeFile(source, "{not-json}");
    await assert.rejects(projectStoreListing(source, destination), SyntaxError);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("store listing check runs the canonical Deno task from the repository root", async () => {
  const calls = [];
  await runStoreListingCheck("/repository", {
    spawnProcess: storeCheckProcess(0, calls),
  });
  assert.deepEqual(calls, [
    {
      command: "deno",
      args: ["task", "store:check"],
      options: { cwd: "/repository", stdio: "inherit" },
    },
  ]);
});

test("store listing check blocks the site after a failed canonical validation", async () => {
  await assert.rejects(
    runStoreListingCheck("/repository", {
      spawnProcess: storeCheckProcess(1, []),
    }),
    /store:check failed with exit code 1/,
  );
});
