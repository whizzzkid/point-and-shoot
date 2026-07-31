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
import {
  GET_OVERLAY_STATE_MESSAGE,
  isNotePreviewRequest,
  OPEN_NOTES_PANEL_MESSAGE,
  TOGGLE_OVERLAY_MESSAGE,
} from "../shared/messages.ts";
import { DEFAULT_SETTINGS, type ExtensionSettings, loadSettings } from "../shared/settings.ts";
import { resolveTheme, sampleBackdrop, watchTheme } from "../shared/theme.ts";
import { CaptureOverlay } from "./CaptureOverlay.tsx";
import { captureSelectedRegion } from "./capture.ts";
import { addFrameworkComponentHints } from "./framework-hints.ts";
import { createShadowHost } from "./host.ts";
import { createOverlayLifecycle } from "./lifecycle.ts";
import { saveCapturedSelection } from "./notes.ts";
import { createLazyNotePreviewLayer, createNotePreviewLayer } from "./note-preview.ts";
import type { PickerSelection } from "./picker/ElementPicker.tsx";
import type { RegionCapture } from "../shared/schema.ts";
import { watchSessionSummary } from "./session-summary.ts";
import { watchSettings } from "./settings-watcher.ts";
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

interface MountedOverlay {
  readonly destroy: () => void;
  readonly refreshTheme: () => void;
}

function mountOverlay(
  readSettings: () => ExtensionSettings,
  onDismiss: () => void,
): MountedOverlay {
  const sample = () =>
    sampleBackdrop(
      document,
      prospectiveToolbarBounds(ownerWindow),
      document.querySelector("[data-point-and-shoot-host]") ?? undefined,
    );
  const initialTheme = resolveTheme({ override: readSettings().themeOverride, sample });
  const shadowHost = createShadowHost({
    inlineIconSprite: iconSprite,
    resourceUrl: (path) => browser.runtime.getURL(path),
    styles: [pickerStyles, toolbarStyles],
    theme: initialTheme,
  });
  let isMounted = true;
  let noteCount = 0;
  let pending:
    | { readonly capture: RegionCapture; readonly selection: PickerSelection }
    | undefined;
  const renderOverlay = (): void => {
    render(
      h(CaptureOverlay, {
        iconSpriteUrl: "",
        onCancel: () => {
          pending = undefined;
        },
        onDismiss,
        onSave: async (text) => {
          if (pending === undefined) throw new Error("The pending capture is no longer available.");
          await saveCapturedSelection(
            browser.runtime,
            pending.capture,
            pending.selection,
            text,
            { title: document.title, url: ownerWindow.location.href },
          );
          pending = undefined;
        },
        onSelection: async (selection) => {
          const [capture, enrichedSelection] = await Promise.all([
            captureSelectedRegion(
              browser.runtime,
              shadowHost.element,
              ownerWindow,
              selection.region,
            ),
            addFrameworkComponentHints(
              browser.runtime,
              selection,
              readSettings().frameworkHints,
            ),
          ]);
          if (!isMounted) throw new Error("The capture overlay was dismissed.");
          pending = { capture, selection: enrichedSelection };
        },
        noteCount,
        version: browser.runtime.getManifest().version,
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
  const stopSessionSummary = watchSessionSummary(browser, (summary) => {
    noteCount = summary.active ? summary.noteCount : 0;
    if (isMounted) renderOverlay();
  });
  const stopTheme = watchTheme({
    onChange: (theme) => {
      shadowHost.element.dataset.theme = theme;
    },
    override: () => readSettings().themeOverride,
    ownerWindow,
    sample,
  });

  return {
    destroy() {
      isMounted = false;
      stopSessionSummary();
      stopTheme();
      shadowHost.destroy();
    },
    refreshTheme() {
      if (isMounted) {
        shadowHost.element.dataset.theme = resolveTheme({
          override: readSettings().themeOverride,
          sample,
        });
      }
    },
  };
}

function initializeContent(initialSettings: ExtensionSettings): void {
  let settings = initialSettings;
  let refreshMountedTheme: (() => void) | undefined;
  const notePreview = createLazyNotePreviewLayer(() =>
    createNotePreviewLayer(document, ownerWindow)
  );
  const lifecycle = createOverlayLifecycle(() => {
    const mounted = mountOverlay(() => settings, () => lifecycle.destroy());
    refreshMountedTheme = mounted.refreshTheme;
    return () => {
      if (refreshMountedTheme === mounted.refreshTheme) refreshMountedTheme = undefined;
      mounted.destroy();
    };
  });
  lifecycle.toggle();
  watchSettings(browser.storage, (nextSettings) => {
    settings = nextSettings;
    refreshMountedTheme?.();
  });
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isNotePreviewRequest(message)) {
      sendResponse({ shown: notePreview.handle(message) });
      return;
    }
    if (message === GET_OVERLAY_STATE_MESSAGE) {
      sendResponse({ mounted: lifecycle.isMounted() });
      return;
    }
    if (message !== TOGGLE_OVERLAY_MESSAGE) return;
    sendResponse({ mounted: lifecycle.toggle() });
  });
  document.documentElement.dataset.pointAndShootContentReady = "true";
  console.log("point-and-shoot: content script ready");
}

const contentState = document.documentElement.dataset.pointAndShootContentReady;
if (contentState === "true" || contentState === "initializing") {
  console.log("point-and-shoot: content script already present, skipping re-init");
} else {
  document.documentElement.dataset.pointAndShootContentReady = "initializing";
  void loadSettings(browser.storage.local)
    .catch((error: unknown) => {
      console.error("point-and-shoot: initial content settings could not load", error);
      return DEFAULT_SETTINGS;
    })
    .then(initializeContent)
    .catch((error: unknown) => {
      delete document.documentElement.dataset.pointAndShootContentReady;
      console.error("point-and-shoot: content script failed to initialize", error);
    });
}
