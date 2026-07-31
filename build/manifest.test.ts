import { assertEquals, assertFalse } from "@std/assert";
import {
  FIREFOX_EXTENSION_ID,
  forChrome,
  forFirefox,
  manifestBase,
  SUPPORTED,
} from "./manifest.ts";

const EXPECTED_WEB_ACCESSIBLE_RESOURCES = [
  {
    resources: [
      "src/shared/design/fonts/*.woff2",
      "src/shared/design/icons.svg",
    ],
    matches: ["<all_urls>"],
  },
];

Deno.test("manifest - both targets declare manifest_version 3", () => {
  assertEquals(forChrome().manifest_version, 3);
  assertEquals(forFirefox().manifest_version, 3);
});

Deno.test("manifest - the toolbar action dispatches a click to start or end a session", () => {
  const expected = {
    default_title: "Point and Shoot — Start session",
  };
  assertEquals(forChrome().action, expected);
  assertEquals(forFirefox().action, expected);
});

Deno.test("manifest - permissions are exactly the settled six, no more", () => {
  assertEquals(manifestBase.permissions, [
    "activeTab",
    "storage",
    "scripting",
    "commands",
    "downloads",
    "clipboardWrite",
  ]);
});

Deno.test("manifest - neither target declares host_permissions", () => {
  assertFalse("host_permissions" in forChrome());
  assertFalse("host_permissions" in forFirefox());
});

Deno.test("manifest - neither target registers a static content script", () => {
  // ADR-0002: a static registration is standing access to every matched page, granted at install
  // time. The gesture is the grant, so `content/content.js` is injected by the background instead.
  assertFalse("content_scripts" in forChrome());
  assertFalse("content_scripts" in forFirefox());
});

Deno.test("manifest - `<all_urls>` appears in no permission or injection field", () => {
  // `web_accessible_resources[].matches` is deliberately excluded: it decides which pages may load
  // the vendored font and sprite files and grants the extension nothing. Every field checked here
  // *is* a grant of access to page content.
  for (const manifest of [forChrome(), forFirefox()]) {
    for (const field of ["permissions", "host_permissions", "content_scripts"] as const) {
      const value = manifest[field];
      assertFalse(
        JSON.stringify(value ?? null).includes("<all_urls>"),
        `${field} must not grant <all_urls>`,
      );
    }
  }
});

Deno.test("manifest - web exposure is limited to the vendored fonts and icon sprite", () => {
  assertEquals(manifestBase.web_accessible_resources, EXPECTED_WEB_ACCESSIBLE_RESOURCES);
});

Deno.test("manifest - chrome rotates exposed resource URLs while firefox omits the unsupported key", () => {
  assertEquals(forChrome().web_accessible_resources, [
    {
      ...EXPECTED_WEB_ACCESSIBLE_RESOURCES[0],
      use_dynamic_url: true,
    },
  ]);
  assertEquals(forFirefox().web_accessible_resources, EXPECTED_WEB_ACCESSIBLE_RESOURCES);
});

Deno.test("manifest - chrome uses a module service worker and side_panel, no background.scripts", () => {
  const chrome = forChrome();
  const background = chrome.background as Record<string, unknown>;
  assertEquals(background.service_worker, "background/background.js");
  assertEquals(background.type, "module");
  assertFalse("scripts" in background);
  assertEquals(
    (chrome.side_panel as Record<string, unknown>).default_path,
    "sidepanel/sidepanel.html",
  );
  assertFalse("sidebar_action" in chrome);
});

Deno.test("manifest - both targets expose the built options page in a full tab", () => {
  const expected = { open_in_tab: true, page: "options/options.html" };
  assertEquals(forChrome().options_ui, expected);
  assertEquals(forFirefox().options_ui, expected);
});

Deno.test("manifest - firefox uses background.scripts and sidebar_action, no service worker", () => {
  const firefox = forFirefox();
  const background = firefox.background as Record<string, unknown>;
  assertEquals(background.scripts, ["background/background.js"]);
  assertFalse("service_worker" in background);
  assertFalse("side_panel" in firefox);
  assertEquals(
    (firefox.sidebar_action as Record<string, unknown>).default_panel,
    "sidepanel/sidepanel.html",
  );
});

Deno.test("manifest - firefox uses a stable organization-neutral extension id", () => {
  const firefox = forFirefox();
  const geckoSettings = firefox.browser_specific_settings as {
    gecko: { id: string };
  };
  assertEquals(
    geckoSettings.gecko.id,
    "pointandshoot@whizzzkid.dev",
  );
  assertEquals(geckoSettings.gecko.id, FIREFOX_EXTENSION_ID);
});

Deno.test("manifest - firefox declares that the extension transmits no data", () => {
  const firefox = forFirefox();
  const geckoSettings = firefox.browser_specific_settings as {
    gecko: {
      data_collection_permissions: {
        required: string[];
      };
    };
  };
  assertEquals(geckoSettings.gecko.data_collection_permissions.required, ["none"]);
});

Deno.test("manifest - declared floors match the SUPPORTED constant, not hand-edited literals", () => {
  const chrome = forChrome();
  const firefox = forFirefox();
  assertEquals(chrome.minimum_chrome_version, String(SUPPORTED.chrome));
  const geckoSettings = firefox.browser_specific_settings as {
    gecko: { strict_min_version: string };
  };
  assertEquals(geckoSettings.gecko.strict_min_version, `${SUPPORTED.firefox}.0`);
});

Deno.test("manifest - content_security_policy forbids remote script and object sources", () => {
  const csp = manifestBase.content_security_policy.extension_pages;
  assertEquals(csp, "script-src 'self'; object-src 'self'");
});
