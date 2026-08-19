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
      announcement:
        "Chrome Web Store is the compatible listing for this browser, so other stores are hidden " +
        "here. Every published store stays listed at the end of the page, and building from " +
        "source stays available.",
      label: "Recommended: install from Chrome Web Store",
    };
  }

  if (target === "gecko") {
    return {
      actionTarget: "gecko",
      announcement:
        "Firefox Add-ons is the compatible listing for this browser, so other stores are hidden " +
        "here. Every published store stays listed at the end of the page, and building from " +
        "source stays available.",
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
 * Progressively recommends a store action without redirecting or moving focus.
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

  const recommendedAction = documentRoot.querySelector<HTMLAnchorElement>(
    `[data-store-action="${recommendation.actionTarget}"]`,
  );
  if (recommendedAction === null) return;
  recommendedAction.classList.add("is-recommended");
  recommendedAction.setAttribute(
    "aria-label",
    recommendation.label ?? recommendedAction.textContent ?? "",
  );
  recommendedAction.setAttribute("data-recommended", "true");

  // In the hero the top CTA is a single link: keep only the determined store and
  // hide the other store choices plus the build-from-source option. The closing
  // section keeps every choice, and the no-JS fallback still renders the full set.
  for (const hero of documentRoot.querySelectorAll<HTMLElement>(".install-actions--hero")) {
    for (const store of hero.querySelectorAll<HTMLElement>("[data-install-store]")) {
      const storeLink = store.querySelector<HTMLElement>("[data-store-action]");
      store.hidden = storeLink?.dataset.storeAction !== recommendation.actionTarget;
    }
    const source = hero.querySelector<HTMLElement>(".install-source");
    if (source !== null) {
      source.hidden = true;
    }
  }
}
