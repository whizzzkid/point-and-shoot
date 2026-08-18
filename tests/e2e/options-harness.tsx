/// <reference lib="dom" />

import { render } from "preact";
import { Options } from "../../src/options/Options.tsx";
import type { OptionsRepository } from "../../src/options/repository.ts";
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../../src/shared/settings.ts";
import componentStyles from "../../src/ui/components/components.css" with { type: "text" };
import { IconSpriteProvider } from "../../src/ui/components/index.ts";
import tokenStyles from "../../src/shared/design/tokens.css" with { type: "text" };
import optionsStyles from "../../src/options/options.css" with { type: "text" };

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${tokenStyles}\n${componentStyles}\n${optionsStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
document.body.replaceChildren();
document.body.insertAdjacentHTML("afterbegin", iconSprite);
const mount = document.createElement("div");
mount.id = "app";
document.body.append(mount);

let persisted: ExtensionSettings = { ...DEFAULT_SETTINGS };
const actionLog = { clears: 0, shortcutSettings: 0 };
let failedSavesRemaining = 0;

function mountOptions(autoTheme: "dark" | "light"): void {
  const repository: OptionsRepository = {
    clearSessions() {
      actionLog.clears++;
      return Promise.resolve();
    },
    load: () =>
      Promise.resolve({
        settings: { ...persisted },
        shortcut: "Command+Shift+P",
      }),
    openShortcutSettings() {
      actionLog.shortcutSettings++;
      return Promise.resolve();
    },
    save(settings) {
      if (failedSavesRemaining > 0) {
        failedSavesRemaining--;
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Settings could not be saved.")), 50);
        });
      }
      persisted = { ...settings };
      return Promise.resolve();
    },
    listAllSessions: () => Promise.resolve([]),
    deleteSessionById: () => Promise.resolve(),
    openSessionInSidePanel: () => Promise.resolve(),
    readGroupByDomain: () => Promise.resolve(false),
    writeGroupByDomain: () => Promise.resolve(),
  };
  render(
    <IconSpriteProvider url="">
      <Options autoTheme={autoTheme} repository={repository} version="0.1.0" />
    </IconSpriteProvider>,
    mount,
  );
}

const harness = {
  actionLog,
  failNextSaves(count = 1) {
    failedSavesRemaining = count;
  },
  mount: mountOptions,
  reset() {
    persisted = { ...DEFAULT_SETTINGS };
    failedSavesRemaining = 0;
    actionLog.clears = 0;
    actionLog.shortcutSettings = 0;
  },
  unmount() {
    render(null, mount);
  },
};

(globalThis as unknown as { pointShootOptionsTest: typeof harness }).pointShootOptionsTest =
  harness;
