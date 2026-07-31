/// <reference lib="dom" />

/**
 * Firefox smoke tier for the real `dist/firefox` build.
 *
 * This proves one representative Firefox path: the MV3 event page boots, a real browser-action
 * click injects the content script, `sidebar_action` opens the native sidebar, one element capture
 * persists a schema-valid note, and both vendored asset types resolve from `moz-extension://`.
 *
 * This is not Firefox E2E parity. It does not repeat Chromium's multi-page lifecycle, export,
 * visual-regression, accessibility, restricted-page, quota, or failure-trace coverage. Browser API
 * divergence remains unit-tested at the shim seam, as required by ADR-0007.
 *
 * Run with `deno task smoke:firefox`.
 *
 * @module
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { FIREFOX_EXTENSION_ID } from "../../build/manifest.ts";
import { validateSession } from "../../src/shared/schema.ts";
import { startFixtureServer } from "../fixtures/app/server.ts";
import { MarionetteClient } from "./marionette.ts";

const SOURCE_DIRECTORY = fromFileUrl(new URL("../../dist/firefox/", import.meta.url));
const EXTENSION_UUID = "6f1a2b3c-d4e5-46f7-8a9b-0c1d2e3f4a5b";
const EXTENSION_ORIGIN = `moz-extension://${EXTENSION_UUID}`;
const STARTUP_TIMEOUT_MILLISECONDS = 45_000;
const STATE_TIMEOUT_MILLISECONDS = 10_000;
const POLL_INTERVAL_MILLISECONDS = 50;
const WEB_ELEMENT_IDENTIFIER = "element-6066-11e4-a52e-4f735466cecf";
const ACTION_BUTTON_SELECTOR =
  `.unified-extensions-item-action-button[data-extensionid="${FIREFOX_EXTENSION_ID}"]`;

interface OutputState {
  backgroundReady: boolean;
  readonly lines: string[];
}

interface AssetResult {
  readonly byteLength: number;
  readonly ok: boolean;
  readonly path: string;
  readonly status: number;
  readonly url: string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} was not an object: ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

function commandValue(value: unknown, label: string): unknown {
  const record = asRecord(value, label);
  if (!("value" in record)) throw new Error(`${label} had no value: ${JSON.stringify(value)}`);
  return record.value;
}

async function consumeOutput(
  stream: ReadableStream<Uint8Array>,
  source: string,
  state: OutputState,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const rendered = `${source}: ${line}`;
        state.lines.push(rendered);
        if (line.includes("point-and-shoot: background ready")) state.backgroundReady = true;
      }
    }
    buffer += decoder.decode();
    if (buffer.length > 0) state.lines.push(`${source}: ${buffer}`);
  } finally {
    reader.releaseLock();
  }
}

function reserveTcpPort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  try {
    return (listener.addr as Deno.NetAddr).port;
  } finally {
    listener.close();
  }
}

async function waitForBackground(
  state: OutputState,
  status: Promise<Deno.CommandStatus>,
): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (state.backgroundReady) return;
    const outcome = await Promise.race([
      new Promise<"poll">((resolve) =>
        setTimeout(() => resolve("poll"), POLL_INTERVAL_MILLISECONDS)
      ),
      status.then((result) => ({ result })),
    ]);
    if (outcome !== "poll") {
      throw new Error(
        `web-ext exited before the Firefox event page booted (${JSON.stringify(outcome.result)})`,
      );
    }
  }
  throw new Error(
    `Firefox event page did not boot within ${STARTUP_TIMEOUT_MILLISECONDS}ms`,
  );
}

async function executeScript(
  client: MarionetteClient,
  script: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  return commandValue(
    await client.command("WebDriver:ExecuteScript", {
      args,
      newSandbox: false,
      sandbox: "default",
      script,
    }),
    "script result",
  );
}

async function executeAsyncScript(
  client: MarionetteClient,
  script: string,
  args: readonly unknown[] = [],
): Promise<unknown> {
  return commandValue(
    await client.command("WebDriver:ExecuteAsyncScript", {
      args,
      newSandbox: false,
      sandbox: "default",
      script,
    }),
    "async script result",
  );
}

async function waitForScript(
  client: MarionetteClient,
  script: string,
  accept: (value: unknown) => boolean,
  label: string,
): Promise<unknown> {
  const deadline = Date.now() + STATE_TIMEOUT_MILLISECONDS;
  let observed: unknown;
  while (Date.now() < deadline) {
    observed = await executeScript(client, script);
    if (accept(observed)) return observed;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MILLISECONDS));
  }
  throw new Error(`${label} did not become ready; last observed ${JSON.stringify(observed)}`);
}

async function navigate(client: MarionetteClient, url: string): Promise<void> {
  await client.command("WebDriver:Navigate", { url });
}

async function clickElement(client: MarionetteClient, selector: string): Promise<void> {
  const result = commandValue(
    await client.command("WebDriver:FindElement", {
      using: "css selector",
      value: selector,
    }),
    "element lookup",
  );
  const id = asRecord(result, "element reference")[WEB_ELEMENT_IDENTIFIER];
  if (typeof id !== "string") {
    throw new Error(`Firefox returned no WebDriver element id: ${JSON.stringify(result)}`);
  }
  await client.command("WebDriver:ElementClick", { id });
}

async function activateWithBrowserAction(client: MarionetteClient): Promise<void> {
  await client.command("Marionette:SetContext", { value: "chrome" });
  await clickElement(client, "#unified-extensions-button");
  await waitForScript(
    client,
    'return document.getElementById("unified-extensions-panel")?.state',
    (value) => value === "open",
    "Firefox extensions panel",
  );
  await clickElement(client, ACTION_BUTTON_SELECTOR);
  await client.command("Marionette:SetContext", { value: "content" });
}

async function waitForNoteBadge(client: MarionetteClient): Promise<void> {
  await client.command("Marionette:SetContext", { value: "chrome" });
  await waitForScript(
    client,
    `return document.querySelector(${JSON.stringify(ACTION_BUTTON_SELECTOR)})
      ?.getAttribute("badge")`,
    (value) => value === "1",
    "Firefox note badge",
  );
  await client.command("Marionette:SetContext", { value: "content" });
}

function firefoxCommand(
  artifactsDirectory: string,
  fixtureUrl: string,
  marionettePort: number,
): Deno.Command {
  const firefoxBinary = Deno.env.get("PNS_FIREFOX_BINARY");
  const uuidPreference = JSON.stringify({
    [FIREFOX_EXTENSION_ID]: EXTENSION_UUID,
  }).replaceAll('"', '\\"');
  return new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "npm:web-ext@10.5.0",
      "run",
      "--source-dir",
      SOURCE_DIRECTORY,
      "--artifacts-dir",
      artifactsDirectory,
      ...(firefoxBinary === undefined ? [] : ["--firefox", firefoxBinary]),
      "--pref",
      "devtools.console.stdout.chrome=true",
      "--pref",
      "devtools.console.stdout.content=true",
      "--pref",
      `marionette.port=${marionettePort}`,
      "--pref",
      `extensions.webextensions.uuids=${uuidPreference}`,
      "--args=-headless",
      "--args=-marionette",
      "--args=-remote-allow-system-access",
      "--start-url",
      fixtureUrl,
      "--verbose",
      "--no-input",
      "--no-reload",
    ],
    stderr: "piped",
    stdout: "piped",
  });
}

async function runSmoke(): Promise<void> {
  await Deno.stat(join(SOURCE_DIRECTORY, "manifest.json"));
  const fixture = startFixtureServer();
  const artifactsDirectory = await Deno.makeTempDir({ prefix: "pns-smoke-firefox-" });
  const marionettePort = reserveTcpPort();
  const output: OutputState = { backgroundReady: false, lines: [] };
  const child = firefoxCommand(
    artifactsDirectory,
    `${fixture.base}/firefox-boot.html`,
    marionettePort,
  ).spawn();
  const status = child.status;
  const outputTasks = [
    consumeOutput(child.stdout, "stdout", output),
    consumeOutput(child.stderr, "stderr", output),
  ];
  let client: MarionetteClient | undefined;

  try {
    await waitForBackground(output, status);
    client = await MarionetteClient.connect(
      marionettePort,
      STARTUP_TIMEOUT_MILLISECONDS,
    );
    asRecord(await client.startSession(), "new session");

    await navigate(client, `${fixture.base}/firefox-boot.html`);
    await activateWithBrowserAction(client);
    assertEquals(
      await waitForScript(
        client,
        'return document.querySelectorAll("[data-point-and-shoot-host]").length',
        (value) => value === 1,
        "content-script host",
      ),
      1,
    );

    await client.command("Marionette:SetContext", { value: "chrome" });
    const sidebar = asRecord(
      await waitForScript(
        client,
        `const wrapper = SidebarController.browser;
         const panel = wrapper?.contentDocument?.getElementById("webext-panels-browser");
         return {
           currentID: SidebarController.currentID,
           isOpen: SidebarController.isOpen,
           url: panel?.currentURI?.spec ?? panel?.getAttribute("src") ?? ""
         }`,
        (value) => {
          if (typeof value !== "object" || value === null) return false;
          const record = value as Record<string, unknown>;
          return record.isOpen === true &&
            typeof record.url === "string" &&
            record.url.endsWith("/sidepanel/sidepanel.html");
        },
        "Firefox sidebar_action",
      ),
      "Firefox sidebar",
    );
    assertEquals(sidebar.isOpen, true);
    assertStringIncludes(String(sidebar.url), `${EXTENSION_ORIGIN}/sidepanel/sidepanel.html`);
    assert(typeof sidebar.currentID === "string" && sidebar.currentID.length > 0);

    await client.command("Marionette:SetContext", { value: "content" });
    await clickElement(client, "h1");
    await waitForNoteBadge(client);
    await navigate(client, `${EXTENSION_ORIGIN}/sidepanel/sidepanel.html`);

    const storedSessions = await executeAsyncScript(
      client,
      `const done = arguments[arguments.length - 1];
       const open = indexedDB.open("point-and-shoot");
       open.onerror = () => done({ error: String(open.error) });
       open.onsuccess = () => {
         const database = open.result;
         const request = database.transaction("sessions", "readonly")
           .objectStore("sessions")
           .getAll();
         request.onerror = () => {
           database.close();
           done({ error: String(request.error) });
         };
         request.onsuccess = () => {
           database.close();
           done({ sessions: request.result });
         };
       };`,
    );
    const sessionResult = asRecord(storedSessions, "stored Firefox sessions");
    assertEquals(sessionResult.error, undefined);
    assert(Array.isArray(sessionResult.sessions));
    assertEquals(sessionResult.sessions.length, 1);
    const validation = validateSession(sessionResult.sessions[0]);
    if (!validation.valid) {
      throw new Error(`Firefox persisted an invalid session: ${JSON.stringify(validation.error)}`);
    }
    assertEquals(validation.session.notes.length, 1);
    assertStringIncludes(validation.session.notes[0]?.pageTitle ?? "", "Firefox boot check");

    const assets = await executeAsyncScript(
      client,
      `const done = arguments[arguments.length - 1];
       Promise.all(arguments[0].map(async (path) => {
         const url = new URL(path, location.origin + "/").href;
         const response = await fetch(url);
         return {
           byteLength: (await response.arrayBuffer()).byteLength,
           ok: response.ok,
           path,
           status: response.status,
           url
         };
       })).then(done, (error) => done({ error: String(error) }));`,
      [[
        "src/shared/design/fonts/inter-400.woff2",
        "src/shared/design/icons.svg",
      ]],
    );
    assert(
      Array.isArray(assets),
      `Firefox asset fetch did not return an array: ${JSON.stringify(assets)}`,
    );
    assertEquals(assets.length, 2);
    for (const candidate of assets) {
      const asset = asRecord(candidate, "Firefox asset") as unknown as AssetResult;
      assertEquals(asset.ok, true, `${asset.path} did not resolve`);
      assertEquals(asset.status, 200, `${asset.path} returned ${asset.status}`);
      assert(asset.byteLength > 0, `${asset.path} was empty`);
      assertStringIncludes(asset.url, `${EXTENSION_ORIGIN}/`);
    }

    console.log(
      "Firefox smoke passed: event page, activation, sidebar, capture, font, and icon sprite.",
    );
  } catch (error) {
    console.error("Firefox smoke output:");
    console.error(output.lines.slice(-80).join("\n"));
    throw error;
  } finally {
    if (client !== undefined) {
      try {
        await client.close();
      } catch {
        // Firefox may have already exited after a failed command.
      }
    }
    try {
      child.kill();
    } catch {
      // web-ext may already have exited.
    }
    await status;
    await Promise.allSettled(outputTasks);
    await fixture.close();
    await Deno.remove(artifactsDirectory, { recursive: true });
  }
}

if (import.meta.main) {
  await runSmoke();
}
