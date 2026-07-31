/// <reference lib="dom" />

import { NOTE_PREVIEW_MESSAGE } from "../../src/shared/messages.ts";
import type { SelectorBundle } from "../../src/shared/selectors.ts";
import { createNotePreviewLayer } from "../../src/content/note-preview.ts";

const layer = createNotePreviewLayer();
let generation = 0;
const show = (selectors: SelectorBundle): boolean => {
  generation += 1;
  return layer.handle({
    action: "show",
    generation,
    pageUrl: location.href,
    selectors: [selectors],
    stripQuery: false,
    type: NOTE_PREVIEW_MESSAGE,
  });
};

const harness = {
  clear(): boolean {
    generation += 1;
    return layer.handle({ action: "clear", generation, type: NOTE_PREVIEW_MESSAGE });
  },
  destroy: () => layer.destroy(),
  hostCount: () => document.querySelectorAll("[data-point-and-shoot-preview-host]").length,
  show,
  staleClear(): boolean {
    return layer.handle({
      action: "clear",
      generation: Math.max(0, generation - 1),
      type: NOTE_PREVIEW_MESSAGE,
    });
  },
};

(globalThis as unknown as { pointShootNotePreviewTest: typeof harness })
  .pointShootNotePreviewTest = harness;
