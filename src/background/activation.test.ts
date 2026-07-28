import { assertEquals } from "@std/assert";
import type { ActionClickedListener, CommandListener, TabInfo } from "../shared/browser.ts";
import {
  type ActivationBrowser,
  createActivationController,
  registerActivationHandlers,
} from "./activation.ts";

interface FakeActivationBrowser {
  readonly browser: ActivationBrowser;
  readonly calls: string[];
  actionListener(): ActionClickedListener | undefined;
  commandListener(): CommandListener | undefined;
  rejectInjection(error: Error): void;
  resolveMessage(): void;
}

function createFakeActivationBrowser(): FakeActivationBrowser {
  const calls: string[] = [];
  let actionListener: ActionClickedListener | undefined;
  let commandListener: CommandListener | undefined;
  let injectionError: Error | undefined;
  let messageError: Error | undefined = new Error("no receiving end");

  const browser: ActivationBrowser = {
    tabs: {
      query() {
        calls.push("tabs.query");
        return Promise.resolve([{ id: 9 }]);
      },
      sendMessage(tabId) {
        calls.push(`tabs.sendMessage:${tabId}`);
        return messageError === undefined
          ? Promise.resolve({ mounted: false })
          : Promise.reject(messageError);
      },
    },
    scripting: {
      executeScript({ target, files }) {
        calls.push(`scripting.executeScript:${target.tabId}:${files?.join(",")}`);
        return injectionError === undefined
          ? Promise.resolve([{ frameId: 0 }])
          : Promise.reject(injectionError);
      },
    },
    action: {
      onClicked: {
        addListener(listener) {
          actionListener = listener;
        },
      },
      setBadgeText({ tabId, text }) {
        calls.push(`action.setBadgeText:${tabId}:${text}`);
        return Promise.resolve();
      },
      setTitle({ tabId, title }) {
        calls.push(`action.setTitle:${tabId}:${title}`);
        return Promise.resolve();
      },
    },
    commands: {
      onCommand: {
        addListener(listener) {
          commandListener = listener;
        },
      },
    },
  };

  return {
    browser,
    calls,
    actionListener: () => actionListener,
    commandListener: () => commandListener,
    rejectInjection(error) {
      injectionError = error;
    },
    resolveMessage() {
      messageError = undefined;
    },
  };
}

Deno.test("activation - toggles an existing content realm without reinjecting", async () => {
  const fake = createFakeActivationBrowser();
  fake.resolveMessage();

  const result = await createActivationController(fake.browser).toggle(7);

  assertEquals(result, "toggled");
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "action.setBadgeText:7:",
    "action.setTitle:7:Point and Shoot",
  ]);
});

Deno.test("activation - injects once when the tab has no content listener", async () => {
  const fake = createFakeActivationBrowser();

  const result = await createActivationController(fake.browser).toggle(7);

  assertEquals(result, "injected");
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "scripting.executeScript:7:content/content.js",
    "action.setBadgeText:7:",
    "action.setTitle:7:Point and Shoot",
  ]);
});

Deno.test("activation - exposes restricted-page failures in the browser action", async () => {
  const fake = createFakeActivationBrowser();
  fake.rejectInjection(new Error("Cannot access a chrome:// URL"));

  const result = await createActivationController(fake.browser).toggle(7);

  assertEquals(result, "unavailable");
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "scripting.executeScript:7:content/content.js",
    "action.setBadgeText:7:!",
    "action.setTitle:7:Point and Shoot — unavailable on this page",
  ]);
});

Deno.test("activation - concurrent requests share one injection", async () => {
  const calls: string[] = [];
  let releaseMessage: (() => void) | undefined;
  const messageGate = new Promise<void>((resolve) => {
    releaseMessage = resolve;
  });
  const fake = createFakeActivationBrowser();
  const browser: ActivationBrowser = {
    ...fake.browser,
    tabs: {
      ...fake.browser.tabs,
      async sendMessage(tabId) {
        calls.push(`tabs.sendMessage:${tabId}`);
        await messageGate;
        throw new Error("no receiving end");
      },
    },
    scripting: {
      executeScript({ target }) {
        calls.push(`scripting.executeScript:${target.tabId}`);
        return Promise.resolve([{ frameId: 0 }]);
      },
    },
  };
  const controller = createActivationController(browser);

  const first = controller.toggle(7);
  const second = controller.toggle(7);
  await Promise.resolve();
  assertEquals(calls, ["tabs.sendMessage:7"]);
  releaseMessage?.();

  assertEquals(await Promise.all([first, second]), ["injected", "injected"]);
  assertEquals(calls, ["tabs.sendMessage:7", "scripting.executeScript:7"]);
});

Deno.test("activation - action and shortcut listeners work without a popup", async () => {
  const fake = createFakeActivationBrowser();
  fake.resolveMessage();
  registerActivationHandlers(fake.browser);
  const actionListener = fake.actionListener();
  const commandListener = fake.commandListener();

  actionListener?.({} satisfies TabInfo);
  commandListener?.("unrelated-command");
  actionListener?.({ id: 7 } satisfies TabInfo);
  commandListener?.("toggle-capture");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "tabs.query",
    "action.setBadgeText:7:",
    "action.setTitle:7:Point and Shoot",
    "tabs.sendMessage:9",
    "action.setBadgeText:9:",
    "action.setTitle:9:Point and Shoot",
  ]);
});
