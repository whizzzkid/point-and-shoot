/**
 * Firefox profile preferences shared by the boot and smoke harnesses.
 *
 * @module
 */

/**
 * Preferences that keep temporary Firefox profiles offline and deterministic.
 */
export const FIREFOX_OFFLINE_PREFERENCES = [
  "services.settings.server=data:,#remote-settings-dummy/v1",
  "extensions.getAddons.cache.enabled=false",
  "browser.search.update=false",
  "app.normandy.enabled=false",
] as const;

/**
 * Stable UUID assigned to the temporary Firefox extension profile.
 */
export const FIREFOX_EXTENSION_UUID = "6f1a2b3c-d4e5-46f7-8a9b-0c1d2e3f4a5b";

/**
 * Predictable origin produced by {@link FIREFOX_EXTENSION_UUID}.
 */
export const FIREFOX_EXTENSION_ORIGIN = `moz-extension://${FIREFOX_EXTENSION_UUID}`;

/**
 * Builds the Firefox fixture URL with the shared extension UUID.
 *
 * @param fixtureBase Base URL returned by the fixture server.
 * @returns Firefox boot fixture URL for the predictable extension origin.
 */
export function firefoxBootFixtureUrl(fixtureBase: string): string {
  const url = new URL("/firefox-boot.html", fixtureBase);
  url.searchParams.set("extensionUuid", FIREFOX_EXTENSION_UUID);
  return url.href;
}
