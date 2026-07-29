/// <reference lib="dom" />

import { resolveTheme, sampleBackdrop, type Theme, watchTheme } from "../../src/shared/theme.ts";

const ownerWindow = globalThis as unknown as Window;

interface ThemeHarness {
  sampleBottom(): {
    readonly sampleCount: number;
    readonly theme: Theme;
  };
  sample(selector: string, ignoredSelector?: string): {
    readonly sampleCount: number;
    readonly theme: Theme;
  };
  startWatching(): void;
  stopWatching(): void;
  readonly sampleCalls: number;
  readonly themes: readonly Theme[];
}

let sampleCalls = 0;
const themes: Theme[] = [];
let stopWatching = () => {};

const harness: ThemeHarness = {
  sampleBottom() {
    const bounds = new DOMRect(
      Math.max(0, globalThis.innerWidth / 2 - 210),
      Math.max(0, globalThis.innerHeight - 96),
      Math.min(420, globalThis.innerWidth),
      Math.min(72, globalThis.innerHeight),
    );
    const samples = sampleBackdrop(document, bounds);
    return {
      sampleCount: samples.length,
      theme: resolveTheme({ sample: () => samples }),
    };
  },
  sample(selector, ignoredSelector) {
    const surface = document.querySelector<HTMLElement>(selector);
    if (surface === null) throw new Error(`missing theme surface: ${selector}`);
    let ignored: HTMLElement | undefined;
    if (ignoredSelector !== undefined) {
      ignored = document.querySelector<HTMLElement>(ignoredSelector) ?? undefined;
    }
    const samples = sampleBackdrop(document, surface.getBoundingClientRect(), ignored);
    return {
      sampleCount: samples.length,
      theme: resolveTheme({ sample: () => samples }),
    };
  },
  startWatching() {
    stopWatching();
    sampleCalls = 0;
    themes.splice(0);
    stopWatching = watchTheme({
      debounceMilliseconds: 25,
      onChange: (theme) => themes.push(theme),
      ownerWindow,
      sample: () => {
        sampleCalls += 1;
        return [{ red: 255, green: 255, blue: 255 }];
      },
    });
  },
  stopWatching() {
    stopWatching();
    stopWatching = () => {};
  },
  get sampleCalls() {
    return sampleCalls;
  },
  get themes() {
    return themes;
  },
};

(globalThis as unknown as { pointShootThemeTest: ThemeHarness }).pointShootThemeTest = harness;
