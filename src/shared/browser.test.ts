import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { type ChromeGlobalShape, createBrowserShim, type FirefoxGlobalShape } from "./browser.ts";

interface FakeChrome {
  chromeGlobal: ChromeGlobalShape;
  calls: string[];
  setLastError(message: string | undefined): void;
}

/** Chrome-shaped fake: callback-based for asynchronous calls, modeled on the real MV3 signatures. */
function createFakeChrome(): FakeChrome {
  const calls: string[] = [];
  const storage = new Map<string, unknown>();
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
    },
    runtime: {
      getURL(path) {
        return `chrome-extension://dynamic-id/${path}`;
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
    commands: { onCommand: { addListener() {} } },
    downloads: {
      download(_options, callback) {
        calls.push("downloads.download");
        queueMicrotask(() => callback(42));
      },
    },
    action: { onClicked: { addListener() {} } },
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
    setLastError(message) {
      lastErrorMessage = message;
    },
  };
}

interface FakeFirefox {
  firefoxGlobal: FirefoxGlobalShape;
  calls: string[];
}

/** Firefox-shaped fake: promise-native for asynchronous calls, modeled on the real MV3 signatures. */
function createFakeFirefox(): FakeFirefox {
  const calls: string[] = [];
  const storage = new Map<string, unknown>();

  const firefoxGlobal: FirefoxGlobalShape = {
    tabs: {
      captureTab(tabId, options) {
        calls.push(`tabs.captureTab:${tabId}`);
        return Promise.resolve(`data:image/${options?.format ?? "png"};base64,FAKE-CAPTURE`);
      },
      query(_queryInfo) {
        calls.push("tabs.query");
        return Promise.resolve([{ id: 1, windowId: 1, active: true }]);
      },
    },
    runtime: {
      getURL(path) {
        return `moz-extension://random-uuid/${path}`;
      },
      sendMessage(message) {
        calls.push("runtime.sendMessage");
        return Promise.resolve({ echo: message });
      },
      onMessage: { addListener() {} },
    },
    storage: {
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
    commands: { onCommand: { addListener() {} } },
    downloads: {
      download() {
        calls.push("downloads.download");
        return Promise.resolve(42);
      },
    },
    action: { onClicked: { addListener() {} } },
    sidebarAction: {
      open() {
        calls.push("sidebarAction.open");
        return Promise.resolve();
      },
    },
  };

  return { firefoxGlobal, calls };
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

Deno.test("browser shim - firefox is checked before chrome (109+ ships a chrome-alias global)", () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const shim = createBrowserShim({ chrome: chromeGlobal, browser: firefoxGlobal });
  assertEquals(shim.runtimeInfo.engine, "firefox");
});

Deno.test("browser shim - captureVisibleTab agrees across engines via divergent underlying calls", async () => {
  const { chromeGlobal, calls: chromeCalls } = createFakeChrome();
  const { firefoxGlobal, calls: firefoxCalls } = createFakeFirefox();
  const chromeShim = createBrowserShim({ chrome: chromeGlobal });
  const firefoxShim = createBrowserShim({ browser: firefoxGlobal });

  const chromeResult = await chromeShim.tabs.captureVisibleTab({ format: "png" });
  const firefoxResult = await firefoxShim.tabs.captureVisibleTab({ format: "png" });

  assertEquals(chromeResult, "data:image/png;base64,FAKE-CAPTURE");
  assertEquals(firefoxResult, "data:image/png;base64,FAKE-CAPTURE");
  assertEquals(chromeCalls, ["tabs.captureVisibleTab"]);
  assertEquals(firefoxCalls, ["tabs.query", "tabs.captureTab:1"]);
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

Deno.test("browser shim - sendMessage and executeScript results agree across engines", async () => {
  const { chromeGlobal } = createFakeChrome();
  const { firefoxGlobal } = createFakeFirefox();
  const chromeShim = createBrowserShim({ chrome: chromeGlobal });
  const firefoxShim = createBrowserShim({ browser: firefoxGlobal });

  assertEquals(await chromeShim.runtime.sendMessage({ ping: 1 }), { echo: { ping: 1 } });
  assertEquals(await firefoxShim.runtime.sendMessage({ ping: 1 }), { echo: { ping: 1 } });

  const injection = { target: { tabId: 1 }, args: ["hi"] };
  assertEquals(await chromeShim.scripting.executeScript(injection), [
    { frameId: 0, result: "hi" },
  ]);
  assertEquals(await firefoxShim.scripting.executeScript(injection), [
    { frameId: 0, result: "hi" },
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
