import { classifyInstallTarget } from "./install-target.mjs";

type InstallTarget = "gecko" | "chromium" | "mobile-unsupported" | "unknown";

interface BrowserBrand {
  brand?: string;
}

interface BrowserEnvironment {
  brands?: BrowserBrand[];
  maxTouchPoints?: number;
  mobile?: boolean;
  platform?: string;
  supportsMozAppearance?: boolean;
  userAgent?: string;
}

interface Recommendation {
  actionTarget: "chromium" | "gecko" | null;
  announcement: string;
  label: string | null;
}

/**
 * Returns the non-navigating recommendation copy and accent target for one detected browser family.
 *
 * @param target - The browser family classified from local browser evidence.
 * @returns The label, announcement, and optional store action to recommend.
 */
export function getInstallRecommendation(target: InstallTarget): Recommendation {
  if (target === "chromium") {
    return {
      actionTarget: "chromium",
      announcement: "Chrome Web Store is recommended for this desktop browser.",
      label: "Recommended: install from Chrome Web Store",
    };
  }

  if (target === "gecko") {
    return {
      actionTarget: "gecko",
      announcement: "Firefox Add-ons is recommended for this desktop browser.",
      label: "Recommended: install from Firefox Add-ons",
    };
  }

  if (target === "mobile-unsupported") {
    return {
      actionTarget: null,
      announcement: "Desktop browser extension installation is unavailable on mobile.",
      label: null,
    };
  }

  return {
    actionTarget: null,
    announcement:
      "Safari support is deferred. Choose a supported desktop browser or build from source.",
    label: null,
  };
}

/**
 * Progressively recommends a visible store action without redirecting, hiding choices, or moving focus.
 *
 * @param documentRoot - The document containing rendered install components.
 * @returns Nothing; the function only updates recommendation labels, attributes, and status text.
 */
export function enhanceInstallActions(documentRoot: Document): void {
  const navigatorWithBrands = navigator as Navigator & {
    userAgentData?: { brands?: BrowserBrand[]; mobile?: boolean; platform?: string };
  };
  const environment: BrowserEnvironment = {
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigatorWithBrands.userAgentData?.platform ?? navigator.platform,
    supportsMozAppearance: typeof CSS !== "undefined" && CSS.supports("-moz-appearance", "none"),
    userAgent: navigator.userAgent,
  };
  if (navigatorWithBrands.userAgentData?.brands !== undefined) {
    environment.brands = navigatorWithBrands.userAgentData.brands;
  }
  if (navigatorWithBrands.userAgentData?.mobile !== undefined) {
    environment.mobile = navigatorWithBrands.userAgentData.mobile;
  }
  const recommendation = getInstallRecommendation(classifyInstallTarget(environment));

  for (const status of documentRoot.querySelectorAll<HTMLElement>("[data-install-status]")) {
    status.textContent = recommendation.announcement;
  }

  if (recommendation.actionTarget === null) {
    return;
  }

  for (const action of documentRoot.querySelectorAll<HTMLAnchorElement>(
    `[data-store-action="${recommendation.actionTarget}"]`,
  )) {
    action.classList.add("is-recommended");
    action.setAttribute("aria-label", recommendation.label ?? action.textContent ?? "");
    action.setAttribute("data-recommended", "true");
  }
}
