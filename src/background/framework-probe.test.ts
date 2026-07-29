import { assertEquals } from "@std/assert";
import type { ExecuteScriptInjection, MessageListener, StorageItems } from "../shared/browser.ts";
import { FRAMEWORK_PROBE_MESSAGE } from "../shared/messages.ts";
import { DEFAULT_SETTINGS, saveSettings } from "../shared/settings.ts";
import { type FrameworkProbeBrowser, registerFrameworkProbeHandler } from "./framework-probe.ts";

function createBrowser(): {
  readonly browser: FrameworkProbeBrowser;
  readonly injections: ExecuteScriptInjection[];
  listener(): MessageListener;
  rejectProbe(): void;
  readonly storageValues: StorageItems;
} {
  const injections: ExecuteScriptInjection[] = [];
  const listeners: MessageListener[] = [];
  const storageValues: StorageItems = {};
  let rejectProbe = false;
  return {
    browser: {
      runtime: {
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
      },
      scripting: {
        executeScript(injection) {
          injections.push(injection);
          if (rejectProbe) return Promise.reject(new Error("page rejected main-world execution"));
          return Promise.resolve([{
            frameId: 7,
            result: [{
              file: "/workspace/src/CheckoutButton.tsx",
              framework: "react",
              line: 17,
              name: "CheckoutButton",
            }, null],
          }]);
        },
      },
      storage: {
        local: {
          get(keys) {
            const selected = keys == null
              ? Object.keys(storageValues)
              : Array.isArray(keys)
              ? keys
              : [keys];
            return Promise.resolve(
              Object.fromEntries(
                selected.filter((key) => key in storageValues).map((key) => [
                  key,
                  storageValues[key],
                ]),
              ),
            );
          },
          set(items) {
            Object.assign(storageValues, items);
            return Promise.resolve();
          },
        },
      },
    },
    injections,
    listener() {
      const listener = listeners[0];
      if (listener === undefined) throw new Error("framework probe listener was not registered");
      return listener;
    },
    rejectProbe() {
      rejectProbe = true;
    },
    storageValues,
  };
}

function sendProbe(
  listener: MessageListener,
  sender: Parameters<MessageListener>[1] = { frameId: 7, tab: { id: 23 } },
): Promise<unknown> {
  return new Promise((resolve) => {
    const keepAlive = listener(
      {
        cssPaths: [["#checkout"], ["#summary"]],
        type: FRAMEWORK_PROBE_MESSAGE,
      },
      sender,
      resolve,
    );
    assertEquals(keepAlive, true);
  });
}

Deno.test("framework probe handler enforces the persisted opt-in before main-world execution", async () => {
  const fake = createBrowser();
  registerFrameworkProbeHandler(fake.browser);

  assertEquals(await sendProbe(fake.listener()), { hints: [null, null] });
  assertEquals(fake.injections, []);

  await saveSettings(fake.browser.storage.local, {
    ...DEFAULT_SETTINGS,
    frameworkHints: true,
  });
  assertEquals(await sendProbe(fake.listener()), {
    hints: [{
      file: "/workspace/src/CheckoutButton.tsx",
      framework: "react",
      line: 17,
      name: "CheckoutButton",
    }, null],
  });
  assertEquals(fake.injections.length, 1);
  assertEquals(fake.injections[0]?.target, { frameIds: [7], tabId: 23 });
  assertEquals(fake.injections[0]?.world, "MAIN");
  assertEquals(fake.injections[0]?.args, [[["#checkout"], ["#summary"]], 1_024]);
});

Deno.test("framework probe handler degrades missing senders and execution failures to null hints", async () => {
  const fake = createBrowser();
  registerFrameworkProbeHandler(fake.browser);
  await saveSettings(fake.browser.storage.local, {
    ...DEFAULT_SETTINGS,
    frameworkHints: true,
  });

  assertEquals(await sendProbe(fake.listener(), {}), { hints: [null, null] });
  fake.rejectProbe();
  assertEquals(await sendProbe(fake.listener()), { hints: [null, null] });
});
