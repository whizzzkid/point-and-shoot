/// <reference lib="dom" />

import { classifyInstallTarget } from "./install-target.mjs";

type InstallTarget = "gecko" | "chromium" | "mobile-unsupported" | "unknown";
type StoreTarget = Extract<InstallTarget, "gecko" | "chromium">;

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
  actionTarget: StoreTarget | null;
  announcement: string | null;
  label: string | null;
}

/**
 * Returns the non-navigating recommendation copy and accent target for one detected browser family.
 *
 * @param target - The browser family classified from local browser evidence.
 * @param availableActions - Store actions currently rendered by the server, when known.
 * @returns The label, announcement, and optional store action to recommend.
 */
export function getInstallRecommendation(
  target: InstallTarget,
  availableActions?: ReadonlySet<StoreTarget>,
): Recommendation {
  const isStoreTarget = target === "chromium" || target === "gecko";
  if (isStoreTarget && availableActions !== undefined) {
    if (!availableActions.has(target)) {
      return { actionTarget: null, announcement: null, label: null };
    }
  }

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
  const availableActions = new Set<StoreTarget>();
  for (const action of documentRoot.querySelectorAll<HTMLElement>("[data-store-action]")) {
    const target = action.dataset.storeAction;
    if (target === "chromium" || target === "gecko") {
      availableActions.add(target);
    }
  }
  const recommendation = getInstallRecommendation(
    classifyInstallTarget(environment),
    availableActions,
  );

  if (recommendation.announcement !== null) {
    const recommendationStatuses = documentRoot.querySelectorAll<HTMLElement>(
      "[data-install-recommendation]",
    );
    for (const status of recommendationStatuses) {
      status.textContent = recommendation.announcement;
    }
  }

  if (recommendation.actionTarget === null) {
    return;
  }

  const recommendedActions = documentRoot.querySelectorAll<HTMLAnchorElement>(
    `[data-store-action="${recommendation.actionTarget}"]`,
  );
  for (const action of recommendedActions) {
    action.classList.add("is-recommended");
    action.setAttribute("aria-label", recommendation.label ?? action.textContent ?? "");
    action.setAttribute("data-recommended", "true");
  }
}
