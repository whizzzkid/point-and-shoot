import { assert, assertEquals, assertStringIncludes } from "@std/assert";

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

Deno.test("Release Please changelog formatting exclusion stays narrowly scoped", async () => {
  const temporaryRoot = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${temporaryRoot}/deno.json`,
      await Deno.readTextFile(new URL("deno.json", ROOT)),
    );
    await Deno.writeTextFile(
      `${temporaryRoot}/CHANGELOG.md`,
      "# Changelog\n\n* **fix:** generated release note ([abc1234](https://example.com/abc1234))\n",
    );

    const output = await new Deno.Command(Deno.execPath(), {
      args: ["task", "fmt:check"],
      cwd: temporaryRoot,
      stderr: "piped",
      stdout: "piped",
    }).output();

    const failureDiagnostics = output.code === 0
      ? undefined
      : new TextDecoder().decode(output.stderr) || new TextDecoder().decode(output.stdout);
    assertEquals(output.code, 0, failureDiagnostics);

    await Deno.writeTextFile(`${temporaryRoot}/README.md`, "# Other markdown\n\n* unformatted\n");
    const controlOutput = await new Deno.Command(Deno.execPath(), {
      args: ["task", "fmt:check"],
      cwd: temporaryRoot,
      stderr: "piped",
      stdout: "piped",
    }).output();
    const controlDiagnostics = new TextDecoder().decode(controlOutput.stderr) +
      new TextDecoder().decode(controlOutput.stdout);

    assert(controlOutput.code !== 0, "formatter unexpectedly ignored unrelated Markdown");
    assertStringIncludes(controlDiagnostics, "README.md");
  } finally {
    await Deno.remove(temporaryRoot, { recursive: true });
  }
});

Deno.test("release workflow builds exact preview and release SHAs", async () => {
  const workflow = await Deno.readTextFile(new URL(".github/workflows/release.yml", ROOT));
  const ciWorkflow = await Deno.readTextFile(new URL(".github/workflows/ci.yml", ROOT));
  const denoConfig = await Deno.readTextFile(new URL("deno.json", ROOT));

  assertStringIncludes(workflow, "googleapis/release-please-action@v5");
  assertStringIncludes(workflow, "skip-github-pull-request: true");
  assertStringIncludes(
    denoConfig,
    '"release:pr": "deno run -A npm:release-please@17.6.0 release-pr"',
  );
  assertStringIncludes(workflow, "deno task release:pr");
  assertStringIncludes(workflow, `trap 'rm -f -- "\${token_file}"' EXIT INT TERM`);
  assertStringIncludes(workflow, '--release-as="${NEXT_VERSION}"');
  assertStringIncludes(workflow, "pr_created: ${{ steps.release_pr.outputs.prs_created }}");
  assertStringIncludes(workflow, "pr: ${{ steps.release_pr.outputs.pr }}");
  assertStringIncludes(workflow, "actions: write");
  assertStringIncludes(workflow, 'gh workflow run ci.yml --ref "${head_branch}"');
  assertStringIncludes(ciWorkflow, "workflow_dispatch:");
  assertStringIncludes(workflow, "ref: ${{ fromJSON(needs.release_please.outputs.pr).sha }}");
  assertStringIncludes(workflow, "uses: actions/upload-artifact@v7");
  assertStringIncludes(workflow, "artifact-url");
  assertStringIncludes(workflow, "ref: ${{ needs.release_please.outputs.release_sha }}");
  assertStringIncludes(workflow, "deno task release:artifacts");
  assertStringIncludes(workflow, 'deno task release:validate "${TAG_NAME}"');
  assertStringIncludes(workflow, "dist/firefox-source.zip");
  assertStringIncludes(workflow, "dist/firefox-build-instructions.md");
  assertStringIncludes(workflow, "14 days");
  assertStringIncludes(workflow, "Load unpacked");
  assertStringIncludes(workflow, "Load Temporary Add-on");
  assertStringIncludes(workflow, "store-submission candidates, not consumer install links");
  assertStringIncludes(workflow, "deno task release:status seed");
  assertStringIncludes(workflow, 'gh release edit "${TAG_NAME}" --notes-file');
  assertStringIncludes(workflow, 'asset_names="$(gh release view "${TAG_NAME}" --json assets');
  assertStringIncludes(workflow, '[[ "${asset_names}" != "${expected_assets}" ]]');
  assertStringIncludes(workflow, 'version="${TAG_NAME#v}"');
  assertStringIncludes(workflow, '"dist/chrome-${version}.zip"');
  assertStringIncludes(workflow, '"dist/firefox-${version}.zip"');
  assertStringIncludes(workflow, "dist/firefox-source.zip");
  assertStringIncludes(workflow, "dist/firefox-build-instructions.md --clobber");
  assertStringIncludes(
    workflow,
    'expected_assets="$(printf \'%s\\n\' "chrome-${version}.zip" ' +
      'firefox-build-instructions.md firefox-source.zip "firefox-${version}.zip" | sort)"',
  );
  assertStringIncludes(workflow, ".body | @base64");
  assertStringIncludes(workflow, "base64 --decode");
  assertStringIncludes(workflow, "uses: ./.github/workflows/store-publish.yml");
  assertStringIncludes(workflow, "tag_name: ${{ needs.release_please.outputs.tag_name }}");
  assertStringIncludes(workflow, "release_sha: ${{ needs.release_please.outputs.release_sha }}");
  assertStringIncludes(workflow, "id-token: write");
});

Deno.test("store publishing workflow is disabled by default and protects vendor secrets", async () => {
  const workflow = await Deno.readTextFile(
    new URL(".github/workflows/store-publish.yml", ROOT),
  );

  assertStringIncludes(workflow, "workflow_call:");
  assertStringIncludes(workflow, "workflow_dispatch:");
  assertEquals(workflow.includes("pull_request:"), false);
  assertStringIncludes(workflow, "operation:");
  assertStringIncludes(workflow, "vars.STORE_PUBLISH_ENABLED != 'true'");
  assertStringIncludes(workflow, "vars.STORE_PUBLISH_ENABLED == 'true'");
  assertStringIncludes(workflow, "environment: browser-stores");
  assertStringIncludes(workflow, "id-token: write");
  assertStringIncludes(workflow, "google-github-actions/auth@v3");
  assertStringIncludes(workflow, "token_format: access_token");
  assertStringIncludes(
    workflow,
    "access_token_scopes: https://www.googleapis.com/auth/chromewebstore",
  );
  assertStringIncludes(workflow, "deno task release:validate");
  assertStringIncludes(workflow, "deno task store:release disabled");
  assertStringIncludes(workflow, 'deno task store:release "${OPERATION}"');
  assertStringIncludes(workflow, "WEB_EXT_API_KEY: ${{ secrets.WEB_EXT_API_KEY }}");
  assertStringIncludes(workflow, "WEB_EXT_API_SECRET: ${{ secrets.WEB_EXT_API_SECRET }}");
  assertStringIncludes(workflow, 'git rev-parse "${TAG_NAME}^{commit}"');
  assertStringIncludes(workflow, "git rev-parse HEAD");
  assertStringIncludes(workflow, "export LISTING_SUMMARY_CHANGED=true");
  assertStringIncludes(workflow, "export LISTING_SUMMARY_CHANGED=false");

  const disabledJob = workflow.slice(
    workflow.indexOf("  disabled:"),
    workflow.indexOf("  publish:"),
  );
  assertEquals(disabledJob.includes("secrets."), false);
  assertEquals(disabledJob.includes("CHROME_ACCESS_TOKEN"), false);
  assertStringIncludes(disabledJob, 'git rev-parse "${TAG_NAME}^{commit}"');
  assertStringIncludes(disabledJob, "git rev-parse HEAD");

  const releaseWorkflow = await Deno.readTextFile(new URL(".github/workflows/release.yml", ROOT));
  const reusableCall = releaseWorkflow.slice(releaseWorkflow.indexOf("  store_publish:"));
  assertStringIncludes(reusableCall, "secrets: inherit");
});
