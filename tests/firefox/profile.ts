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
