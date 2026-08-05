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
import {
  FIREFOX_EXTENSION_ORIGIN,
  FIREFOX_EXTENSION_UUID,
  FIREFOX_OFFLINE_PREFERENCES,
  firefoxBootFixtureUrl,
} from "./profile.ts";
import { MarionettePortHandoffError, retryMarionettePortHandoff } from "./startup-retry.ts";

const SOURCE_DIRECTORY = fromFileUrl(new URL("../../dist/firefox/", import.meta.url));
const STARTUP_TIMEOUT_MILLISECONDS = 45_000;
const STATE_TIMEOUT_MILLISECONDS = 10_000;
const POLL_INTERVAL_MILLISECONDS = 50;
const MAXIMUM_START_ATTEMPTS = 3;
const WEB_ELEMENT_IDENTIFIER = "element-6066-11e4-a52e-4f735466cecf";
const ACTION_BUTTON_SELECTOR =
  `.unified-extensions-item-action-button[data-extensionid="${FIREFOX_EXTENSION_ID}"]`;

/** Captured web-ext output plus the background-ready marker. */
export interface OutputState {
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

/** Running web-ext process and its captured diagnostics. */
export interface FirefoxProcess {
  readonly child: Deno.ChildProcess;
  readonly output: OutputState;
  readonly outputTasks: readonly Promise<void>[];
  readonly status: Promise<Deno.CommandStatus>;
}

/** Firefox process with an active Marionette session. */
export interface FirefoxRuntime extends FirefoxProcess {
  readonly client: MarionetteClient;
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
        `web-ext exited before the Firefox event page booted (${
          JSON.stringify(outcome.result)
        }):\n${state.lines.slice(-200).join("\n")}`,
      );
    }
  }
  throw new Error(
    `Firefox event page did not boot within ${STARTUP_TIMEOUT_MILLISECONDS}ms`,
  );
}

/**
 * Executes synchronous JavaScript in the current Marionette browsing context.
 *
 * @param client - Active Marionette client.
 * @param script - JavaScript source to execute.
 * @param args - Serializable arguments exposed to the script.
 * @returns The script result decoded from the WebDriver response.
 */
export async function executeScript(
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

/**
 * Executes asynchronous JavaScript in the current Marionette browsing context.
 *
 * @param client - Active Marionette client.
 * @param script - JavaScript source to execute.
 * @param args - Serializable arguments exposed to the script.
 * @returns The value supplied to the script's completion callback.
 */
export async function executeAsyncScript(
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

/**
 * Polls a Marionette script until its result satisfies the supplied predicate.
 *
 * @param client - Active Marionette client.
 * @param script - JavaScript source evaluated during each poll.
 * @param accept - Predicate that identifies the ready result.
 * @param label - Human-readable state name used in timeout diagnostics.
 * @returns The first accepted script result.
 */
export async function waitForScript(
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

/**
 * Navigates the current Marionette tab to an absolute URL.
 *
 * @param client - Active Marionette client.
 * @param url - Absolute destination URL.
 * @returns A promise that settles after Marionette completes navigation.
 */
export async function navigate(client: MarionetteClient, url: string): Promise<void> {
  await client.command("WebDriver:Navigate", { url });
}

/**
 * Clicks one element selected in the current Marionette context.
 *
 * @param client - Active Marionette client.
 * @param selector - CSS selector for the target element.
 * @returns A promise that settles after Marionette dispatches the click.
 */
export async function clickElement(client: MarionetteClient, selector: string): Promise<void> {
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

async function sendKeyboardKeys(
  client: MarionetteClient,
  keys: readonly string[],
): Promise<void> {
  await client.command("WebDriver:PerformActions", {
    actions: [{
      actions: keys.flatMap((value) => [
        { type: "keyDown", value },
        { type: "keyUp", value },
      ]),
      id: "point-and-shoot-keyboard",
      type: "key",
    }],
  });
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
  if (firefoxBinary !== undefined) {
    console.log(`Firefox smoke binary: ${firefoxBinary}`);
  }
  const uuidPreference = JSON.stringify({
    [FIREFOX_EXTENSION_ID]: FIREFOX_EXTENSION_UUID,
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
      ...FIREFOX_OFFLINE_PREFERENCES.flatMap((preference) => ["--pref", preference]),
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

/**
 * Closes Marionette and terminates the associated web-ext process.
 *
 * @param process - Running web-ext process to terminate.
 * @param client - Optional active Marionette session to close first.
 * @returns A promise that settles after the process and output readers stop.
 */
export async function stopFirefoxProcess(
  process: FirefoxProcess,
  client?: MarionetteClient,
): Promise<void> {
  if (client !== undefined) {
    try {
      await client.close();
    } catch {
      // Firefox may have already exited after a failed command.
    }
  }
  try {
    process.child.kill();
  } catch {
    // web-ext may already have exited.
  }
  await process.status;
  await Promise.allSettled(process.outputTasks);
}

async function startFirefoxAttempt(
  artifactsDirectory: string,
  fixtureUrl: string,
): Promise<FirefoxRuntime> {
  const marionettePort = reserveTcpPort();
  const output: OutputState = { backgroundReady: false, lines: [] };
  const child = firefoxCommand(artifactsDirectory, fixtureUrl, marionettePort).spawn();
  const process: FirefoxProcess = {
    child,
    output,
    outputTasks: [
      consumeOutput(child.stdout, "stdout", output),
      consumeOutput(child.stderr, "stderr", output),
    ],
    status: child.status,
  };

  try {
    await waitForBackground(process.output, process.status);
  } catch (error) {
    await stopFirefoxProcess(process);
    throw error;
  }

  let client: MarionetteClient | undefined;
  try {
    client = await MarionetteClient.connect(
      marionettePort,
      STATE_TIMEOUT_MILLISECONDS,
    );
    asRecord(await client.startSession(), "new session");
    return { ...process, client };
  } catch (error) {
    await stopFirefoxProcess(process, client);
    throw new MarionettePortHandoffError(
      `Firefox did not accept a Marionette session on reserved port ${marionettePort}`,
      { cause: error },
    );
  }
}

/**
 * Starts the shared web-ext Firefox harness with an active Marionette session.
 *
 * @param artifactsDirectory - Directory where web-ext writes browser artifacts.
 * @param fixtureUrl - Initial URL loaded after the extension starts.
 * @returns The running Firefox process and connected Marionette client.
 */
export async function startFirefox(
  artifactsDirectory: string,
  fixtureUrl: string,
): Promise<FirefoxRuntime> {
  return await retryMarionettePortHandoff(
    () => startFirefoxAttempt(artifactsDirectory, fixtureUrl),
    MAXIMUM_START_ATTEMPTS,
    (error, nextAttempt) => {
      console.warn(
        `${error.message}; relaunching Firefox (${nextAttempt}/${MAXIMUM_START_ATTEMPTS})`,
      );
    },
  );
}

async function runSmoke(): Promise<void> {
  await Deno.stat(join(SOURCE_DIRECTORY, "manifest.json"));
  const fixture = startFixtureServer();
  const fixtureUrl = firefoxBootFixtureUrl(fixture.base);
  const artifactsDirectory = await Deno.makeTempDir({ prefix: "pns-smoke-firefox-" });
  let runtime: FirefoxRuntime | undefined;

  try {
    runtime = await startFirefox(artifactsDirectory, fixtureUrl);
    const { client } = runtime;

    await navigate(client, fixtureUrl);
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
    assertStringIncludes(
      String(sidebar.url),
      `${FIREFOX_EXTENSION_ORIGIN}/sidepanel/sidepanel.html`,
    );
    assert(typeof sidebar.currentID === "string" && sidebar.currentID.length > 0);

    await client.command("Marionette:SetContext", { value: "content" });
    await clickElement(client, "h1");
    await waitForScript(
      client,
      'return document.activeElement?.matches("[data-point-and-shoot-host]") === true',
      (value) => value === true,
      "Firefox note composer focus",
    );
    await sendKeyboardKeys(client, ["\uE004", "\uE004", "\uE007"]);
    await waitForNoteBadge(client);
    await navigate(client, `${FIREFOX_EXTENSION_ORIGIN}/sidepanel/sidepanel.html`);

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
      assertStringIncludes(asset.url, `${FIREFOX_EXTENSION_ORIGIN}/`);
    }

    console.log(
      "Firefox smoke passed: event page, activation, sidebar, capture, font, and icon sprite.",
    );
  } catch (error) {
    if (runtime !== undefined) {
      console.error("Firefox smoke output:");
      console.error(runtime.output.lines.slice(-80).join("\n"));
    }
    throw error;
  } finally {
    if (runtime !== undefined) await stopFirefoxProcess(runtime, runtime.client);
    await fixture.close();
    await Deno.remove(artifactsDirectory, { recursive: true });
  }
}

if (import.meta.main) {
  await runSmoke();
}
