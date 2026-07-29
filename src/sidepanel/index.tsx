/// <reference lib="dom" />
/** Side-panel entry point for the active session review workspace. */

import { render } from "preact";
import { browser } from "../shared/browser.ts";
import { DEFAULT_SETTINGS, loadSettings } from "../shared/settings.ts";
import componentStyles from "../ui/components/components.css" with { type: "text" };
import { NotesPanel } from "./NotesPanel.tsx";
import { createNotesRepository } from "./repository.ts";
import panelStyles from "./sidepanel.css" with { type: "text" };

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${componentStyles}\n${panelStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

const root = document.getElementById("app");
if (root === null) throw new Error("sidepanel/index.html is missing #app");
void loadSettings(browser.storage.local)
  .catch((error: unknown) => {
    console.error("point-and-shoot: panel settings could not load", error);
    return DEFAULT_SETTINGS;
  })
  .then((settings) =>
    render(
      <NotesPanel
        exportDelivery={{
          clipboard: navigator.clipboard,
          createObjectURL: (blob) => URL.createObjectURL(blob),
          downloads: browser.downloads,
          revokeObjectURL: (url) => URL.revokeObjectURL(url),
        }}
        iconSpriteUrl="/src/shared/design/icons.svg"
        repository={createNotesRepository(browser.storage.local)}
        sizeBudgetBytes={settings.exportSizeBudgetBytes}
      />,
      root,
    )
  );
