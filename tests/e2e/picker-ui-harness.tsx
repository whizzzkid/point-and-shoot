/// <reference lib="dom" />

import { render } from "preact";
import { CaptureOverlay } from "../../src/content/CaptureOverlay.tsx";
import { createShadowHost } from "../../src/content/host.ts";
import type { PickerSelection } from "../../src/content/picker/ElementPicker.tsx";
import pickerStyles from "../../src/content/picker/picker.css" with { type: "text" };
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import toolbarStyles from "../../src/content/toolbar/toolbar.css" with { type: "text" };

let selections: PickerSelection[] = [];
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
        selections = [...selections, selection];
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
  return {
    activeLabel: shadowHost.root.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.ariaLabel,
    latestCount: latest?.kind === "elements" ? latest.elements.length : 0,
    latestKind: latest?.kind,
    latestReason: latest?.kind === "unreachable" ? latest.reason : undefined,
    overlayCount: overlays.length,
    preview,
    primaryCount: latest?.kind === "elements"
      ? latest.elements.filter((element) => element.primary).length
      : 0,
  };
}

renderPicker();

const harness = {
  async reenter() {
    const select = shadowHost.root.querySelector<HTMLButtonElement>(
      'button[aria-label="Select"]',
    );
    if (select === null) throw new Error("picker UI harness has no Select control");
    select.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  reset() {
    selections = [];
  },
  setTheme(theme: "dark" | "light") {
    shadowHost.element.dataset.theme = theme;
  },
  summary,
};

(globalThis as unknown as { pointShootPickerUiTest: typeof harness }).pointShootPickerUiTest =
  harness;
