/// <reference lib="dom" />

import { render } from "preact";
import { PlanView, type PlanViewActions } from "../../src/sidepanel/plan/PlanView.tsx";
import { EXPORT_FIXTURE_SESSION } from "../../src/shared/serialize/fixture.ts";
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import componentStyles from "../../src/ui/components/components.css" with { type: "text" };
import tokenStyles from "../../src/shared/design/tokens.css" with { type: "text" };
import panelStyles from "../../src/sidepanel/sidepanel.css" with { type: "text" };
import { IconSpriteProvider } from "../../src/ui/components/index.ts";

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`${tokenStyles}\n${componentStyles}\n${panelStyles}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
document.body.replaceChildren();
document.body.insertAdjacentHTML("afterbegin", iconSprite);
const mount = document.createElement("div");
mount.id = "app";
document.body.append(mount);

const actionLog: {
  copies: string[][];
  bundleDownloads: string[][];
  promptDownloads: string[][];
  backs: number;
} = {
  copies: [],
  bundleDownloads: [],
  promptDownloads: [],
  backs: 0,
};
let pendingResolvers: (() => void)[] = [];

function fixtureScreenshot(index: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("plan-view harness could not create a canvas context");
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

const SESSION_WITH_IMAGES = {
  ...EXPORT_FIXTURE_SESSION,
  notes: EXPORT_FIXTURE_SESSION.notes.map((note, index) => ({
    ...note,
    region: { ...note.region, screenshot: fixtureScreenshot(index) },
  })),
};

function result(fail: boolean, pending: boolean, message: string): Promise<void> {
  if (fail) return Promise.reject(new Error(message));
  if (!pending) return Promise.resolve();
  return new Promise((resolve) => pendingResolvers.push(resolve));
}

function actions(fail: boolean, pending: boolean): PlanViewActions {
  return {
    copy(includedNoteIds) {
      actionLog.copies.push([...includedNoteIds]);
      return result(fail, pending, "Clipboard access was denied.");
    },
    downloadBundle(includedNoteIds) {
      actionLog.bundleDownloads.push([...includedNoteIds]);
      return result(fail, pending, "The bundle could not download.");
    },
    downloadPrompt(includedNoteIds) {
      actionLog.promptDownloads.push([...includedNoteIds]);
      return result(fail, pending, "The prompt could not download.");
    },
  };
}

function mountPlan(
  theme: "dark" | "light",
  sizeBudgetBytes: number,
  fail: boolean,
  pending: boolean,
  archiveFails: boolean,
): void {
  document.documentElement.dataset.theme = theme;
  render(
    <IconSpriteProvider url="">
      <PlanView
        actions={actions(fail, pending)}
        onBack={() => {
          actionLog.backs++;
        }}
        session={archiveFails
          ? {
            ...SESSION_WITH_IMAGES,
            notes: SESSION_WITH_IMAGES.notes.map((note, index) =>
              index === 0
                ? { ...note, region: { ...note.region, screenshot: "not-a-webp-data-url" } }
                : note
            ),
          }
          : SESSION_WITH_IMAGES}
        sizeBudgetBytes={sizeBudgetBytes}
      />
    </IconSpriteProvider>,
    mount,
  );
}

const harness = {
  actionLog,
  mount(
    theme: "dark" | "light",
    sizeBudgetBytes = 2_000_000,
    fail = false,
    pending = false,
    archiveFails = false,
  ) {
    mountPlan(theme, sizeBudgetBytes, fail, pending, archiveFails);
  },
  resolveActions() {
    const resolvers = pendingResolvers;
    pendingResolvers = [];
    for (const resolve of resolvers) resolve();
  },
  setTheme(theme: "dark" | "light") {
    document.documentElement.dataset.theme = theme;
  },
  unmount() {
    render(null, mount);
  },
};

(globalThis as unknown as { pointShootPlanViewTest: typeof harness }).pointShootPlanViewTest =
  harness;
