/// <reference lib="dom" />
/** Options-page entry point for typed settings and stored-session controls. */

import { render } from "preact";
import { browser } from "../shared/browser.ts";
import componentStyles from "../ui/components/components.css" with { type: "text" };
import { Options } from "./Options.tsx";
import optionsStyles from "./options.css" with { type: "text" };
import { createOptionsRepository } from "./repository.ts";

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${componentStyles}\n${optionsStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

const root = document.getElementById("app");
if (root === null) throw new Error("options/index.html is missing #app");
render(
  <Options
    autoTheme={matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"}
    repository={createOptionsRepository(browser)}
    version={browser.runtime.getManifest().version}
  />,
  root,
);
