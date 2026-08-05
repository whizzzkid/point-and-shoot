import assert from "node:assert/strict";
import test from "node:test";

import { classifyInstallTarget } from "../src/lib/install-target.mjs";

const desktopChromium = {
  platform: "macOS",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};

const desktopGecko = {
  platform: "Linux x86_64",
  supportsMozAppearance: true,
  userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
};

test("classifies desktop Chromium-family browsers from capabilities and browser evidence", () => {
  const cases = [
    ["Chrome", desktopChromium],
    ["Chromium", { ...desktopChromium, brands: [{ brand: "Chromium" }] }],
    ["Edge", { ...desktopChromium, brands: [{ brand: "Microsoft Edge" }] }],
    ["Brave", { ...desktopChromium, userAgent: "Mozilla/5.0 Chrome/140.0 Brave/1.80" }],
    ["Opera", { ...desktopChromium, userAgent: "Mozilla/5.0 Chrome/140.0 OPR/121.0" }],
    ["Vivaldi", { ...desktopChromium, userAgent: "Mozilla/5.0 Chrome/140.0 Vivaldi/7.5" }],
    ["Arc", { ...desktopChromium, userAgent: "Mozilla/5.0 Chrome/140.0 Arc/1.100" }],
  ];

  for (const [name, environment] of cases) {
    assert.equal(classifyInstallTarget(environment), "chromium", name);
  }
});

test("classifies desktop Firefox-family browsers as Gecko", () => {
  const cases = [
    ["Firefox", desktopGecko],
    [
      "LibreWolf",
      {
        ...desktopGecko,
        supportsMozAppearance: false,
        userAgent: "Mozilla/5.0 Firefox/142.0 LibreWolf/142.0",
      },
    ],
    [
      "Waterfox",
      {
        ...desktopGecko,
        supportsMozAppearance: false,
        userAgent: "Mozilla/5.0 Firefox/142.0 Waterfox/6.5",
      },
    ],
    [
      "Floorp",
      {
        ...desktopGecko,
        supportsMozAppearance: false,
        userAgent: "Mozilla/5.0 Firefox/142.0 Floorp/12.0",
      },
    ],
  ];

  for (const [name, environment] of cases) {
    assert.equal(classifyInstallTarget(environment), "gecko", name);
  }
});

test("prioritizes mobile evidence over desktop browser wrapper tokens", () => {
  const cases = [
    ["Firefox Android", { ...desktopGecko, mobile: true }],
    ["Chrome Android", { ...desktopChromium, mobile: true }],
    [
      "Android UA",
      { ...desktopChromium, userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile" },
    ],
    [
      "iOS Chrome",
      {
        ...desktopChromium,
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone) CriOS/140.0 Mobile",
      },
    ],
    [
      "iOS Firefox",
      { ...desktopGecko, platform: "iPad", userAgent: "Mozilla/5.0 (iPad) FxiOS/142.0 Mobile" },
    ],
    ["iPadOS desktop UA", { ...desktopChromium, platform: "MacIntel", maxTouchPoints: 5 }],
  ];

  for (const [name, environment] of cases) {
    assert.equal(classifyInstallTarget(environment), "mobile-unsupported", name);
  }
});

test("uses Gecko capability before Chromium brand evidence and ignores bots", () => {
  assert.equal(
    classifyInstallTarget({
      ...desktopChromium,
      brands: [{ brand: "Chromium" }],
      supportsMozAppearance: true,
    }),
    "gecko",
  );
  assert.equal(
    classifyInstallTarget({
      ...desktopGecko,
      brands: [{ brand: "Chromium" }],
      supportsMozAppearance: false,
    }),
    "gecko",
  );
  assert.equal(
    classifyInstallTarget({
      ...desktopChromium,
      userAgent: "Mozilla/5.0 Chrome/140.0 Googlebot/2.1",
    }),
    "unknown",
  );
});

test("leaves Safari, WebKit-only strings, malformed evidence, and empty UAs unknown", () => {
  const cases = [
    { platform: "macOS", userAgent: "Mozilla/5.0 Version/18.6 Safari/605.1.15" },
    { platform: "macOS", userAgent: "Mozilla/5.0 AppleWebKit/605.1.15" },
    { brands: [{ brand: "Not A;Brand" }], userAgent: "" },
    {},
  ];

  for (const environment of cases) {
    assert.equal(classifyInstallTarget(environment), "unknown");
  }
});
