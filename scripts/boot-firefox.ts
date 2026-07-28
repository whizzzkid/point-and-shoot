/**
 * Firefox boot check (W2.12): loads the real built `dist/firefox/` extension into Firefox via
 * `web-ext run` and asserts it actually boots — the background script starts and a
 * `web_accessible_resources` file resolves through `moz-extension://`.
 *
 * It does not assert the content script ran: ADR-0002 removed the static registration, so nothing
 * injects without a toolbar gesture, and web-ext offers no way to fire one.
 *
 * Playwright cannot load extensions in Firefox (see tests/e2e/load.spec.ts), so this drives
 * Firefox directly and observes it through Firefox's own `devtools.console.stdout.*` prefs, which
 * mirror every console call (chrome and content) to this process's stdout via `--verbose` — the
 * only signal available without a full remote-debugging client.
 *
 * Run with `deno task build && deno task boot:firefox`.
 *
 * @module
 */

import { fromFileUrl, join } from "@std/path";
import { startFixtureServer } from "../tests/fixtures/app/server.ts";

const SOURCE_DIR = fromFileUrl(new URL("../dist/firefox/", import.meta.url));

// Must match tests/fixtures/app/firefox-boot.html's EXTENSION_UUID and FONT_RESOURCE, and
// build/manifest.ts's forFirefox() gecko id — pinning the UUID via `extensions.webextensions.uuids`
// is what makes this extension's moz-extension:// origin predictable across runs.
const GECKO_ID = "point-and-shoot@gusto.com";
const EXTENSION_UUID = "6f1a2b3c-d4e5-46f7-8a9b-0c1d2e3f4a5b";

const BOOT_TIMEOUT_MS = 45_000;

// Firefox-internal startup noise, unrelated to the extension under test — observed on every fresh
// profile regardless of extension state. Denylist rather than pref-suppressed: overriding
// `services.settings.server` does not stop the signature check, since it verifies a locally
// bundled dump, not a live fetch. May need extending after the first real CI run.
const KNOWN_NOISE = [
  /services\.settings:/,
  /RemoteSettingsClient/,
  /InvalidSignatureError/,
  /SearchSERPTelemetry/,
  /Policies: ?Invalid ExtensionSettings/,
  /unknown featureId/,
  /Crash Reports/,
  // Both of these appear only on GitHub's runner, which is why they surfaced on this job's first CI
  // run rather than locally. Neither involves the extension: web-ext passes `-foreground`, which that
  // Firefox build does not recognise, and Firefox's own favicon loader cannot sniff a MIME type for
  // the fixture page's icon. This check exists to catch *our* errors, so filtering the browser's is
  // the point, not a weakening of it.
  /unrecognized command line flag/,
  /FaviconLoader\.sys\.mjs/,
];

interface BootResult {
  timedOut: boolean;
  backgroundReady: boolean;
  woff2Status: string | null;
  unexpectedErrors: string[];
  lines: string[];
}

async function waitForBootSignal(
  child: Deno.ChildProcess,
  timeoutMs: number,
): Promise<BootResult> {
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  // The handle is kept so the `finally` below can clear it: an uncleared timer is a pending Deno op,
  // so a fast boot would still sit out the whole `timeoutMs` before the process could exit.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutHandle = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  let buffer = "";
  let backgroundReady = false;
  let woff2Status: string | null = null;
  const unexpectedErrors: string[] = [];
  const lines: string[] = [];

  const processLine = (line: string) => {
    lines.push(line);
    if (line.includes("point-and-shoot: background ready")) backgroundReady = true;
    // Excludes quotes rather than taking `\S+`: Firefox prints a page's console message wrapped in
    // them (`console.log: "firefox-boot: woff2-status=200"`), so `\S+` captured `200"` and the
    // comparison against `"200"` failed on a run where the resource had in fact resolved.
    const woff2Match = line.match(/firefox-boot: woff2-status=([^\s"']+)/);
    if (woff2Match) woff2Status = woff2Match[1] ?? null;
    if (line.includes("console.error:") && !KNOWN_NOISE.some((pattern) => pattern.test(line))) {
      unexpectedErrors.push(line.trim());
    }
  };

  try {
    while (true) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result === "timeout") {
        return { timedOut: true, backgroundReady, woff2Status, unexpectedErrors, lines };
      }
      const { value, done } = result;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) processLine(line);
      if (backgroundReady && woff2Status !== null) break;
    }
  } finally {
    clearTimeout(timeoutHandle);
    reader.releaseLock();
  }

  return { timedOut: false, backgroundReady, woff2Status, unexpectedErrors, lines };
}

async function main() {
  try {
    await Deno.stat(join(SOURCE_DIR, "manifest.json"));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    console.error(`dist/firefox/ not found — run \`deno task build\` first (${SOURCE_DIR})`);
    Deno.exit(1);
  }

  const fixture = startFixtureServer();
  const artifactsDir = await Deno.makeTempDir({ prefix: "pns-boot-firefox-" });
  const firefoxBinary = Deno.env.get("PNS_FIREFOX_BINARY");

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "npm:web-ext@10.5.0",
      "run",
      "--source-dir",
      SOURCE_DIR,
      "--artifacts-dir",
      artifactsDir,
      ...(firefoxBinary ? ["--firefox", firefoxBinary] : []),
      "--pref",
      "devtools.console.stdout.chrome=true",
      "--pref",
      "devtools.console.stdout.content=true",
      // web-ext writes --pref values into the profile's user.js verbatim, without escaping
      // embedded quotes — the inner quotes must be pre-escaped here or the generated user.js
      // breaks with "prefs parse error: unknown keyword".
      "--pref",
      `extensions.webextensions.uuids={\\"${GECKO_ID}\\":\\"${EXTENSION_UUID}\\"}`,
      "--pref",
      "services.settings.server=data:,#remote-settings-dummy/v1",
      "--pref",
      "extensions.getAddons.cache.enabled=false",
      "--pref",
      "browser.search.update=false",
      "--pref",
      "app.normandy.enabled=false",
      // Space-separated `--args -headless` crashes web-ext's yargs parser
      // (`TypeError: Cannot redefine property: a`) — the `=`-joined form avoids re-tokenizing it.
      "--args=-headless",
      "--start-url",
      `${fixture.base}/firefox-boot.html`,
      // Without --verbose, web-ext never forwards the launched Firefox process's own
      // stdout/stderr, so none of the console markers below would ever be visible.
      "--verbose",
      "--no-input",
    ],
    stdout: "piped",
  });

  const child = command.spawn();
  let result: BootResult;
  try {
    result = await waitForBootSignal(child, BOOT_TIMEOUT_MS);
  } finally {
    try {
      child.kill();
    } catch {
      // already exited
    }
    await child.status;
    await fixture.close();
  }

  if (result.timedOut) {
    console.error(`Timed out after ${BOOT_TIMEOUT_MS}ms waiting for the boot signal. Last output:`);
    console.error(result.lines.slice(-40).join("\n"));
    Deno.exit(1);
  }
  if (!result.backgroundReady) {
    console.error("Background script never signaled ready (point-and-shoot: background ready).");
    Deno.exit(1);
  }
  if (result.woff2Status !== "200") {
    console.error(`Expected woff2-status=200, got ${result.woff2Status}.`);
    Deno.exit(1);
  }
  if (result.unexpectedErrors.length > 0) {
    console.error("Unexpected console.error output during boot:");
    for (const line of result.unexpectedErrors) console.error(`  ${line}`);
    Deno.exit(1);
  }

  console.log("Firefox boot check passed: background script booted, woff2 resource resolved.");
}

if (import.meta.main) {
  await main();
}
