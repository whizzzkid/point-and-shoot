/** @typedef {"chromium" | "gecko"} StoreTarget */

const sourceInstallUrl = "https://github.com/whizzzkid/point-and-shoot#build-from-source";

const storeDetails = {
  chrome: { name: "Chrome Web Store", target: "chromium" },
  firefox: { name: "Firefox Add-ons", target: "gecko" },
};

/**
 * Produces the static install choices from the generated canonical store-listing projection.
 *
 * @param {{
 *   privacy: {singlePurpose: string};
 *   stores: Record<"chrome" | "firefox", {listingUrl: string | null; state: string}>;
 * }} listing - Generated store contract data available to the Astro build.
 * @returns {{
 *   actions: Array<{name: string; target: StoreTarget; url: string}>;
 *   sourceInstallUrl: string;
 *   sourceIsPrimary: boolean;
 *   statuses: string[];
 *   singlePurpose: string;
 * }} Static action and fallback data for the install component.
 */
export function createInstallActionsModel(listing) {
  const actions = [];
  const statuses = [];

  for (const [storeKey, detail] of Object.entries(storeDetails)) {
    const store = listing.stores[storeKey];
    if (store.state === "published" && store.listingUrl !== null) {
      actions.push({ ...detail, url: store.listingUrl });
      continue;
    }

    statuses.push(`${detail.name} listing is ${store.state.replaceAll("-", " ")}.`);
  }

  return {
    actions,
    singlePurpose: listing.privacy.singlePurpose,
    sourceInstallUrl,
    sourceIsPrimary: actions.length === 0,
    statuses,
  };
}
