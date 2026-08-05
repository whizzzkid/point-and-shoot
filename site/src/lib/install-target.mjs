/**
 * @typedef {"gecko" | "chromium" | "mobile-unsupported" | "unknown"} InstallTarget
 */

const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/iu;
const botUserAgent = /bot|crawler|spider|slurp/iu;
const firefoxUserAgent = /Firefox|LibreWolf|Waterfox|Floorp/iu;
const chromiumUserAgent = /Chrome|Chromium|Edg(?:e|A|iOS)?|OPR|Opera|Vivaldi|Brave|Arc/iu;
const chromiumBrand = /Chromium|Chrome|Edge|Opera|Vivaldi|Brave|Arc/iu;

/**
 * Classifies the browser family available to the website without reading global browser objects.
 *
 * @param {{
 *   brands?: Array<{brand?: string}>;
 *   maxTouchPoints?: number;
 *   mobile?: boolean;
 *   platform?: string;
 *   supportsMozAppearance?: boolean;
 *   userAgent?: string;
 * }} environment - Browser evidence collected by the progressive-enhancement layer.
 * @returns {InstallTarget} The compatible desktop extension family, a mobile fallback, or unknown.
 */
export function classifyInstallTarget(environment) {
  const userAgent = environment.userAgent ?? "";
  const platform = environment.platform ?? "";
  const hasIPadOsDesktopEvidence = platform === "MacIntel" && (environment.maxTouchPoints ?? 0) > 1;

  if (environment.mobile === true || hasIPadOsDesktopEvidence || mobileUserAgent.test(userAgent)) {
    return "mobile-unsupported";
  }

  if (botUserAgent.test(userAgent)) {
    return "unknown";
  }

  if (environment.supportsMozAppearance === true || firefoxUserAgent.test(userAgent)) {
    return "gecko";
  }

  if (
    environment.brands?.some((entry) =>
      typeof entry.brand === "string" ? chromiumBrand.test(entry.brand) : false,
    ) ??
    false
  ) {
    return "chromium";
  }

  return chromiumUserAgent.test(userAgent) ? "chromium" : "unknown";
}
