/// <reference lib="dom" />

import { createShadowHost } from "../../src/content/host.ts";
import { Button } from "../../src/ui/components/index.ts";

const shadowHost = createShadowHost({
  children: <Button>Shadow action</Button>,
  resourceUrl: () => "data:font/woff2;base64,d09GMg==",
  theme: "dark",
});

const shadowButton = shadowHost.root.querySelector<HTMLButtonElement>(".ps-button");
if (shadowButton === null) throw new Error("host harness could not find the mounted button");

const harness = {
  destroy: shadowHost.destroy,
  documentSheetCount: document.adoptedStyleSheets.length,
  host: shadowHost.element,
  root: shadowHost.root,
  shadowButton,
};

(globalThis as unknown as { pointShootHostTest: typeof harness }).pointShootHostTest = harness;
