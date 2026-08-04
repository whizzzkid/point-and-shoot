/// <reference lib="dom" />
/** Popup entry point for session and active-tab launcher actions. */

import { render } from "preact";
import { browser, displayVersion } from "../shared/browser.ts";
import componentStyles from "../ui/components/components.css" with { type: "text" };
import { IconSpriteProvider } from "../ui/components/index.ts";
import { createPopupActions } from "./actions.ts";
import { Popup } from "./Popup.tsx";
import popupStyles from "./popup.css" with { type: "text" };
import { createPopupSessionRepository } from "./repository.ts";

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${componentStyles}\n${popupStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

const root = document.getElementById("app");
if (root === null) throw new Error("popup/index.html is missing #app");
render(
  <IconSpriteProvider url="/src/shared/design/icons.svg">
    <Popup
      actions={createPopupActions(browser)}
      repository={createPopupSessionRepository(browser.storage.local)}
      theme="dark"
      version={displayVersion(browser.runtime.getManifest())}
    />
  </IconSpriteProvider>,
  root,
);
