/**
 * Generates the Chrome and Firefox Manifest V3 files from one typed source.
 *
 * Chrome and Firefox MV3 manifests differ structurally (service worker vs. event page,
 * `side_panel` vs. `sidebar_action`, `minimum_chrome_version` vs.
 * `browser_specific_settings.gecko.strict_min_version`). Hand-maintaining two JSON files
 * guarantees drift; this module is the single source both are derived from.
 */

/**
 * The minimum browser versions this extension supports, resolved from each vendor's own MV3
 * support baseline rather than guessed:
 *
 * - `chrome: 116` — the first Chrome version whose `chrome.sidePanel.open()` method (used by
 *   {@link "../src/shared/browser.ts" | the browser shim}'s `openPanel`) is available. The
 *   `sidePanel` API itself landed in Chrome 114, but `open()` did not ship until 116.
 * - `firefox: 109` — the first Firefox version where Manifest V3 became generally available.
 *
 * This is the one place these numbers are written. `build/build.ts` derives its esbuild
 * `target` from this constant instead of a literal, and both manifest builders below assert their
 * declared floor matches it.
 */
export const SUPPORTED = {
  chrome: 116,
  firefox: 109,
} as const;

/**
 * Firefox's stable add-on identity.
 *
 * This is an identifier, not a support address. Changing it after distribution makes Firefox
 * treat the build as a different extension, so tests and release tooling import this constant
 * instead of repeating it.
 */
export const FIREFOX_EXTENSION_ID = "pointandshoot@whizzzkid.dev";

/** Permission grants shared by both browser targets, per ADR-0002 and the runtime spec. */
const PERMISSIONS = [
  "activeTab",
  "storage",
  "scripting",
  "downloads",
  "clipboardWrite",
] as const;

/** A strict extension-pages CSP: no remote script or object sources, per ADR-0009. */
const CONTENT_SECURITY_POLICY = "script-src 'self'; object-src 'self'";

/** Vendored font and icon-sprite paths exposed to injected content scripts. */
const WEB_ACCESSIBLE_RESOURCES = [
  "src/shared/design/fonts/*.woff2",
  "src/shared/design/icons.svg",
];
const EXTENSION_ICONS = {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png",
} as const;

/** Fields shared verbatim between the Chrome and Firefox manifests. */
interface ManifestBase {
  readonly manifest_version: 3;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly icons: typeof EXTENSION_ICONS;
  readonly permissions: readonly string[];
  readonly action: {
    readonly default_icon: typeof EXTENSION_ICONS;
    readonly default_title: string;
  };
  readonly options_ui: {
    readonly open_in_tab: true;
    readonly page: string;
  };
  readonly commands: Readonly<
    Record<string, {
      readonly suggested_key: Readonly<Record<string, string>>;
      readonly description: string;
    }>
  >;
  readonly web_accessible_resources: ReadonlyArray<{
    readonly resources: readonly string[];
    readonly matches: readonly string[];
  }>;
  readonly content_security_policy: {
    readonly extension_pages: string;
  };
}

/** Everything shared between the two targets. Neither builder adds `host_permissions` — see ADR-0002. */
export const manifestBase: ManifestBase = {
  manifest_version: 3,
  name: "Point & Shoot",
  version: "2026.813.0", // x-release-please-version
  description: "Point at or drag a box around a broken element, add a note, export a fix prompt.",
  icons: EXTENSION_ICONS,
  permissions: PERMISSIONS,
  action: {
    default_icon: EXTENSION_ICONS,
    default_title: "Point and Shoot — Start session",
  },
  options_ui: {
    open_in_tab: true,
    page: "options/options.html",
  },
  commands: {
    "toggle-capture": {
      suggested_key: { default: "Ctrl+Shift+P", mac: "Command+Shift+P" },
      description: "Start pointing at or dragging a box around a broken element",
    },
  },
  // No `content_scripts` key, deliberately. A static registration with any useful match pattern is
  // standing access to those pages, granted at install time rather than by the gesture that
  // ADR-0002 makes the whole permission model turn on — so `content/content.js` is injected on
  // demand by `src/background/index.ts` via `scripting.executeScript` under `activeTab`. That still
  // works on every site the user invokes it on; what it drops is the ability to run where they
  // didn't.
  web_accessible_resources: [
    {
      resources: WEB_ACCESSIBLE_RESOURCES,
      // A resource pattern, not a permission: it says which pages may *load* these font and sprite
      // files, and grants the extension nothing over page content. It cannot be narrowed, because
      // the injected overlay has to render on whatever page the user pointed at. Its one real cost
      // is that a page can probe a stable Chrome extension id for these paths. ADR-0012 rotates
      // Chrome's public URLs per session; Firefox already assigns a random extension-origin UUID.
      matches: ["<all_urls>"],
    },
  ],
  content_security_policy: {
    extension_pages: CONTENT_SECURITY_POLICY,
  },
};

/** The Chrome manifest: `background.service_worker` (type `module`) and `side_panel`. */
export function forChrome(): Record<string, unknown> {
  return {
    ...manifestBase,
    permissions: [...manifestBase.permissions, "sidePanel"],
    web_accessible_resources: manifestBase.web_accessible_resources.map((rule) => ({
      ...rule,
      use_dynamic_url: true,
    })),
    minimum_chrome_version: String(SUPPORTED.chrome),
    background: {
      service_worker: "background/background.js",
      type: "module",
    },
    side_panel: {
      default_path: "sidepanel/sidepanel.html",
    },
  };
}

/**
 * The Firefox manifest: `background.scripts` (Firefox MV3 uses an event page, not a service
 * worker) and `sidebar_action` instead of `side_panel`.
 */
export function forFirefox(): Record<string, unknown> {
  return {
    ...manifestBase,
    background: {
      scripts: ["background/background.js"],
    },
    sidebar_action: {
      default_panel: "sidepanel/sidepanel.html",
      default_title: "Point and Shoot",
    },
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_EXTENSION_ID,
        data_collection_permissions: {
          required: ["none"],
        },
        strict_min_version: `${SUPPORTED.firefox}.0`,
      },
    },
  };
}
