/// <reference lib="dom" />

import { render } from "preact";
import { createShadowHost } from "../../src/content/host.ts";
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import {
  FloatingToolbar,
  type FloatingToolbarProps,
} from "../../src/content/toolbar/FloatingToolbar.tsx";
import toolbarStyles from "../../src/content/toolbar/toolbar.css" with { type: "text" };
import type { PlacementRect } from "../../src/content/toolbar/placement.ts";

const shadowHost = createShadowHost({
  inlineIconSprite: iconSprite,
  resourceUrl: () => "data:font/woff2;base64,d09GMg==",
  styles: [toolbarStyles],
  theme: "dark",
});
let selection: PlacementRect | undefined;
let composer: PlacementRect | undefined;

function renderToolbar(): void {
  const props: FloatingToolbarProps = {
    iconSpriteUrl: "",
    version: "0.1.0",
    ...(composer === undefined ? {} : { composer }),
    ...(selection === undefined ? {} : { selection }),
  };
  render(<FloatingToolbar {...props} />, shadowHost.mount);
}

function toolbarElement(): HTMLElement {
  const toolbar = shadowHost.root.querySelector<HTMLElement>('[role="toolbar"]');
  if (toolbar === null) throw new Error("toolbar harness has no toolbar");
  return toolbar;
}

async function settleLayout(): Promise<void> {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

function rectOf(rect: DOMRect): PlacementRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

renderToolbar();

const harness = {
  async place(nextSelection?: PlacementRect, nextComposer?: PlacementRect) {
    selection = nextSelection;
    composer = nextComposer;
    renderToolbar();
    await settleLayout();
    return rectOf(toolbarElement().getBoundingClientRect());
  },
  controls() {
    const toolbar = toolbarElement();
    return {
      activeLabel: toolbar.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.ariaLabel,
      labels: [...toolbar.querySelectorAll<HTMLButtonElement>("button")].map((button) =>
        button.textContent?.trim() || button.ariaLabel
      ),
      noteCount: toolbar.querySelector(".ps-badge")?.textContent,
      version: toolbar.querySelector(".ps-version-label")?.textContent,
      sendDisabled: toolbar.querySelector<HTMLButtonElement>(".ps-button")?.disabled,
      sendVariant: toolbar.querySelector<HTMLButtonElement>(".ps-button")?.dataset.variant,
    };
  },
  async choose(label: string) {
    const button = [...toolbarElement().querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.ariaLabel === label,
    );
    if (button === undefined) throw new Error(`toolbar harness has no "${label}" button`);
    button.click();
    await settleLayout();
    return this.controls();
  },
  destroy: shadowHost.destroy,
  setTheme(theme: "dark" | "light") {
    shadowHost.element.dataset.theme = theme;
  },
  stickyHeaderRect() {
    const header = document.querySelector<HTMLElement>('[data-testid="sticky-header"]');
    if (header === null) throw new Error("tall fixture has no sticky header");
    return rectOf(header.getBoundingClientRect());
  },
};

(globalThis as unknown as { pointShootToolbarTest: typeof harness }).pointShootToolbarTest =
  harness;
