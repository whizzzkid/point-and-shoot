import { assertEquals } from "@std/assert";
import {
  FIREFOX_EXTENSION_ORIGIN,
  FIREFOX_EXTENSION_UUID,
  firefoxBootFixtureUrl,
} from "./profile.ts";

Deno.test("Firefox profile exposes one predictable extension origin to its fixture", () => {
  const fixtureUrl = new URL(firefoxBootFixtureUrl("http://127.0.0.1:4321"));

  assertEquals(FIREFOX_EXTENSION_ORIGIN, `moz-extension://${FIREFOX_EXTENSION_UUID}`);
  assertEquals(fixtureUrl.origin, "http://127.0.0.1:4321");
  assertEquals(fixtureUrl.pathname, "/firefox-boot.html");
  assertEquals(fixtureUrl.searchParams.get("extensionUuid"), FIREFOX_EXTENSION_UUID);
});
