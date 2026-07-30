import { assertEquals, assertRejects } from "@std/assert";
import type { ActionClickedListener } from "../shared/browser.ts";
import { SCHEMA_VERSION, type Session } from "../shared/schema.ts";
import type { ActivationController, ActivationOutcome } from "./activation.ts";
import type { SessionService } from "./session.ts";
import {
  createSessionActionController,
  registerSessionActionHandler,
  type SessionActionBrowser,
} from "./session-action.ts";

function session(noteCount: number): Session {
  return {
    createdAt: "2026-07-30T12:00:00.000Z",
    endedAt: null,
    id: "session-1",
    name: "Untitled session",
    notes: Array.from({ length: noteCount }, (_, index) => ({
      createdAt: "2026-07-30T12:01:00.000Z",
      elements: [],
      id: `note-${index + 1}`,
      pageTitle: "Fixture",
      pageUrl: "https://example.com",
      region: {
        box: { height: 10, width: 10, x: 0, y: 0 },
        screenshot: "data:image/webp;base64,V0VCUA==",
        truncated: false,
        viewport: { height: 600, width: 800 },
      },
      text: "",
    })),
    schemaVersion: SCHEMA_VERSION,
  };
}

function createFakes(initial: Session | null = null): {
  readonly activation: ActivationController;
  readonly browser: SessionActionBrowser;
  readonly calls: string[];
  readonly service: SessionService;
  click(tabId: number): void;
  setMountOutcome(outcome: ActivationOutcome): void;
} {
  const calls: string[] = [];
  let active = initial;
  let mountOutcome: ActivationOutcome = { mounted: true, result: "injected" };
  let clickListener: ActionClickedListener | undefined;
  const activation: ActivationController = {
    mount(tabId) {
      calls.push(`activation.mount:${tabId}`);
      return Promise.resolve(mountOutcome);
    },
    toggle: () => Promise.reject(new Error("not used")),
    unmount(tabId) {
      calls.push(`activation.unmount:${tabId}`);
      return Promise.resolve({ mounted: false, result: "toggled" });
    },
  };
  const browser: SessionActionBrowser = {
    action: {
      onClicked: {
        addListener(listener) {
          clickListener = listener;
        },
      },
      setBadgeText({ text }) {
        calls.push(`action.badge:${text}`);
        return Promise.resolve();
      },
      setTitle({ title }) {
        calls.push(`action.title:${title}`);
        return Promise.resolve();
      },
    },
    openPanel(tabId) {
      calls.push(`panel.open:${tabId}`);
      return Promise.resolve();
    },
  };
  const service: SessionService = {
    append: () => Promise.reject(new Error("not used")),
    end() {
      calls.push("session.end");
      if (active === null) return Promise.resolve(null);
      active = { ...active, endedAt: "2026-07-30T12:30:00.000Z" };
      return Promise.resolve(active);
    },
    loadActive() {
      calls.push("session.load");
      return Promise.resolve(active);
    },
    start() {
      calls.push("session.start");
      active = session(0);
      return Promise.resolve(active);
    },
  };
  return {
    activation,
    browser,
    calls,
    click(tabId) {
      clickListener?.({ id: tabId });
    },
    service,
    setMountOutcome(outcome) {
      mountOutcome = outcome;
    },
  };
}

Deno.test("session action toolbar click opens the panel and toggles the session", async () => {
  const fake = createFakes();
  const controller = createSessionActionController(fake.browser, fake.activation, fake.service);
  registerSessionActionHandler(fake.browser, controller);

  fake.click(7);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(fake.calls.includes("panel.open:7"), true);
  assertEquals(fake.calls.includes("activation.mount:7"), true);
  assertEquals(fake.calls.at(-2), "action.badge:0");
  assertEquals(fake.calls.at(-1), "action.title:Point and Shoot — End session (0 notes)");
});

Deno.test("session action starts capture and renders a zero-note badge and tooltip", async () => {
  const fake = createFakes();
  const controller = createSessionActionController(fake.browser, fake.activation, fake.service);

  assertEquals(await controller.toggle(7), {
    noteCount: 0,
    sessionId: "session-1",
    state: "started",
  });
  assertEquals(fake.calls, [
    "session.load",
    "activation.mount:7",
    "session.start",
    "action.badge:0",
    "action.title:Point and Shoot — End session (0 notes)",
  ]);
});

Deno.test("session action ends capture and clears the badge while retaining session data", async () => {
  const fake = createFakes(session(3));
  const controller = createSessionActionController(fake.browser, fake.activation, fake.service);

  assertEquals(await controller.toggle(7), {
    noteCount: 3,
    sessionId: "session-1",
    state: "ended",
  });
  assertEquals(fake.calls, [
    "session.load",
    "activation.unmount:7",
    "session.end",
    "action.badge:",
    "action.title:Point and Shoot — Start session",
  ]);
});

Deno.test("session action does not create a session when the page is restricted", async () => {
  const fake = createFakes();
  fake.setMountOutcome({ mounted: false, result: "unavailable" });
  const controller = createSessionActionController(fake.browser, fake.activation, fake.service);

  assertEquals(await controller.toggle(7), { state: "unavailable" });
  assertEquals(fake.calls, [
    "session.load",
    "activation.mount:7",
    "action.badge:!",
    "action.title:Point and Shoot — unavailable on this page",
  ]);
});

Deno.test("session action caps the badge while keeping the tooltip count exact", async () => {
  const fake = createFakes(session(120));
  const controller = createSessionActionController(fake.browser, fake.activation, fake.service);

  await controller.synchronize();

  assertEquals(fake.calls, [
    "session.load",
    "action.badge:99+",
    "action.title:Point and Shoot — End session (120 notes)",
  ]);
});

Deno.test("session action rolls back the overlay and reports a start failure", async () => {
  const fake = createFakes();
  const controller = createSessionActionController(fake.browser, fake.activation, {
    ...fake.service,
    start: () => Promise.reject(new Error("Storage quota exceeded.")),
  });

  await assertRejects(() => controller.toggle(7), Error, "Storage quota exceeded.");

  assertEquals(fake.calls, [
    "session.load",
    "activation.mount:7",
    "activation.unmount:7",
    "action.badge:!",
    "action.title:Point and Shoot — session could not start",
  ]);
});

Deno.test("session action restores the overlay and reports an end failure", async () => {
  const fake = createFakes(session(3));
  const controller = createSessionActionController(fake.browser, fake.activation, {
    ...fake.service,
    end: () => Promise.reject(new Error("IndexedDB unavailable.")),
  });

  await assertRejects(() => controller.toggle(7), Error, "IndexedDB unavailable.");

  assertEquals(fake.calls, [
    "session.load",
    "activation.unmount:7",
    "activation.mount:7",
    "action.badge:!",
    "action.title:Point and Shoot — session could not end",
  ]);
});
