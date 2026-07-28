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
  detachedDocumentSpriteResult() {
    const detachedDocument = document.implementation.createHTMLDocument();
    try {
      createShadowHost({
        inlineIconSprite: "<svg />",
        ownerDocument: detachedDocument,
        resourceUrl: () => "data:font/woff2;base64,d09GMg==",
        theme: "dark",
      });
      return "did not throw";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  },
  destroy: shadowHost.destroy,
  documentSheetCount: document.adoptedStyleSheets.length,
  host: shadowHost.element,
  invalidSpriteResult() {
    const hostCount = document.querySelectorAll("[data-point-and-shoot-host]").length;
    const sheetCount = document.adoptedStyleSheets.length;
    try {
      createShadowHost({
        inlineIconSprite: "<svg>",
        resourceUrl: () => "data:font/woff2;base64,d09GMg==",
        theme: "dark",
      });
      return { hostCount: -1, message: "did not throw", sheetCount: -1 };
    } catch (error) {
      return {
        hostCount: document.querySelectorAll("[data-point-and-shoot-host]").length - hostCount,
        message: error instanceof Error ? error.message : String(error),
        sheetCount: document.adoptedStyleSheets.length - sheetCount,
      };
    }
  },
  root: shadowHost.root,
  shadowButton,
};

(globalThis as unknown as { pointShootHostTest: typeof harness }).pointShootHostTest = harness;
