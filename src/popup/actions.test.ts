import { assertEquals, assertRejects } from "@std/assert";
import { createPopupActions, type PopupBrowser } from "./actions.ts";
import { GET_OVERLAY_STATE_MESSAGE, TOGGLE_ACTIVE_TAB_MESSAGE } from "../shared/messages.ts";

function createBrowser(): {
  readonly browser: PopupBrowser;
  readonly calls: string[];
  rejectTabMessage(): void;
  setNoActiveTab(): void;
  setRuntimeResponse(value: unknown): void;
} {
  const calls: string[] = [];
  let runtimeResponse: unknown = { mounted: true, ok: true, result: "toggled" };
  const tabResponse: unknown = { mounted: false };
  let hasActiveTab = true;
  let tabMessageRejects = false;
  return {
    browser: {
      openPanel(tabId) {
        calls.push(`openPanel:${tabId}`);
        return Promise.resolve();
      },
      runtime: {
        openOptionsPage() {
          calls.push("runtime.openOptionsPage");
          return Promise.resolve();
        },
        sendMessage(message) {
          calls.push(`runtime.sendMessage:${String(message)}`);
          return Promise.resolve(runtimeResponse);
        },
      },
      tabs: {
        query() {
          calls.push("tabs.query");
          return Promise.resolve(hasActiveTab ? [{ id: 7 }] : []);
        },
        sendMessage(tabId, message) {
          calls.push(`tabs.sendMessage:${tabId}:${String(message)}`);
          if (tabMessageRejects) return Promise.reject(new Error("no receiver"));
          return Promise.resolve(tabResponse);
        },
      },
    },
    calls,
    rejectTabMessage() {
      tabMessageRejects = true;
    },
    setNoActiveTab() {
      hasActiveTab = false;
    },
    setRuntimeResponse(value) {
      runtimeResponse = value;
    },
  };
}

Deno.test("popup actions read and toggle the active tab through typed messages", async () => {
  const fake = createBrowser();
  const actions = createPopupActions(fake.browser);

  assertEquals(await actions.readOverlay(), false);
  assertEquals(await actions.toggleOverlay(), true);
  assertEquals(fake.calls, [
    "tabs.query",
    `tabs.sendMessage:7:${GET_OVERLAY_STATE_MESSAGE}`,
    `runtime.sendMessage:${TOGGLE_ACTIVE_TAB_MESSAGE}`,
  ]);
});

Deno.test("popup actions treat a missing content realm as off and reject malformed toggle replies", async () => {
  const fake = createBrowser();
  fake.rejectTabMessage();
  const actions = createPopupActions(fake.browser);

  assertEquals(await actions.readOverlay(), false);
  fake.setRuntimeResponse({ ok: true, mounted: "yes", result: "toggled" });
  await assertRejects(() => actions.toggleOverlay(), Error, "invalid overlay response");
});

Deno.test("popup actions explain when the active page cannot host the overlay", async () => {
  const fake = createBrowser();
  fake.setRuntimeResponse({ mounted: false, ok: true, result: "unavailable" });
  const actions = createPopupActions(fake.browser);

  await assertRejects(
    () => actions.toggleOverlay(),
    Error,
    "Point & Shoot is unavailable on this page.",
  );
});

Deno.test("popup actions open notes for the active tab and options through the shim", async () => {
  const fake = createBrowser();
  const actions = createPopupActions(fake.browser);

  await actions.openNotes();
  await actions.openOptions();

  assertEquals(fake.calls, [
    "tabs.query",
    "openPanel:7",
    "runtime.openOptionsPage",
  ]);
});

Deno.test("popup actions reject when there is no active tab", async () => {
  const fake = createBrowser();
  fake.setNoActiveTab();
  const actions = createPopupActions(fake.browser);

  await assertRejects(() => actions.openNotes(), Error, "No active browser tab is available.");
});
