/// <reference lib="dom" />

import { render } from "preact";
import { Popup, type PopupActions, type PopupSessionRepository } from "../../src/popup/Popup.tsx";
import { SCHEMA_VERSION, type Session } from "../../src/shared/schema.ts";
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import componentStyles from "../../src/ui/components/components.css" with { type: "text" };
import tokenStyles from "../../src/shared/design/tokens.css" with { type: "text" };
import popupStyles from "../../src/popup/popup.css" with { type: "text" };
import { IconSpriteProvider } from "../../src/ui/components/index.ts";

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${tokenStyles}\n${componentStyles}\n${popupStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
document.body.replaceChildren();
document.body.insertAdjacentHTML("afterbegin", iconSprite);
const mount = document.createElement("div");
mount.id = "app";
document.body.append(mount);

const SESSION: Session = {
  createdAt: "2026-07-28T18:00:00.000Z",
  endedAt: null,
  id: "session-popup",
  name: "Checkout review",
  notes: [
    {
      createdAt: "2026-07-28T18:01:00.000Z",
      elements: [],
      id: "note-1",
      pageTitle: "Checkout",
      pageUrl: "https://example.com/checkout",
      region: {
        box: { height: 40, width: 100, x: 10, y: 20 },
        screenshot: "data:image/webp;base64,AAAA",
        truncated: false,
        viewport: { height: 600, width: 800 },
      },
      text: "Button needs more space.",
    },
    {
      createdAt: "2026-07-28T18:02:00.000Z",
      elements: [],
      id: "note-2",
      pageTitle: "Checkout",
      pageUrl: "https://example.com/checkout",
      region: {
        box: { height: 40, width: 100, x: 10, y: 80 },
        screenshot: "data:image/webp;base64,AAAA",
        truncated: false,
        viewport: { height: 600, width: 800 },
      },
      text: "Total wraps.",
    },
  ],
  domain: "example.com",
  schemaVersion: SCHEMA_VERSION,
};

const actionLog = { notes: 0, options: 0, starts: 0, toggles: 0 };

function renderPopup(
  theme: "dark" | "light",
  hasSession: boolean,
  fail: boolean,
): void {
  document.documentElement.dataset.theme = theme;
  let current = hasSession ? SESSION : null;
  let overlay = false;
  const repository: PopupSessionRepository = {
    load: () => Promise.resolve(current),
    startOrResume() {
      actionLog.starts++;
      if (fail) return Promise.reject(new Error("The session could not start."));
      current ??= { ...SESSION, name: "Untitled session", notes: [] };
      return Promise.resolve(current);
    },
  };
  const actions: PopupActions = {
    openNotes() {
      actionLog.notes++;
      return fail
        ? Promise.reject(new Error("The notes panel could not open."))
        : Promise.resolve();
    },
    openOptions() {
      actionLog.options++;
      return Promise.resolve();
    },
    readOverlay: () => Promise.resolve(overlay),
    toggleOverlay() {
      actionLog.toggles++;
      overlay = !overlay;
      return Promise.resolve(overlay);
    },
  };
  render(
    <IconSpriteProvider url="">
      <Popup actions={actions} repository={repository} theme={theme} version="0.1.0" />
    </IconSpriteProvider>,
    mount,
  );
}

const harness = {
  actionLog,
  mount(theme: "dark" | "light", hasSession: boolean, fail = false) {
    renderPopup(theme, hasSession, fail);
  },
  unmount() {
    render(null, mount);
  },
};

(globalThis as unknown as { pointShootPopupTest: typeof harness }).pointShootPopupTest = harness;
