/// <reference lib="dom" />

/**
 * Content-script entry point. Creates the isolated Wave 3 UI host after the explicit activation
 * gesture. Bundled as an IIFE because MV3 content scripts are classic scripts in both targets.
 *
 * Injected on a user gesture by `src/background/index.ts`, never registered in the manifest
 * (ADR-0002), so it must tolerate running on a page that finished loading long ago and being
 * injected more than once — a second gesture on the same tab re-runs this file top to bottom.
 *
 * The `data-point-and-shoot-content-ready` attribute is W2.9's deterministic boot signal: a
 * Playwright test can poll for it without sniffing for UI that doesn't exist yet.
 *
 * @module
 */

import { h, render } from "preact";
import { browser } from "../shared/browser.ts";
import iconSprite from "../shared/design/icons.svg" with { type: "text" };
import { OPEN_NOTES_PANEL_MESSAGE, TOGGLE_OVERLAY_MESSAGE } from "../shared/messages.ts";
import { resolveTheme, sampleBackdrop, watchTheme } from "../shared/theme.ts";
import { CaptureOverlay } from "./CaptureOverlay.tsx";
import { captureSelectedRegion } from "./capture.ts";
import { createShadowHost } from "./host.ts";
import { createOverlayLifecycle } from "./lifecycle.ts";
import { saveCapturedSelection } from "./notes.ts";
import pickerStyles from "./picker/picker.css" with { type: "text" };
import toolbarStyles from "./toolbar/toolbar.css" with { type: "text" };

const TOOLBAR_MAXIMUM_WIDTH = 420;
const TOOLBAR_PROSPECTIVE_HEIGHT = 72;
const TOOLBAR_VIEWPORT_GAP = 24;
const ownerWindow = globalThis as unknown as Window;

function prospectiveToolbarBounds(ownerWindow: Window): DOMRect {
  const width = Math.min(
    TOOLBAR_MAXIMUM_WIDTH,
    Math.max(0, ownerWindow.innerWidth - 2 * TOOLBAR_VIEWPORT_GAP),
  );
  const height = Math.min(
    TOOLBAR_PROSPECTIVE_HEIGHT,
    Math.max(0, ownerWindow.innerHeight - 2 * TOOLBAR_VIEWPORT_GAP),
  );
  return new DOMRect(
    (ownerWindow.innerWidth - width) / 2,
    Math.max(0, ownerWindow.innerHeight - height - TOOLBAR_VIEWPORT_GAP),
    width,
    height,
  );
}

function mountOverlay(): () => void {
  const sample = () =>
    sampleBackdrop(
      document,
      prospectiveToolbarBounds(ownerWindow),
      document.querySelector("[data-point-and-shoot-host]") ?? undefined,
    );
  const initialTheme = resolveTheme({ sample });
  const shadowHost = createShadowHost({
    inlineIconSprite: iconSprite,
    resourceUrl: (path) => browser.runtime.getURL(path),
    styles: [pickerStyles, toolbarStyles],
    theme: initialTheme,
  });
  let isMounted = true;
  let noteCount = 0;
  const renderOverlay = (): void => {
    render(
      h(CaptureOverlay, {
        iconSpriteUrl: "",
        onSelection: (selection) => {
          void (async () => {
            const capture = await captureSelectedRegion(
              browser.runtime,
              shadowHost.element,
              ownerWindow,
              selection.region,
            );
            const saved = await saveCapturedSelection(
              browser.runtime,
              capture,
              selection,
              { title: document.title, url: ownerWindow.location.href },
            );
            noteCount = saved.noteCount;
            if (isMounted) renderOverlay();
          })().catch((error: unknown) => {
            console.error("point-and-shoot: note capture failed", error);
          });
        },
        noteCount,
        onSend: () => {
          void browser.runtime.sendMessage(OPEN_NOTES_PANEL_MESSAGE).catch((error: unknown) => {
            console.error("point-and-shoot: notes panel failed to open", error);
          });
        },
      }),
      shadowHost.mount,
    );
  };
  renderOverlay();
  const stopTheme = watchTheme({
    onChange: (theme) => {
      shadowHost.element.dataset.theme = theme;
    },
    ownerWindow,
    sample,
  });

  return () => {
    isMounted = false;
    stopTheme();
    shadowHost.destroy();
  };
}

if (document.documentElement.dataset.pointAndShootContentReady === "true") {
  console.log("point-and-shoot: content script already present, skipping re-init");
} else {
  const lifecycle = createOverlayLifecycle(mountOverlay);
  lifecycle.toggle();
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message !== TOGGLE_OVERLAY_MESSAGE) return;
    sendResponse({ mounted: lifecycle.toggle() });
  });
  document.documentElement.dataset.pointAndShootContentReady = "true";
  console.log("point-and-shoot: content script ready");
}
