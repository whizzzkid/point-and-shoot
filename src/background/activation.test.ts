import { assertEquals } from "@std/assert";
import type { MessageListener } from "../shared/browser.ts";
import { TOGGLE_ACTIVE_TAB_MESSAGE } from "../shared/messages.ts";
import {
  type ActivationBrowser,
  createActivationController,
  registerActivationHandlers,
} from "./activation.ts";

interface FakeActivationBrowser {
  readonly browser: ActivationBrowser;
  readonly calls: string[];
  runtimeListener(): MessageListener | undefined;
  rejectInjection(error: Error): void;
  resolveMessage(): void;
}

function createFakeActivationBrowser(): FakeActivationBrowser {
  const calls: string[] = [];
  let runtimeListener: MessageListener | undefined;
  let injectionError: Error | undefined;
  let messageError: Error | undefined = new Error("no receiving end");

  const browser: ActivationBrowser = {
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeListener = listener;
        },
      },
    },
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
      setBadgeText({ tabId, text }) {
        calls.push(`action.setBadgeText:${tabId}:${text}`);
        return Promise.resolve();
      },
      setTitle({ tabId, title }) {
        calls.push(`action.setTitle:${tabId}:${title}`);
        return Promise.resolve();
      },
    },
  };

  return {
    browser,
    calls,
    runtimeListener: () => runtimeListener,
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

  assertEquals(result, { mounted: false, result: "toggled" });
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "action.setBadgeText:undefined:",
    "action.setTitle:undefined:Point and Shoot — Start session",
  ]);
});

Deno.test("activation - injects once when the tab has no content listener", async () => {
  const fake = createFakeActivationBrowser();

  const result = await createActivationController(fake.browser).toggle(7);

  assertEquals(result, { mounted: true, result: "injected" });
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "scripting.executeScript:7:content/content.js",
    "action.setBadgeText:undefined:",
    "action.setTitle:undefined:Point and Shoot — Start session",
  ]);
});

Deno.test("activation - exposes restricted-page failures in the browser action", async () => {
  const fake = createFakeActivationBrowser();
  fake.rejectInjection(new Error("Cannot access a chrome:// URL"));

  const result = await createActivationController(fake.browser).toggle(7);

  assertEquals(result, { mounted: false, result: "unavailable" });
  assertEquals(fake.calls, [
    "tabs.sendMessage:7",
    "scripting.executeScript:7:content/content.js",
    "action.setBadgeText:undefined:!",
    "action.setTitle:undefined:Point and Shoot — unavailable on this page",
  ]);
});

Deno.test("activation - mount and unmount converge without blind toggles", async () => {
  const fake = createFakeActivationBrowser();
  let mounted = false;
  const browser: ActivationBrowser = {
    ...fake.browser,
    tabs: {
      ...fake.browser.tabs,
      sendMessage(tabId, message) {
        fake.calls.push(`tabs.sendMessage:${tabId}:${String(message)}`);
        if (message === "point-and-shoot:toggle-overlay") mounted = !mounted;
        return Promise.resolve({ mounted });
      },
    },
  };
  const controller = createActivationController(browser);

  assertEquals(await controller.mount(7), { mounted: true, result: "toggled" });
  assertEquals(await controller.mount(7), { mounted: true, result: "toggled" });
  assertEquals(await controller.unmount(7), { mounted: false, result: "toggled" });
  assertEquals(await controller.unmount(7), { mounted: false, result: "toggled" });
  assertEquals(
    fake.calls.filter((call) => call.includes("toggle-overlay")).length,
    2,
  );
});

Deno.test("activation - unmount does not inject a missing content realm", async () => {
  const fake = createFakeActivationBrowser();

  assertEquals(
    await createActivationController(fake.browser).unmount(7),
    { mounted: false, result: "toggled" },
  );
  assertEquals(fake.calls, ["tabs.sendMessage:7"]);
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

  assertEquals(await Promise.all([first, second]), [
    { mounted: true, result: "injected" },
    { mounted: true, result: "injected" },
  ]);
  assertEquals(calls, ["tabs.sendMessage:7", "scripting.executeScript:7"]);
});

Deno.test("activation - runtime messages toggle the queried active tab and return its state", async () => {
  const fake = createFakeActivationBrowser();
  fake.resolveMessage();
  registerActivationHandlers(fake.browser);
  const response = new Promise<unknown>((resolve) => {
    const retained = fake.runtimeListener()?.(TOGGLE_ACTIVE_TAB_MESSAGE, {}, resolve);
    assertEquals(retained, true);
  });

  assertEquals(await response, { mounted: false, ok: true, result: "toggled" });
  assertEquals(fake.calls, [
    "tabs.query",
    "tabs.sendMessage:9",
    "action.setBadgeText:undefined:",
    "action.setTitle:undefined:Point and Shoot — Start session",
  ]);
});

Deno.test("activation - restoreActionState fires on successful toggle via runtime message", async () => {
  const fake = createFakeActivationBrowser();
  fake.resolveMessage();
  let restored = 0;
  registerActivationHandlers(
    fake.browser,
    createActivationController(fake.browser),
    () => {
      restored += 1;
      return Promise.resolve();
    },
  );
  const response = new Promise<unknown>((resolve) => {
    fake.runtimeListener()?.(TOGGLE_ACTIVE_TAB_MESSAGE, {}, resolve);
  });

  await response;
  assertEquals(restored, 1);
});

Deno.test("activation - restoreActionState does not fire when page is unavailable", async () => {
  const fake = createFakeActivationBrowser();
  fake.rejectInjection(new Error("Cannot access a chrome:// URL"));
  let restored = 0;
  registerActivationHandlers(
    fake.browser,
    createActivationController(fake.browser),
    () => {
      restored += 1;
      return Promise.resolve();
    },
  );
  const response = new Promise<unknown>((resolve) => {
    fake.runtimeListener()?.(TOGGLE_ACTIVE_TAB_MESSAGE, {}, resolve);
  });

  await response;
  assertEquals(restored, 0);
});
