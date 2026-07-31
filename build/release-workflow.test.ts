import { assertEquals, assertStringIncludes } from "@std/assert";

import { manifestBase } from "./manifest.ts";

const ROOT = new URL("../", import.meta.url);

Deno.test("Release Please manifest updates every packaged version source", async () => {
  const config = JSON.parse(
    await Deno.readTextFile(new URL("release-please-config.json", ROOT)),
  );
  const manifest = JSON.parse(
    await Deno.readTextFile(new URL(".release-please-manifest.json", ROOT)),
  );
  const versionFile = (await Deno.readTextFile(new URL("version.txt", ROOT))).trim();

  assertEquals(config["release-type"], "simple");
  assertEquals(config["include-component-in-tag"], false);
  assertEquals(config["include-v-in-tag"], true);
  assertEquals(config["always-update"], true);
  assertEquals(config.packages["."]["package-name"], "point-and-shoot");
  assertEquals(config.packages["."]["version-file"], "version.txt");
  assertEquals(config.packages["."]["extra-files"], [
    { path: "build/manifest.ts", type: "generic" },
  ]);
  assertEquals(manifest, { ".": manifestBase.version });
  assertEquals(versionFile, manifestBase.version);

  const manifestSource = await Deno.readTextFile(new URL("build/manifest.ts", ROOT));
  assertStringIncludes(
    manifestSource,
    `version: "${manifestBase.version}", // x-release-please-version`,
  );
});

Deno.test("release workflow builds exact preview and release SHAs", async () => {
  const workflow = await Deno.readTextFile(new URL(".github/workflows/release.yml", ROOT));
  const ciWorkflow = await Deno.readTextFile(new URL(".github/workflows/ci.yml", ROOT));

  assertStringIncludes(workflow, "googleapis/release-please-action@v5");
  assertStringIncludes(workflow, "release-as: ${{ steps.version.outputs.next }}");
  assertStringIncludes(workflow, "actions: write");
  assertStringIncludes(workflow, 'gh workflow run ci.yml --ref "${head_branch}"');
  assertStringIncludes(ciWorkflow, "workflow_dispatch:");
  assertStringIncludes(workflow, "ref: ${{ fromJSON(needs.release_please.outputs.pr).sha }}");
  assertStringIncludes(workflow, "uses: actions/upload-artifact@v7");
  assertStringIncludes(workflow, "artifact-url");
  assertStringIncludes(workflow, "ref: ${{ needs.release_please.outputs.release_sha }}");
  assertStringIncludes(workflow, 'deno task release:validate "${TAG_NAME}"');
  assertStringIncludes(
    workflow,
    'gh release upload "${TAG_NAME}" dist/chrome.zip dist/firefox.zip --clobber',
  );
});
