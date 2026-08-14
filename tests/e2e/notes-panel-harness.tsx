/// <reference lib="dom" />

import { render } from "preact";
import { NotesPanel } from "../../src/sidepanel/NotesPanel.tsx";
import { createNotesRepository, type NotesRepository } from "../../src/sidepanel/repository.ts";
import type { StorageChangedListener, StorageItems } from "../../src/shared/browser.ts";
import type { Session } from "../../src/shared/schema.ts";
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import { ACTIVE_SESSION_ID_STORAGE_KEY } from "../../src/shared/session.ts";
import { openStore, putSession } from "../../src/shared/store.ts";
import componentStyles from "../../src/ui/components/components.css" with { type: "text" };
import tokenStyles from "../../src/shared/design/tokens.css" with { type: "text" };
import panelStyles from "../../src/sidepanel/sidepanel.css" with { type: "text" };

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${tokenStyles}\n${componentStyles}\n${panelStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
document.body.replaceChildren();
document.body.insertAdjacentHTML("afterbegin", iconSprite);
const mount = document.createElement("div");
mount.id = "app";
document.body.append(mount);

const values: StorageItems = {};
const storageListeners = new Set<StorageChangedListener>();
const storage = {
  get(keys?: string | readonly string[] | null) {
    if (keys == null) return Promise.resolve({ ...values });
    const selected = Array.isArray(keys) ? keys : [keys];
    return Promise.resolve(
      Object.fromEntries(selected.filter((key) => key in values).map((key) => [key, values[key]])),
    );
  },
  remove(keys: string | readonly string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    return Promise.resolve();
  },
  set(items: StorageItems) {
    const changes = Object.fromEntries(
      Object.entries(items).map(([key, newValue]) => [
        key,
        { newValue, oldValue: values[key] },
      ]),
    );
    Object.assign(values, items);
    for (const listener of storageListeners) listener(changes, "local");
    return Promise.resolve();
  },
};
const repository = createNotesRepository(storage, {
  addListener(listener) {
    storageListeners.add(listener);
  },
  removeListener(listener) {
    storageListeners.delete(listener);
  },
});
const previewEvents: string[] = [];
const notePreview = {
  clear() {
    previewEvents.push("clear");
  },
  show(note: Session["notes"][number]) {
    previewEvents.push(`show:${note.id}`);
  },
};

function fixtureScreenshot(index: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("notes-panel harness could not create a canvas context");
  context.fillStyle = index % 2 === 0 ? "#f5f6f8" : "#15171d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = index % 2 === 0 ? "#c2c8d1" : "#3d4152";
  for (let row = 0; row < 4; row++) {
    context.fillRect(16, 20 + row * 26, 120 + row * 20, 8);
  }
  context.fillStyle = "#4f7cff";
  context.fillRect(16, 126, 72, 20);
  return canvas.toDataURL("image/webp", 0.7);
}

function renderPanel(
  theme: "dark" | "light",
  selectedRepository: NotesRepository,
): void {
  document.documentElement.dataset.theme = theme;
  render(
    <NotesPanel
      exportDelivery={{
        clipboard: { writeText: () => Promise.resolve() },
        createObjectURL: () => "blob:notes-panel-harness",
        downloads: { download: () => Promise.resolve(1) },
        revokeObjectURL: () => undefined,
      }}
      iconSpriteUrl=""
      notePreview={notePreview}
      repository={selectedRepository}
      version="0.1.0"
    />,
    mount,
  );
}

const harness = {
  mount(theme: "dark" | "light") {
    renderPanel(theme, repository);
  },
  mountWithLoadError(theme: "dark" | "light", message: string) {
    renderPanel(theme, {
      load: () => Promise.reject(new Error(message)),
      save: () => Promise.resolve(),
      complete: (session) => Promise.resolve(session),
      watch: () => () => undefined,
    });
  },
  mountWithSaveError(theme: "dark" | "light", message: string) {
    renderPanel(theme, {
      load: () => repository.load(),
      save: () => Promise.reject(new Error(message)),
      complete: (session) => Promise.resolve(session),
      watch: () => () => undefined,
    });
  },
  previewEvents() {
    return [...previewEvents];
  },
  resetPreviewEvents() {
    previewEvents.length = 0;
  },
  async seed(session: Session) {
    const sessionWithImages: Session = {
      ...session,
      notes: session.notes.map((note, index) => ({
        ...note,
        region: { ...note.region, screenshot: fixtureScreenshot(index) },
      })),
    };
    const database = await openStore();
    try {
      await putSession(database, sessionWithImages);
      await storage.set({ [ACTIVE_SESSION_ID_STORAGE_KEY]: session.id });
    } finally {
      database.close();
    }
  },
  setTheme(theme: "dark" | "light") {
    document.documentElement.dataset.theme = theme;
  },
  unmount() {
    render(null, mount);
  },
};

(globalThis as unknown as { pointShootNotesPanelTest: typeof harness }).pointShootNotesPanelTest =
  harness;
