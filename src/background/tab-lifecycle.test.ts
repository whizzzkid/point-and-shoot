/// <reference lib="dom" />

import { assertEquals } from "@std/assert";
import type { Session } from "../shared/schema.ts";
import type { SessionService } from "./session.ts";
import type { TabChangeInfo, TabInfo, TabUpdatedListener } from "../shared/browser.ts";
import { registerTabLifecycleHandler } from "./tab-lifecycle.ts";

const BASE_SESSION: Session = {
  createdAt: "2026-08-14T00:00:00.000Z",
  domain: "example.com",
  endedAt: null,
  id: "session-tab",
  name: "Tab lifecycle",
  notes: [],
  schemaVersion: 2,
};

function makeFakes(active: Session | null): {
  readonly fire: (id: number, change: TabChangeInfo) => Promise<void>;
  readonly calls: string[];
} {
  const calls: string[] = [];
  let listener: TabUpdatedListener | undefined;
  const browser = {
    tabs: {
      onUpdated: {
        addListener(next: TabUpdatedListener) {
          listener = next;
        },
      },
    },
  };
  const sessions: Pick<SessionService, "loadActive"> = {
    loadActive() {
      calls.push("session.load");
      return Promise.resolve(active);
    },
  };
  const synchronize = () => {
    calls.push("synchronize");
    return Promise.resolve();
  };
  registerTabLifecycleHandler(browser, sessions, synchronize);
  return {
    calls,
    async fire(id: number, change: TabChangeInfo) {
      const tab: TabInfo = { id };
      listener?.(id, change, tab);
      // Drain the microtask queue so the listener's inner async block completes before we assert.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
  };
}

Deno.test(
  "tab lifecycle synchronizes the action badge when a running session's tab completes navigation",
  async () => {
    const fake = makeFakes(BASE_SESSION);
    await fake.fire(42, { status: "complete" });
    assertEquals(fake.calls, ["session.load", "synchronize"]);
  },
);

Deno.test("tab lifecycle ignores 'loading' status changes", async () => {
  const fake = makeFakes(BASE_SESSION);
  await fake.fire(42, { status: "loading" });
  assertEquals(fake.calls, []);
});

Deno.test("tab lifecycle does not sync when the active session is paused", async () => {
  const fake = makeFakes({ ...BASE_SESSION, pausedAt: "2026-08-14T00:01:00.000Z" });
  await fake.fire(42, { status: "complete" });
  assertEquals(fake.calls, ["session.load"]);
});

Deno.test("tab lifecycle does not sync when there is no active session", async () => {
  const fake = makeFakes(null);
  await fake.fire(42, { status: "complete" });
  assertEquals(fake.calls, ["session.load"]);
});
