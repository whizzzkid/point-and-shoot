/**
 * Promise-based, cross-browser wrapper over the subset of the WebExtensions API this project
 * actually uses.
 *
 * This is the single seam where Chrome and Firefox differ. Firefox exposes a `browser.*` global
 * whose methods return promises natively. Chrome exposes only `chrome.*`, and in MV3 that global
 * returns promises for some methods when the callback is omitted, but not uniformly — so every
 * asynchronous callback-based Chrome call in this module goes through {@link promisifyWithResult}
 * or {@link promisifyVoid}. Promise-only APIs, such as `sidePanel.open`, return their native
 * promise directly. The synchronous `runtime.getURL` stays synchronous in both engines. Detection
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

/** Minimal extension-manifest shape read at runtime. */
export interface ExtensionManifest {
  readonly version: string;
  readonly version_name?: string;
}

/**
 * Returns the human-facing packaged version, including a development label when present.
 *
 * @param manifest Minimal extension manifest returned by the browser runtime.
 * @returns The descriptive version name, or the numeric version for release builds.
 */
export function displayVersion(manifest: ExtensionManifest): string {
  return manifest.version_name ?? manifest.version;
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
  /** Current document title when the active-tab grant makes it available. */
  readonly title?: string;
  readonly url?: string;
}

/** Query filter accepted by {@link BrowserShim.tabs}'s `query`. */
export interface TabQueryInfo {
  readonly active?: boolean;
  readonly currentWindow?: boolean;
}

/** Properties accepted when opening one browser-owned tab. */
export interface TabCreateProperties {
  readonly url: string;
}

/** Tab-scoped browser-action badge text. An empty string clears the badge. */
export interface ActionBadgeTextDetails {
  readonly tabId?: number;
  readonly text: string;
}

/** Tab-scoped browser-action title shown on hover and to assistive technology. */
export interface ActionTitleDetails {
  readonly tabId?: number;
  readonly title: string;
}

/** Injection target and payload for {@link BrowserShim.scripting}'s `executeScript`. */
export interface ExecuteScriptInjection {
  readonly target: { readonly tabId: number; readonly frameIds?: readonly number[] };
  readonly func?: (firstArg?: unknown, secondArg?: unknown) => unknown;
  readonly args?: readonly unknown[];
  readonly files?: readonly string[];
  readonly world?: "ISOLATED" | "MAIN";
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
  readonly frameId?: number;
}

/** Listener signature for `runtime.onMessage`. Returning `true` keeps the channel open. */
export type MessageListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

/** Listener signature for `commands.onCommand`. */
export type CommandListener = (command: string) => void;

/** One manifest command and its current user-configured shortcut. */
export interface CommandInfo {
  readonly description?: string;
  readonly name?: string;
  readonly shortcut?: string;
}

/** Listener signature for `action.onClicked`. */
export type ActionClickedListener = (tab: TabInfo) => void;

/** Storage values keyed by name; the shape this project reads and writes are always objects. */
export type StorageItems = Record<string, unknown>;

/** One extension-storage key's values before and after a change. */
export interface StorageChange {
  readonly newValue?: unknown;
  readonly oldValue?: unknown;
}

/** Extension-storage changes keyed by storage key. */
export type StorageChanges = Readonly<Record<string, StorageChange>>;

/** Listener signature for extension-storage changes. */
export type StorageChangedListener = (changes: StorageChanges, areaName: string) => void;

/** Browser permission request normalized across Chrome and Firefox. */
export interface PermissionRequest {
  readonly permissions?: readonly string[];
  readonly origins?: readonly string[];
}

/** One promise-based extension storage area. */
export interface StorageArea {
  get(keys?: string | readonly string[] | null): Promise<StorageItems>;
  set(items: StorageItems): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
}

/** Options for an interactive or silent browser-owned web authentication flow. */
export interface WebAuthFlowDetails {
  readonly interactive: boolean;
  readonly url: string;
}

/** Cookie record fields needed by the later enterprise-auth feasibility proof. */
export interface BrowserCookie {
  readonly domain: string;
  readonly httpOnly: boolean;
  readonly name: string;
  readonly path: string;
  readonly secure: boolean;
  readonly session: boolean;
  readonly storeId: string;
  readonly value: string;
  readonly expirationDate?: number;
}

/** Cookie lookup criteria accepted by the browser API. */
export interface CookieQuery {
  readonly domain?: string;
  readonly name?: string;
  readonly path?: string;
  readonly secure?: boolean;
  readonly session?: boolean;
  readonly storeId?: string;
  readonly url?: string;
}

/** Cookie values accepted when creating or updating a browser-managed cookie. */
export interface CookieSetDetails {
  readonly url: string;
  readonly domain?: string;
  readonly expirationDate?: number;
  readonly httpOnly?: boolean;
  readonly name?: string;
  readonly path?: string;
  readonly secure?: boolean;
  readonly storeId?: string;
  readonly value?: string;
}

/** Cookie identity accepted when removing a browser-managed cookie. */
export interface CookieRemoveDetails {
  readonly name: string;
  readonly url: string;
  readonly storeId?: string;
}

/** Browser result describing a removed cookie. */
export interface CookieRemoval {
  readonly name: string;
  readonly storeId: string;
  readonly url: string;
}

/**
 * The normalized, promise-based surface every other module in this codebase imports instead of
 * `chrome.*` or `browser.*`. Every method here resolves or rejects a promise; none take a
 * callback. The native synchronous `runtime.getManifest` and `runtime.getURL` methods are the
 * exceptions.
 */
export interface BrowserShim {
  readonly runtimeInfo: RuntimeInfo;
  readonly tabs: {
    /**
     * Captures the currently visible tab. Both engines expose `tabs.captureVisibleTab`; the shim
     * normalizes Chrome's callback form and Firefox's promise form. Firefox's separate
     * `tabs.captureTab` is deliberately not used because it requires broad host permission in MV3
     * and therefore cannot honor this extension's `activeTab`-only privacy model.
     */
    captureVisibleTab(options?: CaptureOptions): Promise<string>;
    create(properties: TabCreateProperties): Promise<TabInfo>;
    query(queryInfo: TabQueryInfo): Promise<TabInfo[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  readonly runtime: {
    /**
     * Returns the packaged manifest for the running extension.
     *
     * @returns The manifest fields used by extension surfaces.
     */
    getManifest(): ExtensionManifest;
    /**
     * Resolves a manifest-relative asset path against the browser-assigned extension origin.
     *
     * @param path The resource path relative to `manifest.json`.
     * @returns A fully qualified extension URL. Chrome returns a session-scoped host for resources
     *   protected by `use_dynamic_url`; Firefox returns its random extension-origin UUID.
     */
    getURL(path: string): string;
    openOptionsPage(): Promise<void>;
    sendMessage(message: unknown): Promise<unknown>;
    readonly onMessage: { addListener(listener: MessageListener): void };
  };
  readonly storage: {
    readonly onChanged: {
      addListener(listener: StorageChangedListener): void;
      removeListener(listener: StorageChangedListener): void;
    };
    readonly local: StorageArea;
    /** Memory-only storage cleared when the browser session ends. */
    readonly session: StorageArea;
  };
  readonly permissions: {
    /** Engine discriminator used to select the narrowest supported origin pattern. */
    readonly engine: Engine;
    contains(request: PermissionRequest): Promise<boolean>;
    request(request: PermissionRequest): Promise<boolean>;
    remove(request: PermissionRequest): Promise<boolean>;
  };
  readonly identity: {
    getRedirectURL(path?: string): string;
    launchWebAuthFlow(details: WebAuthFlowDetails): Promise<string | undefined>;
  };
  readonly cookies: {
    get(details: CookieQuery): Promise<BrowserCookie | null>;
    getAll(details: CookieQuery): Promise<BrowserCookie[]>;
    set(details: CookieSetDetails): Promise<BrowserCookie | null>;
    remove(details: CookieRemoveDetails): Promise<CookieRemoval | null>;
  };
  readonly scripting: {
    executeScript(injection: ExecuteScriptInjection): Promise<ExecuteScriptResult[]>;
  };
  readonly commands: {
    getAll(): Promise<CommandInfo[]>;
    readonly onCommand: { addListener(listener: CommandListener): void };
  };
  readonly downloads: {
    download(options: DownloadOptions): Promise<number>;
  };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
    setBadgeText(details: ActionBadgeTextDetails): Promise<void>;
    setTitle(details: ActionTitleDetails): Promise<void>;
  };
  /**
   * Opens the extension's side panel / sidebar for the given tab (or the current one).
   * Normalizes over Chrome's `sidePanel.open` and Firefox's `sidebarAction.open` — the other
   * genuine naming divergence between the two engines.
   */
  openPanel(tabId?: number): Promise<void>;
}

/** Shape of Chrome's MV3 global this module depends on. */
export interface ChromeGlobalShape {
  readonly tabs: {
    captureVisibleTab(
      windowId: number | undefined,
      options: CaptureOptions | undefined,
      callback: (dataUrl: string) => void,
    ): void;
    create(properties: TabCreateProperties, callback: (tab: TabInfo) => void): void;
    query(queryInfo: TabQueryInfo, callback: (tabs: TabInfo[]) => void): void;
    sendMessage(
      tabId: number,
      message: unknown,
      callback: (response: unknown) => void,
    ): void;
  };
  readonly runtime: {
    getManifest(): ExtensionManifest;
    getURL(path: string): string;
    openOptionsPage(callback: () => void): void;
    sendMessage(message: unknown, callback: (response: unknown) => void): void;
    readonly onMessage: { addListener(listener: MessageListener): void };
    readonly lastError: { readonly message?: string } | undefined;
  };
  readonly storage: {
    readonly onChanged: {
      addListener(listener: StorageChangedListener): void;
      removeListener(listener: StorageChangedListener): void;
    };
    readonly local: {
      get(
        keys: string | readonly string[] | null | undefined,
        callback: (items: StorageItems) => void,
      ): void;
      set(items: StorageItems, callback: () => void): void;
      remove(keys: string | readonly string[], callback: () => void): void;
    };
    readonly session: {
      get(
        keys: string | readonly string[] | null | undefined,
        callback: (items: StorageItems) => void,
      ): void;
      set(items: StorageItems, callback: () => void): void;
      remove(keys: string | readonly string[], callback: () => void): void;
    };
  };
  readonly permissions: {
    contains(request: PermissionRequest, callback: (result: boolean) => void): void;
    request(request: PermissionRequest, callback: (result: boolean) => void): void;
    remove(request: PermissionRequest, callback: (result: boolean) => void): void;
  };
  readonly identity: {
    getRedirectURL(path?: string): string;
    launchWebAuthFlow(
      details: WebAuthFlowDetails,
      callback: (responseUrl?: string) => void,
    ): void;
  };
  readonly cookies: {
    get(details: CookieQuery, callback: (cookie: BrowserCookie | null) => void): void;
    getAll(details: CookieQuery, callback: (cookies: BrowserCookie[]) => void): void;
    set(details: CookieSetDetails, callback: (cookie: BrowserCookie | null) => void): void;
    remove(details: CookieRemoveDetails, callback: (details: CookieRemoval | null) => void): void;
  };
  readonly scripting: {
    executeScript(
      injection: ExecuteScriptInjection,
      callback: (results: ExecuteScriptResult[]) => void,
    ): void;
  };
  readonly commands: {
    getAll(callback: (commands: CommandInfo[]) => void): void;
    readonly onCommand: { addListener(listener: CommandListener): void };
  };
  readonly downloads: {
    download(options: DownloadOptions, callback: (downloadId: number) => void): void;
  };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
    setBadgeText(details: ActionBadgeTextDetails, callback: () => void): void;
    setTitle(details: ActionTitleDetails, callback: () => void): void;
  };
  readonly sidePanel: {
    open(options: { readonly tabId?: number }): Promise<void>;
  };
}

/** Shape of Firefox's MV3 global this module depends on — promise-native for asynchronous calls. */
export interface FirefoxGlobalShape {
  readonly tabs: {
    captureVisibleTab(
      windowId: number | undefined,
      options?: CaptureOptions,
    ): Promise<string>;
    create(properties: TabCreateProperties): Promise<TabInfo>;
    query(queryInfo: TabQueryInfo): Promise<TabInfo[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  readonly runtime: {
    /** Firefox-only engine identity method, used to distinguish namespace aliases safely. */
    getBrowserInfo(): Promise<{ readonly name: string }>;
    getManifest(): ExtensionManifest;
    getURL(path: string): string;
    openOptionsPage(): Promise<void>;
    sendMessage(message: unknown): Promise<unknown>;
    readonly onMessage: { addListener(listener: MessageListener): void };
  };
  readonly storage: {
    readonly onChanged: {
      addListener(listener: StorageChangedListener): void;
      removeListener(listener: StorageChangedListener): void;
    };
    readonly local: {
      get(keys?: string | readonly string[] | null): Promise<StorageItems>;
      set(items: StorageItems): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
    readonly session: {
      get(keys?: string | readonly string[] | null): Promise<StorageItems>;
      set(items: StorageItems): Promise<void>;
      remove(keys: string | readonly string[]): Promise<void>;
    };
  };
  readonly permissions: {
    contains(request: PermissionRequest): Promise<boolean>;
    request(request: PermissionRequest): Promise<boolean>;
    remove(request: PermissionRequest): Promise<boolean>;
  };
  readonly identity: {
    getRedirectURL(path?: string): string;
    launchWebAuthFlow(details: WebAuthFlowDetails): Promise<string | undefined>;
  };
  readonly cookies: {
    get(details: CookieQuery): Promise<BrowserCookie | null>;
    getAll(details: CookieQuery): Promise<BrowserCookie[]>;
    set(details: CookieSetDetails): Promise<BrowserCookie | null>;
    remove(details: CookieRemoveDetails): Promise<CookieRemoval | null>;
  };
  readonly scripting: {
    executeScript(injection: ExecuteScriptInjection): Promise<ExecuteScriptResult[]>;
  };
  readonly commands: {
    getAll(): Promise<CommandInfo[]>;
    readonly onCommand: { addListener(listener: CommandListener): void };
  };
  readonly downloads: { download(options: DownloadOptions): Promise<number> };
  readonly action: {
    readonly onClicked: { addListener(listener: ActionClickedListener): void };
    setBadgeText(details: ActionBadgeTextDetails): Promise<void>;
    setTitle(details: ActionTitleDetails): Promise<void>;
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
      create(properties) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.tabs.create(properties, cb),
        );
      },
      query(queryInfo) {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.tabs.query(queryInfo, cb));
      },
      sendMessage(tabId, message) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.tabs.sendMessage(tabId, message, cb),
        );
      },
    },
    runtime: {
      getManifest() {
        return chromeGlobal.runtime.getManifest();
      },
      getURL(path) {
        return chromeGlobal.runtime.getURL(path);
      },
      openOptionsPage() {
        return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.runtime.openOptionsPage(cb));
      },
      sendMessage(message) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.runtime.sendMessage(message, cb),
        );
      },
      onMessage: chromeGlobal.runtime.onMessage,
    },
    storage: {
      onChanged: chromeGlobal.storage.onChanged,
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
      session: {
        get(keys) {
          return promisifyWithResult(
            chromeGlobal,
            (cb) => chromeGlobal.storage.session.get(keys, cb),
          );
        },
        set(items) {
          return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.storage.session.set(items, cb));
        },
        remove(keys) {
          return promisifyVoid(
            chromeGlobal,
            (cb) => chromeGlobal.storage.session.remove(keys, cb),
          );
        },
      },
    },
    permissions: {
      engine: "chrome",
      contains(request) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.permissions.contains(request, cb),
        );
      },
      request(request) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.permissions.request(request, cb),
        );
      },
      remove(request) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.permissions.remove(request, cb),
        );
      },
    },
    identity: {
      getRedirectURL(path) {
        return chromeGlobal.identity.getRedirectURL(path);
      },
      launchWebAuthFlow(details) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.identity.launchWebAuthFlow(details, cb),
        );
      },
    },
    cookies: {
      get(details) {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.cookies.get(details, cb));
      },
      getAll(details) {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.cookies.getAll(details, cb));
      },
      set(details) {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.cookies.set(details, cb));
      },
      remove(details) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.cookies.remove(details, cb),
        );
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
    commands: {
      getAll() {
        return promisifyWithResult(chromeGlobal, (cb) => chromeGlobal.commands.getAll(cb));
      },
      get onCommand() {
        return chromeGlobal.commands.onCommand;
      },
    },
    downloads: {
      download(options) {
        return promisifyWithResult(
          chromeGlobal,
          (cb) => chromeGlobal.downloads.download(options, cb),
        );
      },
    },
    action: {
      get onClicked() {
        return chromeGlobal.action.onClicked;
      },
      setBadgeText(details) {
        return promisifyVoid(
          chromeGlobal,
          (cb) => chromeGlobal.action.setBadgeText(details, cb),
        );
      },
      setTitle(details) {
        return promisifyVoid(chromeGlobal, (cb) => chromeGlobal.action.setTitle(details, cb));
      },
    },
    openPanel(tabId) {
      const options = tabId === undefined ? {} : { tabId };
      return chromeGlobal.sidePanel.open(options);
    },
  };
}

function createFirefoxShim(firefoxGlobal: FirefoxGlobalShape): BrowserShim {
  return {
    runtimeInfo: { engine: "firefox" },
    tabs: {
      captureVisibleTab(options) {
        return firefoxGlobal.tabs.captureVisibleTab(undefined, options);
      },
      create(properties) {
        return firefoxGlobal.tabs.create(properties);
      },
      query(queryInfo) {
        return firefoxGlobal.tabs.query(queryInfo);
      },
      sendMessage(tabId, message) {
        return firefoxGlobal.tabs.sendMessage(tabId, message);
      },
    },
    runtime: {
      getManifest() {
        return firefoxGlobal.runtime.getManifest();
      },
      getURL(path) {
        return firefoxGlobal.runtime.getURL(path);
      },
      openOptionsPage() {
        return firefoxGlobal.runtime.openOptionsPage();
      },
      sendMessage(message) {
        return firefoxGlobal.runtime.sendMessage(message);
      },
      onMessage: firefoxGlobal.runtime.onMessage,
    },
    storage: {
      onChanged: firefoxGlobal.storage.onChanged,
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
      session: {
        get(keys) {
          return firefoxGlobal.storage.session.get(keys);
        },
        set(items) {
          return firefoxGlobal.storage.session.set(items);
        },
        remove(keys) {
          return firefoxGlobal.storage.session.remove(keys);
        },
      },
    },
    permissions: {
      engine: "firefox",
      contains(request) {
        return firefoxGlobal.permissions.contains(request);
      },
      request(request) {
        return firefoxGlobal.permissions.request(request);
      },
      remove(request) {
        return firefoxGlobal.permissions.remove(request);
      },
    },
    identity: {
      getRedirectURL(path) {
        return firefoxGlobal.identity.getRedirectURL(path);
      },
      launchWebAuthFlow(details) {
        return firefoxGlobal.identity.launchWebAuthFlow(details);
      },
    },
    cookies: {
      get(details) {
        return firefoxGlobal.cookies.get(details);
      },
      getAll(details) {
        return firefoxGlobal.cookies.getAll(details);
      },
      set(details) {
        return firefoxGlobal.cookies.set(details);
      },
      remove(details) {
        return firefoxGlobal.cookies.remove(details);
      },
    },
    scripting: {
      executeScript(injection) {
        return firefoxGlobal.scripting.executeScript(injection);
      },
    },
    commands: {
      getAll() {
        return firefoxGlobal.commands.getAll();
      },
      get onCommand() {
        return firefoxGlobal.commands.onCommand;
      },
    },
    downloads: {
      download(options) {
        return firefoxGlobal.downloads.download(options);
      },
    },
    action: {
      get onClicked() {
        return firefoxGlobal.action.onClicked;
      },
      setBadgeText(details) {
        return firefoxGlobal.action.setBadgeText(details);
      },
      setTitle(details) {
        return firefoxGlobal.action.setTitle(details);
      },
    },
    openPanel() {
      return firefoxGlobal.sidebarAction.open();
    },
  };
}

/**
 * Detects which WebExtensions global is present in `scope` and returns a {@link BrowserShim}
 * normalized to promises. Firefox is identified by its `runtime.getBrowserInfo` method because
 * both engines may expose both namespace names: Firefox 109+ has a Chrome-compatible `chrome.*`
 * alias, while Chromium may expose a partial `browser.*` alias. The runtime method remains
 * available in content scripts where privileged tab methods do not.
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
  if (typeof scope.browser?.runtime?.getBrowserInfo === "function") {
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
