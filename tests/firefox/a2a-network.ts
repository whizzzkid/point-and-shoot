/// <reference lib="dom" />

/**
 * Representative Gecko proof for the A2A runtime path. Firefox cannot be loaded through
 * Playwright, so this uses the existing web-ext and Marionette harness. Marionette does not expose
 * WebExtension APIs to its page sandbox, so the declared optional origin is granted through
 * Firefox's internal extension-permission store. The visible extension page then discovers the
 * card, consumes authenticated SSE, and recovers through task subscription and polling.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { FIREFOX_EXTENSION_ID } from "../../build/manifest.ts";
import {
  A2A_FIXTURE_TASK_ID,
  A2A_FIXTURE_TOKEN,
  A2A_PROOF_LIMITS,
  startA2AFixtureServer,
} from "../fixtures/a2a/server.ts";
import { FIREFOX_EXTENSION_ORIGIN } from "./profile.ts";
import { executeAsyncScript, navigate, startFirefox, stopFirefoxProcess } from "./smoke.ts";

async function runFirefoxA2ANetworkProof(): Promise<void> {
  const fixture = startA2AFixtureServer();
  const artifactsDirectory = await Deno.makeTempDir({ prefix: "pns-a2a-firefox-" });
  const extensionPageUrl = `${FIREFOX_EXTENSION_ORIGIN}/options/options.html`;
  let runtime: Awaited<ReturnType<typeof startFirefox>> | undefined;

  try {
    runtime = await startFirefox(artifactsDirectory, fixture.cardUrl);
    const { client } = runtime;
    await navigate(client, extensionPageUrl);

    const hostWideLoopbackPattern = "http://127.0.0.1/*";
    await client.command("Marionette:SetContext", { value: "chrome" });
    const granted = await executeAsyncScript(
      client,
      `const done = arguments[arguments.length - 1];
       const { ExtensionPermissions } = ChromeUtils.importESModule(
         "resource://gre/modules/ExtensionPermissions.sys.mjs"
       );
       ExtensionPermissions.add(arguments[0], {
         permissions: [],
         origins: [arguments[1]]
       }).then(() => done(true), (error) => done({ error: String(error) }));`,
      [FIREFOX_EXTENSION_ID, hostWideLoopbackPattern],
    );
    assertEquals(granted, true, JSON.stringify(granted));
    await client.command("Marionette:SetContext", { value: "content" });

    const result = await executeAsyncScript(
      client,
      `const done = arguments[arguments.length - 1];
       const [cardUrl, interfaceOrigin, limits, taskId, token] = arguments;
       (async () => {
         const module = await import(new URL("/shared/a2a/client.js", location.origin).href);
         const marionetteSafeFetch = async (input, init) => {
           const response = await fetch(input, init);
           const body = await response.text();
           const headers = {
             "content-type": response.headers.get("content-type") ?? "application/octet-stream"
           };
           const contentLength = response.headers.get("content-length");
           if (contentLength !== null) headers["content-length"] = contentLength;
           const pageGlobal = window.wrappedJSObject;
           return new pageGlobal.Response(body, {
             status: response.status,
             statusText: response.statusText,
             headers
           });
         };
         const factory = module.createA2AClientFactory({
           fetch: marionetteSafeFetch,
           preferredTransports: ["JSONRPC"],
           limits
         });
         const card = await factory.resolve(new URL(cardUrl), AbortSignal.timeout(2000));
         const target = factory.select(card);
         if (target.url.origin !== interfaceOrigin) {
           throw new Error("selected interface escaped the exact-port allowlist");
         }
         const client = factory.create(target);
         const requestStream = async (method, id, extraHeaders = {}) => {
           const response = await fetch(target.url, {
             method: "POST",
             headers: {
               Accept: "text/event-stream",
               Authorization: "Bearer " + token,
               "Content-Type": "application/json",
               ...extraHeaders
             },
             body: JSON.stringify({
               jsonrpc: "2.0",
               id,
               method,
               params: method === "SubscribeToTask"
                 ? { id: taskId }
                 : {
                   message: {
                     messageId: "firefox-message",
                     role: "ROLE_USER",
                     parts: [{ text: "firefox proof" }]
                   }
                 }
             })
           });
           if (response.headers.get("content-type")?.startsWith("text/event-stream") !== true) {
             throw new Error("Firefox did not receive an SSE response");
           }
           return (await response.text())
             .split("\\n\\n")
             .filter(Boolean)
             .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
         };
         const interrupted = await requestStream(
           "SendStreamingMessage",
           1,
           { "X-Fixture-Disconnect": "after-status" }
         );
         const recovered = await requestStream("SubscribeToTask", 2);
         const task = await client.getTask({ id: taskId }, {
           signal: AbortSignal.timeout(2000),
           serviceParameters: { Authorization: "Bearer " + token }
         });
         done({
           interrupted: interrupted.length,
           recovered: recovered.length,
           recoveredTerminal: recovered.at(-1)?.result?.statusUpdate?.status?.state,
           terminal: task.status?.state
         });
       })().catch((error) => done({
         error: String(error),
         cause: String(error?.cause),
         causeStack: error?.cause?.stack,
         stack: error?.stack
       }));`,
      [
        fixture.cardUrl,
        fixture.interfaceOrigin,
        A2A_PROOF_LIMITS,
        A2A_FIXTURE_TASK_ID,
        A2A_FIXTURE_TOKEN,
      ],
    );
    assert(typeof result === "object" && result !== null);
    const proof = result as Record<string, unknown>;
    assertEquals(proof.error, undefined, JSON.stringify(proof));
    assertEquals(proof.interrupted, 2);
    assertEquals(proof.recovered, 2);
    assertEquals(proof.recoveredTerminal, "TASK_STATE_COMPLETED");
    assertEquals(proof.terminal, "TASK_STATE_COMPLETED");
    console.log(
      "Firefox A2A proof passed: shim grant boundary, authenticated SSE, subscription, and polling recovery.",
    );
  } catch (error) {
    if (runtime !== undefined) {
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
  await runFirefoxA2ANetworkProof();
}
