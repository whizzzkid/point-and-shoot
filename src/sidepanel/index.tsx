/// <reference lib="dom" />
/** Side-panel entry point for the active session review workspace. */

import { render } from "preact";
import { browser } from "../shared/browser.ts";
import componentStyles from "../ui/components/components.css" with { type: "text" };
import { NotesPanel } from "./NotesPanel.tsx";
import { browserNotePreviewController } from "./note-preview.ts";
import { createNotesRepository } from "./repository.ts";
import panelStyles from "./sidepanel.css" with { type: "text" };

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${componentStyles}\n${panelStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

const root = document.getElementById("app");
if (root === null) throw new Error("sidepanel/index.html is missing #app");
render(
  <NotesPanel
    exportDelivery={{
      clipboard: navigator.clipboard,
      createObjectURL: (blob) => URL.createObjectURL(blob),
      downloads: browser.downloads,
      revokeObjectURL: (url) => URL.revokeObjectURL(url),
    }}
    iconSpriteUrl="/src/shared/design/icons.svg"
    notePreview={browserNotePreviewController(browser)}
    repository={createNotesRepository(browser.storage.local, browser.storage.onChanged)}
    version={browser.runtime.getManifest().version}
  />,
  root,
);
