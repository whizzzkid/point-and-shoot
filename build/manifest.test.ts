import { assertEquals, assertFalse } from "@std/assert";
import { forChrome, forFirefox, manifestBase, SUPPORTED } from "./manifest.ts";

Deno.test("manifest - both targets declare manifest_version 3", () => {
  assertEquals(forChrome().manifest_version, 3);
  assertEquals(forFirefox().manifest_version, 3);
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
