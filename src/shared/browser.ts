/**
 * Promise-based, cross-browser wrapper over the subset of the WebExtensions API this project
 * actually uses.
 *
 * This is the single seam where Chrome and Firefox differ. Firefox exposes a `browser.*` global
 * whose methods return promises natively. Chrome exposes only `chrome.*`, and in MV3 that global
 * returns promises for some methods when the callback is omitted, but not uniformly — so every
 * Chrome call in this module goes through {@link promisifyWithResult} or {@link promisifyVoid}
 * regardless of whether that particular method happens to support a promise on its own. Detection
 * of which global is present happens once, on first access to {@link browser}, and every method on
 * the resulting object delegates to that one detected adapter — never a per-call-site branch.
 *
 * Nothing outside this module should reference `chrome.*` or `browser.*` directly.
 *
 * @module
 */

/** Which underlying WebExtensions global was detected. */
export type Engine = "chrome" | "firefox";

/** Describes the detected engine. Tests assert against this to confirm the right adapter ran. */
export interface RuntimeInfo {
  readonly engine: Engine;
}

/** Options accepted by {@link BrowserShim.tabs}'s `captureVisibleTab`. */
export interface CaptureOptions {
  readonly format?: "png" | "jpeg";
  readonly quality?: number;
}

/** Minimal tab shape this project reads. */
export interface TabInfo {
  readonly id?: number;
  readonly windowId?: number;
  readonly active?: boolean;
}

/** Query filter accepted by {@link BrowserShim.tabs}'s `query`. */
export interface TabQueryInfo {
  readonly active?: boolean;
  readonly currentWindow?: boolean;
}

/** Injection target and payload for {@link BrowserShim.scripting}'s `executeScript`. */
export interface ExecuteScriptInjection {
  readonly target: { readonly tabId: number; readonly frameIds?: readonly number[] };
  readonly func?: () => unknown;
  readonly args?: readonly unknown[];
  readonly files?: readonly string[];
}

/** Result entry produced by `executeScript`, one per matched frame. */
export interface ExecuteScriptResult {
  readonly frameId?: number;
  readonly result?: unknown;
}

/** Options accepted by {@link BrowserShim.downloads}'s `download`. */
export interface DownloadOptions {
  readonly url: string;
  readonly filename?: string;
  readonly saveAs?: boolean;
}

/** Sender metadata delivered alongside a runtime message. */
export interface MessageSender {
  readonly tab?: TabInfo;
  readonly id?: string;
}

/** Listener signature for `runtime.onMessage`. Returning `true` keeps the channel open. */
export type MessageListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

/** Listener signature for `commands.onCommand`. */
export type CommandListener = (command: string) => void;

/** Listener signature for `action.onClicked`. */
export type ActionClickedListener = (tab: TabInfo) => void;

/** Storage values keyed by name; the shape this project reads and writes are always objects. */
export type StorageItems = Record<string, unknown>;

/**
 * The normalized, promise-based surface every other module in this codebase imports instead of
 * `chrome.*` or `browser.*`. Every method here resolves or rejects a promise; none take a
 * callback.
 */
export interface BrowserShim {
  readonly runtimeInfo: RuntimeInfo;
  readonly tabs: {
    /**
     * Captures the currently visible tab. Normalizes over Chrome's `tabs.captureVisibleTab`
     * (visible-tab-only) and Firefox's `tabs.captureTab` (specific-tab, looked up via
     * {@link TabQueryInfo}) — the one genuine capture-API divergence between the two engines.
     */
    captureVisibleTab(options?: CaptureOptions): Promise<string>;
    query(queryInfo: TabQueryInfo): Promise<TabInfo[]>;
  };
  readonly runtime: {
    sendMessage(message: unknown): Promise<unknown>;
    readonly onMessage: { addListener(listener: MessageListener): void };
  };
  readonly storage: {
    readonly local: {
      get(keys?: string | readonly string[] | null): Promise<StorageItems>;
      set(items: StorageItems): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
  };
  readonly scripting: {
    executeScript(injection: ExecuteScriptInjection): Promise<ExecuteScriptResult[]>;
  };
  readonly commands: {
    readonly onCommand: { addListener(listener: CommandListener): void };
  };
  readonly downloads: {
    download(options: DownloadOptions): Promise<number>;
  };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
  };
  /**
   * Opens the extension's side panel / sidebar for the given tab (or the current one).
   * Normalizes over Chrome's `sidePanel.open` and Firefox's `sidebarAction.open` — the other
   * genuine naming divergence between the two engines.
   */
  openPanel(tabId?: number): Promise<void>;
}

/** Shape of Chrome's MV3 global this module depends on — callback-based throughout. */
export interface ChromeGlobalShape {
  readonly tabs: {
    captureVisibleTab(
      windowId: number | undefined,
      options: CaptureOptions | undefined,
      callback: (dataUrl: string) => void,
    ): void;
    query(queryInfo: TabQueryInfo, callback: (tabs: TabInfo[]) => void): void;
  };
  readonly runtime: {
    sendMessage(message: unknown, callback: (response: unknown) => void): void;
    readonly onMessage: { addListener(listener: MessageListener): void };
    readonly lastError: { readonly message?: string } | undefined;
  };
  readonly storage: {
    readonly local: {
      get(
        keys: string | readonly string[] | null | undefined,
        callback: (items: StorageItems) => void,
      ): void;
      set(items: StorageItems, callback: () => void): void;
      remove(keys: string | readonly string[], callback: () => void): void;
    };
  };
  readonly scripting: {
    executeScript(
      injection: ExecuteScriptInjection,
      callback: (results: ExecuteScriptResult[]) => void,
    ): void;
  };
  readonly commands: { readonly onCommand: { addListener(listener: CommandListener): void } };
  readonly downloads: {
    download(options: DownloadOptions, callback: (downloadId: number) => void): void;
  };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
  };
  readonly sidePanel: {
    open(options: { readonly tabId?: number }, callback: () => void): void;
  };
}

/** Shape of Firefox's MV3 global this module depends on — promise-based throughout. */
export interface FirefoxGlobalShape {
  readonly tabs: {
    captureTab(tabId: number | undefined, options?: CaptureOptions): Promise<string>;
    query(queryInfo: TabQueryInfo): Promise<TabInfo[]>;
  };
  readonly runtime: {
    sendMessage(message: unknown): Promise<unknown>;
    readonly onMessage: { addListener(listener: MessageListener): void };
  };
  readonly storage: {
    readonly local: {
      get(keys?: string | readonly string[] | null): Promise<StorageItems>;
      set(items: StorageItems): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
  };
  readonly scripting: {
    executeScript(injection: ExecuteScriptInjection): Promise<ExecuteScriptResult[]>;
  };
  readonly commands: { readonly onCommand: { addListener(listener: CommandListener): void } };
  readonly downloads: { download(options: DownloadOptions): Promise<number> };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
  };
  readonly sidebarAction: { open(): Promise<void> };
}

/** The two globals a WebExtensions runtime may expose. Exactly one is present at a time. */
export interface ExtensionGlobalScope {
  readonly chrome?: ChromeGlobalShape;
  readonly browser?: FirefoxGlobalShape;
}

function promisifyWithResult<T>(
  chromeGlobal: ChromeGlobalShape,
  invoke: (callback: (result: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    invoke((result) => {
      const lastError = chromeGlobal.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? "chrome API call failed"));
        return;
      }
      resolve(result);
    });
  });
}

function promisifyVoid(
  chromeGlobal: ChromeGlobalShape,
  invoke: (callback: () => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    invoke(() => {
      const lastError = chromeGlobal.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? "chrome API call failed"));
        return;
      }
      resolve();
    });
  });
}

function createChromeShim(chromeGlobal: ChromeGlobalShape): BrowserShim {
  return {
    runtimeInfo: { engine: "chrome" },
    tabs: {
      captureVisibleTab(options) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.tabs.captureVisibleTab(undefined, options, cb),
        );
      },
      query(queryInfo) {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.tabs.query(queryInfo, cb));
      },
    },
    runtime: {
      sendMessage(message) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.runtime.sendMessage(message, cb),
        );
      },
      onMessage: chromeGlobal.runtime.onMessage,
    },
    storage: {
      local: {
        get(keys) {
          return promisifyWithResult(
            chromeGlobal,
            (cb) => chromeGlobal.storage.local.get(keys, cb),
          );
        },
        set(items) {
          return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.storage.local.set(items, cb));
        },
        remove(keys) {
          return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.storage.local.remove(keys, cb));
        },
      },
    },
    scripting: {
      executeScript(injection) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.scripting.executeScript(injection, cb),
        );
      },
    },
    commands: { onCommand: chromeGlobal.commands.onCommand },
    downloads: {
      download(options) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.downloads.download(options, cb),
        );
      },
    },
    action: { onClicked: chromeGlobal.action.onClicked },
    openPanel(tabId) {
      const options = tabId === undefined ? {} : { tabId };
      return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.sidePanel.open(options, cb));
    },
  };
}

function createFirefoxShim(firefoxGlobal: FirefoxGlobalShape): BrowserShim {
  return {
    runtimeInfo: { engine: "firefox" },
    tabs: {
      async captureVisibleTab(options) {
        const [activeTab] = await firefoxGlobal.tabs.query({
          active: true,
          currentWindow: true,
        });
        return firefoxGlobal.tabs.captureTab(activeTab?.id, options);
      },
      query(queryInfo) {
        return firefoxGlobal.tabs.query(queryInfo);
      },
    },
    runtime: {
      sendMessage(message) {
        return firefoxGlobal.runtime.sendMessage(message);
      },
      onMessage: firefoxGlobal.runtime.onMessage,
    },
    storage: {
      local: {
        get(keys) {
          return firefoxGlobal.storage.local.get(keys);
        },
        set(items) {
          return firefoxGlobal.storage.local.set(items);
        },
        remove(keys) {
          return firefoxGlobal.storage.local.remove(keys);
        },
      },
    },
    scripting: {
      executeScript(injection) {
        return firefoxGlobal.scripting.executeScript(injection);
      },
    },
    commands: { onCommand: firefoxGlobal.commands.onCommand },
    downloads: {
      download(options) {
        return firefoxGlobal.downloads.download(options);
      },
    },
    action: { onClicked: firefoxGlobal.action.onClicked },
    openPanel() {
      return firefoxGlobal.sidebarAction.open();
    },
  };
}

/**
 * Detects which WebExtensions global is present in `scope` and returns a {@link BrowserShim}
 * normalized to promises. Firefox is checked first because Firefox 109+ also exposes a
 * Chrome-compatible `chrome.*` alias for migration convenience — checking `chrome` first would
 * misdetect Firefox as Chrome and skip the promise-native path.
 *
 * @param scope The global object to inspect. Defaults to the real `globalThis`; tests pass a
 *   fake shaped like {@link ExtensionGlobalScope} instead of monkey-patching real globals.
 * @example
 * ```ts
 * const fakeChrome = { tabs: { ... }, runtime: { ... }, ... } satisfies ChromeGlobalShape;
 * const shim = createBrowserShim({ chrome: fakeChrome });
 * ```
 */
export function createBrowserShim(
  scope: ExtensionGlobalScope = globalThis as ExtensionGlobalScope,
): BrowserShim {
  if (scope.browser) {
    return createFirefoxShim(scope.browser);
  }
  if (scope.chrome) {
    return createChromeShim(scope.chrome);
  }
  throw new Error("browser.ts: neither `browser` nor `chrome` global is present");
}

let singleton: BrowserShim | undefined;

/**
 * The cross-browser API surface every module in this codebase should import instead of touching
 * `chrome.*` or `browser.*` directly. Detection of the underlying engine happens lazily, on first
 * property access, and is cached for the lifetime of the module — so importing this file in a
 * context with neither global present (e.g. a Deno unit test that hasn't injected a fake) never
 * throws until something actually calls a method on it.
 *
 * @example
 * ```ts
 * import { browser } from "./browser.ts";
 * const tabs = await browser.tabs.query({ active: true, currentWindow: true });
 * ```
 */
export const browser: BrowserShim = new Proxy({} as BrowserShim, {
  get(_target, prop, receiver) {
    singleton ??= createBrowserShim();
    return Reflect.get(singleton, prop, receiver);
  },
});
