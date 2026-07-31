import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  type ChromeGlobalShape,
  type CommandInfo,
  createBrowserShim,
  type FirefoxGlobalShape,
  type StorageChangedListener,
} from "./browser.ts";

interface FakeChrome {
  chromeGlobal: ChromeGlobalShape;
  calls: string[];
  emitStorageChange(changes: Parameters<StorageChangedListener>[0]): void;
  setLastError(message: string | undefined): void;
}

/** Chrome-shaped fake: callback-based for asynchronous calls, modeled on the real MV3 signatures. */
function createFakeChrome(): FakeChrome {
  const calls: string[] = [];
  const storage = new Map<string, unknown>();
  const storageListeners = new Set<StorageChangedListener>();
  let lastErrorMessage: string | undefined;

  const chromeGlobal: ChromeGlobalShape = {
    tabs: {
      captureVisibleTab(_windowId, options, callback) {
        calls.push("tabs.captureVisibleTab");
        queueMicrotask(() =>
          callback(`data:image/${options?.format ?? "png"};base64,FAKE-CAPTURE`)
        );
      },
      query(_queryInfo, callback) {
        calls.push("tabs.query");
        queueMicrotask(() => callback([{ id: 1, windowId: 1, active: true }]));
      },
      create(properties, callback) {
        calls.push(`tabs.create:${properties.url}`);
        queueMicrotask(() => callback({ id: 2, windowId: 1, active: true }));
      },
      sendMessage(tabId, message, callback) {
        calls.push(`tabs.sendMessage:${tabId}`);
        queueMicrotask(() => callback({ echo: message }));
      },
    },
    runtime: {
      getManifest() {
        return { version: "0.1.0" };
      },
      getURL(path) {
        return `chrome-extension://dynamic-id/${path}`;
      },
      openOptionsPage(callback) {
        calls.push("runtime.openOptionsPage");
        queueMicrotask(callback);
      },
      sendMessage(message, callback) {
        calls.push("runtime.sendMessage");
        queueMicrotask(() => callback({ echo: message }));
      },
      onMessage: { addListener() {} },
      get lastError() {
        return lastErrorMessage === undefined ? undefined : { message: lastErrorMessage };
      },
    },
    storage: {
      onChanged: {
        addListener(listener) {
          storageListeners.add(listener);
        },
        removeListener(listener) {
          storageListeners.delete(listener);
        },
      },
      local: {
        get(keys, callback) {
          calls.push("storage.local.get");
          queueMicrotask(() => {
            if (keys == null) {
              callback(Object.fromEntries(storage));
              return;
            }
            const list = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of list) if (storage.has(key)) result[key] = storage.get(key);
            callback(result);
          });
        },
        set(items, callback) {
          calls.push("storage.local.set");
          queueMicrotask(() => {
            for (const [key, value] of Object.entries(items)) storage.set(key, value);
            callback();
          });
        },
        remove(keys, callback) {
          calls.push("storage.local.remove");
          queueMicrotask(() => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) storage.delete(key);
            callback();
          });
        },
      },
    },
    scripting: {
      executeScript(injection, callback) {
        calls.push("scripting.executeScript");
        queueMicrotask(() => callback([{ frameId: 0, result: injection.args?.[0] }]));
      },
    },
    commands: {
      getAll(callback) {
        calls.push("commands.getAll");
        queueMicrotask(() =>
          callback([{
            description: "Toggle capture",
            name: "toggle-capture",
            shortcut: "Command+Shift+P",
          }])
        );
      },
      onCommand: { addListener() {} },
    },
    downloads: {
      download(_options, callback) {
        calls.push("downloads.download");
        queueMicrotask(() => callback(42));
      },
    },
    action: {
      onClicked: { addListener() {} },
      setBadgeText(details, callback) {
        calls.push(`action.setBadgeText:${details.tabId}:${details.text}`);
        queueMicrotask(callback);
      },
      setTitle(details, callback) {
        calls.push(`action.setTitle:${details.tabId}:${details.title}`);
        queueMicrotask(callback);
      },
    },
    sidePanel: {
      open(_options, callback) {
        calls.push("sidePanel.open");
        queueMicrotask(() => callback());
      },
    },
  };

  return {
    chromeGlobal,
    calls,
    emitStorageChange(changes) {
      for (const listener of storageListeners) listener(changes, "local");
    },
    setLastError(message) {
      lastErrorMessage = message;
    },
  };
}

interface FakeFirefox {
  firefoxGlobal: FirefoxGlobalShape;
  calls: string[];
  emitStorageChange(changes: Parameters<StorageChangedListener>[0]): void;
}

/** Firefox-shaped fake: promise-native for asynchronous calls, modeled on the real MV3 signatures. */
function createFakeFirefox(): FakeFirefox {
  const calls: string[] = [];
  const storage = new Map<string, unknown>();
  const storageListeners = new Set<StorageChangedListener>();

  const firefoxGlobal: FirefoxGlobalShape = {
    tabs: {
      captureVisibleTab(_windowId, options) {
        calls.push("tabs.captureVisibleTab");
        return Promise.resolve(`data:image/${options?.format ?? "png"};base64,FAKE-CAPTURE`);
      },
      query(_queryInfo) {
        calls.push("tabs.query");
        return Promise.resolve([{ id: 1, windowId: 1, active: true }]);
      },
      create(properties) {
        calls.push(`tabs.create:${properties.url}`);
        return Promise.resolve({ id: 2, windowId: 1, active: true });
      },
      sendMessage(tabId, message) {
        calls.push(`tabs.sendMessage:${tabId}`);
        return Promise.resolve({ echo: message });
      },
    },
    runtime: {
      getBrowserInfo() {
        return Promise.resolve({ name: "Firefox" });
      },
      getManifest() {
        return { version: "0.1.0" };
      },
      getURL(path) {
        return `moz-extension://random-uuid/${path}`;
      },
      openOptionsPage() {
        calls.push("runtime.openOptionsPage");
        return Promise.resolve();
      },
      sendMessage(message) {
        calls.push("runtime.sendMessage");
        return Promise.resolve({ echo: message });
      },
      onMessage: { addListener() {} },
    },
    storage: {
      onChanged: {
        addListener(listener) {
          storageListeners.add(listener);
        },
        removeListener(listener) {
          storageListeners.delete(listener);
        },
      },
      local: {
        get(keys) {
          calls.push("storage.local.get");
          if (keys == null) return Promise.resolve(Object.fromEntries(storage));
          const list = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of list) if (storage.has(key)) result[key] = storage.get(key);
          return Promise.resolve(result);
        },
        set(items) {
          calls.push("storage.local.set");
          for (const [key, value] of Object.entries(items)) storage.set(key, value);
          return Promise.resolve();
        },
        remove(keys) {
          calls.push("storage.local.remove");
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) storage.delete(key);
          return Promise.resolve();
        },
      },
    },
    scripting: {
      executeScript(injection) {
        calls.push("scripting.executeScript");
        return Promise.resolve([{ frameId: 0, result: injection.args?.[0] }]);
      },
    },
    commands: {
      getAll() {
        calls.push("commands.getAll");
        return Promise.resolve([{
          description: "Toggle capture",
          name: "toggle-capture",
          shortcut: "Command+Shift+P",
        }]);
      },
      onCommand: { addListener() {} },
    },
    downloads: {
      download() {
        calls.push("downloads.download");
        return Promise.resolve(42);
      },
    },
    action: {
      onClicked: { addListener() {} },
      setBadgeText(details) {
        calls.push(`action.setBadgeText:${details.tabId}:${details.text}`);
        return Promise.resolve();
      },
      setTitle(details) {
        calls.push(`action.setTitle:${details.tabId}:${details.title}`);
        return Promise.resolve();
      },
    },
    sidebarAction: {
      open() {
        calls.push("sidebarAction.open");
        return Promise.resolve();
      },
    },
  };

  return {
    firefoxGlobal,
    calls,
    emitStorageChange(changes) {
      for (const listener of storageListeners) listener(changes, "local");
    },
  };
}

Deno.test("browser shim - runtimeInfo reports the detected engine", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  assertEquals(createBrowserShim({ chrome: chromeGlobal }).runtimeInfo.engine, "chrome");
  assertEquals(createBrowserShim({ browser: firefoxGlobal }).runtimeInfo.engine, "firefox");
});

Deno.test("browser shim - getURL delegates resource paths to each engine", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const resource = "src/shared/design/fonts/inter-400.woff2";

  assertEquals(
    createBrowserShim({ chrome: chromeGlobal }).runtime.getURL(resource),
    `chrome-extension://dynamic-id/${resource}`,
  );
  assertEquals(
    createBrowserShim({ browser: firefoxGlobal }).runtime.getURL(resource),
    `moz-extension://random-uuid/${resource}`,
  );
});

Deno.test("browser shim - getManifest exposes the packaged version on each engine", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();

  assertEquals(createBrowserShim({ chrome: chromeGlobal }).runtime.getManifest().version, "0.1.0");
  assertEquals(
    createBrowserShim({ browser: firefoxGlobal }).runtime.getManifest().version,
    "0.1.0",
  );
});

Deno.test("browser shim - firefox is checked before chrome (109+ ships a chrome-alias global)", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const shim = createBrowserShim({ chrome: chromeGlobal, browser: firefoxGlobal });
  assertEquals(shim.runtimeInfo.engine, "firefox");
});

Deno.test("browser shim - chromium browser alias without Firefox identity stays on chrome", async () => {
  const { chromeGlobal, calls } = createFakeChrome();
  const chromiumBrowserAlias = chromeGlobal as unknown as FirefoxGlobalShape;
  const shim = createBrowserShim({ browser: chromiumBrowserAlias, chrome: chromeGlobal });

  assertEquals(shim.runtimeInfo.engine, "chrome");
  assertEquals(
    await shim.tabs.captureVisibleTab({ format: "png" }),
    "data:image/png;base64,FAKE-CAPTURE",
  );
  assertEquals(calls, ["tabs.captureVisibleTab"]);
});

Deno.test("browser shim - partial page browser global does not mask chrome", () => {
  const { chromeGlobal } = createFakeChrome();
  const partialBrowserGlobal = {} as FirefoxGlobalShape;

  assertEquals(
    createBrowserShim({ browser: partialBrowserGlobal, chrome: chromeGlobal }).runtimeInfo.engine,
    "chrome",
  );
});

Deno.test("browser shim - construction defers APIs unavailable to content scripts", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const chromeContentGlobal = {
    ...chromeGlobal,
    action: undefined,
    commands: undefined,
  } as unknown as ChromeGlobalShape;
  const firefoxContentGlobal = {
    ...firefoxGlobal,
    action: undefined,
    commands: undefined,
    tabs: undefined,
  } as unknown as FirefoxGlobalShape;

  assertEquals(
    createBrowserShim({ chrome: chromeContentGlobal }).runtime.getURL("asset.svg"),
    "chrome-extension://dynamic-id/asset.svg",
  );
  assertEquals(
    createBrowserShim({ browser: firefoxContentGlobal }).runtime.getURL("asset.svg"),
    "moz-extension://random-uuid/asset.svg",
  );
});

Deno.test("browser shim - captureVisibleTab agrees across callback and promise API shapes", async () => {
  const { chromeGlobal, calls: chromeCalls } = createFakeChrome();
  const { firefoxGlobal, calls: firefoxCalls } = createFakeFirefox();
  const chromeShim = createBrowserShim({ chrome: chromeGlobal });
  const firefoxShim = createBrowserShim({ browser: firefoxGlobal });

  const chromeResult = await chromeShim.tabs.captureVisibleTab({ format: "png" });
  const firefoxResult = await firefoxShim.tabs.captureVisibleTab({ format: "png" });

  assertEquals(chromeResult, "data:image/png;base64,FAKE-CAPTURE");
  assertEquals(firefoxResult, "data:image/png;base64,FAKE-CAPTURE");
  assertEquals(chromeCalls, ["tabs.captureVisibleTab"]);
  assertEquals(firefoxCalls, ["tabs.captureVisibleTab"]);
});

Deno.test("browser shim - openPanel agrees across engines via divergent underlying calls", async () => {
  const { chromeGlobal, calls: chromeCalls } = createFakeChrome();
  const { firefoxGlobal, calls: firefoxCalls } = createFakeFirefox();

  await createBrowserShim({ chrome: chromeGlobal }).openPanel(7);
  await createBrowserShim({ browser: firefoxGlobal }).openPanel(7);

  assertEquals(chromeCalls, ["sidePanel.open"]);
  assertEquals(firefoxCalls, ["sidebarAction.open"]);
});

Deno.test("browser shim - callback-style chrome storage resolves through a promise", async () => {
  const { chromeGlobal } = createFakeChrome();
  const shim = createBrowserShim({ chrome: chromeGlobal });

  await shim.storage.local.set({ note: "hello" });
  const result = await shim.storage.local.get("note");

  assertEquals(result, { note: "hello" });
});

Deno.test("browser shim - storage round-trips identically on both engines", async () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();

  for (
    const shim of [
      createBrowserShim({ chrome: chromeGlobal }),
      createBrowserShim({ browser: firefoxGlobal }),
    ]
  ) {
    await shim.storage.local.set({ a: 1, b: 2 });
    assertEquals(await shim.storage.local.get(), { a: 1, b: 2 });
    await shim.storage.local.remove("a");
    assertEquals(await shim.storage.local.get(), { b: 2 });
  }
});

Deno.test("browser shim - messages and executeScript results agree across engines", async () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const chromeShim = createBrowserShim({ chrome: chromeGlobal });
  const firefoxShim = createBrowserShim({ browser: firefoxGlobal });

  assertEquals(await chromeShim.runtime.sendMessage({ ping: 1 }), { echo: { ping: 1 } });
  assertEquals(await firefoxShim.runtime.sendMessage({ ping: 1 }), { echo: { ping: 1 } });
  assertEquals(await chromeShim.tabs.sendMessage(7, { toggle: true }), {
    echo: { toggle: true },
  });
  assertEquals(await firefoxShim.tabs.sendMessage(7, { toggle: true }), {
    echo: { toggle: true },
  });

  const injection = { target: { tabId: 1 }, args: ["hi"] };
  assertEquals(await chromeShim.scripting.executeScript(injection), [
    { frameId: 0, result: "hi" },
  ]);
  assertEquals(await firefoxShim.scripting.executeScript(injection), [
    { frameId: 0, result: "hi" },
  ]);
});

Deno.test("browser shim - options opening agrees across engines", async () => {
  const { chromeGlobal, calls: chromeCalls } = createFakeChrome();
  const { firefoxGlobal, calls: firefoxCalls } = createFakeFirefox();

  await createBrowserShim({ chrome: chromeGlobal }).runtime.openOptionsPage();
  await createBrowserShim({ browser: firefoxGlobal }).runtime.openOptionsPage();

  assertEquals(chromeCalls, ["runtime.openOptionsPage"]);
  assertEquals(firefoxCalls, ["runtime.openOptionsPage"]);
});

Deno.test("browser shim - options navigation and storage changes agree across engines", async () => {
  const chromeFake = createFakeChrome();
  const firefoxFake = createFakeFirefox();
  const chromeShim = createBrowserShim({ chrome: chromeFake.chromeGlobal });
  const firefoxShim = createBrowserShim({ browser: firefoxFake.firefoxGlobal });
  const expectedCommands: CommandInfo[] = [{
    description: "Toggle capture",
    name: "toggle-capture",
    shortcut: "Command+Shift+P",
  }];

  assertEquals(
    await chromeShim.tabs.create({ url: "chrome://extensions/shortcuts" }),
    { active: true, id: 2, windowId: 1 },
  );
  assertEquals(
    await firefoxShim.tabs.create({ url: "about:addons" }),
    { active: true, id: 2, windowId: 1 },
  );
  assertEquals(await chromeShim.commands.getAll(), expectedCommands);
  assertEquals(await firefoxShim.commands.getAll(), expectedCommands);

  const observed: string[] = [];
  const chromeListener: StorageChangedListener = (_changes, areaName) => {
    observed.push(`chrome:${areaName}`);
  };
  const firefoxListener: StorageChangedListener = (_changes, areaName) => {
    observed.push(`firefox:${areaName}`);
  };
  chromeShim.storage.onChanged.addListener(chromeListener);
  firefoxShim.storage.onChanged.addListener(firefoxListener);
  chromeFake.emitStorageChange({ settings: { newValue: { themeOverride: "dark" } } });
  firefoxFake.emitStorageChange({ settings: { newValue: { themeOverride: "light" } } });
  chromeShim.storage.onChanged.removeListener(chromeListener);
  firefoxShim.storage.onChanged.removeListener(firefoxListener);
  chromeFake.emitStorageChange({});
  firefoxFake.emitStorageChange({});

  assertEquals(observed, ["chrome:local", "firefox:local"]);
  assertEquals(chromeFake.calls.slice(-2), [
    "tabs.create:chrome://extensions/shortcuts",
    "commands.getAll",
  ]);
  assertEquals(firefoxFake.calls.slice(-2), [
    "tabs.create:about:addons",
    "commands.getAll",
  ]);
});

Deno.test("browser shim - browser action state agrees across engines", async () => {
  const { chromeGlobal, calls: chromeCalls } = createFakeChrome();
  const { firefoxGlobal, calls: firefoxCalls } = createFakeFirefox();

  for (
    const shim of [
      createBrowserShim({ chrome: chromeGlobal }),
      createBrowserShim({ browser: firefoxGlobal }),
    ]
  ) {
    await shim.action.setBadgeText({ tabId: 7, text: "!" });
    await shim.action.setTitle({ tabId: 7, title: "Unavailable" });
  }

  assertEquals(chromeCalls, [
    "action.setBadgeText:7:!",
    "action.setTitle:7:Unavailable",
  ]);
  assertEquals(firefoxCalls, [
    "action.setBadgeText:7:!",
    "action.setTitle:7:Unavailable",
  ]);
});

Deno.test("browser shim - a chrome lastError rejects the promise", async () => {
  const { chromeGlobal, setLastError } = createFakeChrome();
  const shim = createBrowserShim({ chrome: chromeGlobal });
  setLastError("no active tab");

  await assertRejects(
    () => shim.tabs.query({ active: true, currentWindow: true }),
    Error,
    "no active tab",
  );
});

Deno.test("browser shim - downloads resolve to the same id on both engines", async () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const options = { url: "https://example.test/report.json" };
  assertEquals(await createBrowserShim({ chrome: chromeGlobal }).downloads.download(options), 42);
  assertEquals(
    await createBrowserShim({ browser: firefoxGlobal }).downloads.download(options),
    42,
  );
});

Deno.test("browser shim - throws when neither global is present", () => {
  assertThrows(() => createBrowserShim({}), Error, "neither `browser` nor `chrome`");
});

Deno.test("browser shim - importing the module does not eagerly touch real globals", async () => {
  const mod = await import("./browser.ts");
  // Accessing the lazy singleton in this Deno test process (no chrome/browser global) throws
  // only on first property access, proving detection is deferred rather than run at module load.
  assertThrows(() => mod.browser.runtimeInfo, Error, "neither `browser` nor `chrome`");
});
