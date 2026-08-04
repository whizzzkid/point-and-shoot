/// <reference lib="dom" />

import { render } from "preact";
import { CaptureOverlay } from "../../src/content/CaptureOverlay.tsx";
import { createShadowHost } from "../../src/content/host.ts";
import type { PickerSelection } from "../../src/content/picker/ElementPicker.tsx";
import pickerStyles from "../../src/content/picker/picker.css" with { type: "text" };
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import toolbarStyles from "../../src/content/toolbar/toolbar.css" with { type: "text" };

let selections: PickerSelection[] = [];
let savedNotes: string[] = [];
let failNextSave = false;
let failNextCapture = false;
let preview: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
} | undefined;

const shadowHost = createShadowHost({
  inlineIconSprite: iconSprite,
  resourceUrl: () => "data:font/woff2;base64,d09GMg==",
  styles: [pickerStyles, toolbarStyles],
  theme: "dark",
});

function renderPicker(): void {
  render(
    <CaptureOverlay
      iconSpriteUrl=""
      onPreviewChange={(nextPreview) => {
        preview = nextPreview;
      }}
      onSelection={(selection) => {
        if (failNextCapture) {
          failNextCapture = false;
          return Promise.reject(new Error("Screenshot capture failed."));
        }
        selections = [...selections, selection];
      }}
      onSave={(text) => {
        if (failNextSave) {
          failNextSave = false;
          return Promise.reject(new Error("IndexedDB unavailable."));
        }
        savedNotes = [...savedNotes, text];
        return Promise.resolve();
      }}
    />,
    shadowHost.mount,
  );
}

function summary() {
  const overlays = shadowHost.root.querySelectorAll(
    ".ps-picker-highlight, .ps-picker-drag-box, .ps-picker-frame-shield",
  );
  const latest = selections.at(-1);
  const composerRect = shadowHost.root.querySelector<HTMLElement>(".ps-note-composer")
    ?.getBoundingClientRect();
  return {
    activeLabel: shadowHost.root.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.ariaLabel,
    composerRect: composerRect === undefined ? undefined : {
      height: composerRect.height,
      left: composerRect.left,
      top: composerRect.top,
      width: composerRect.width,
    },
    focusedLabel: shadowHost.root.activeElement?.getAttribute("aria-label"),
    latestCount: latest?.kind === "elements" ? latest.elements.length : 0,
    latestKind: latest?.kind,
    latestReason: latest?.kind === "unreachable" ? latest.reason : undefined,
    error: shadowHost.root.querySelector('[role="alert"]')?.textContent,
    overlayCount: overlays.length,
    composerOpen: shadowHost.root.querySelector('[role="dialog"]') !== null,
    toolbarPresent: shadowHost.root.querySelector('[role="toolbar"]') !== null,
    preview,
    primaryCount: latest?.kind === "elements"
      ? latest.elements.filter((element) => element.primary).length
      : 0,
    savedNotes,
    selectionCount: selections.length,
  };
}

renderPicker();

const harness = {
  async reenter() {
    render(null, shadowHost.mount);
    renderPicker();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  reset() {
    selections = [];
    savedNotes = [];
  },
  async cancelComposer() {
    const button = [...shadowHost.root.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent === "Cancel",
    );
    if (button === undefined) throw new Error("picker UI harness has no composer cancel action");
    button.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  failCapture() {
    failNextCapture = true;
  },
  focusDocumentElement() {
    document.documentElement.tabIndex = -1;
    document.documentElement.focus();
  },
  async saveNote(text: string, fail = false) {
    const input = shadowHost.root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]');
    const button = [...shadowHost.root.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent === "Save note",
    );
    if (input === null || button === undefined) {
      throw new Error("picker UI harness has no open note composer");
    }
    input.value = text;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    failNextSave = fail;
    button.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  },
  setTheme(theme: "dark" | "light") {
    shadowHost.element.dataset.theme = theme;
  },
  summary,
};

(globalThis as unknown as { pointShootPickerUiTest: typeof harness }).pointShootPickerUiTest =
  harness;
