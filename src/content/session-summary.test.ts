import { assertEquals } from "@std/assert";
import type { StorageChangedListener } from "../shared/browser.ts";
import { SESSION_REVISION_STORAGE_KEY } from "../shared/session.ts";
import { watchSessionSummary } from "./session-summary.ts";

Deno.test("session summary watcher loads, refreshes on local revisions, and stops", async () => {
  const listeners = new Set<StorageChangedListener>();
  let noteCount = 1;
  const observed: number[] = [];
  const stop = watchSessionSummary(
    {
      runtime: {
        sendMessage: () => Promise.resolve({ active: true, noteCount, sessionId: "session-1" }),
      },
      storage: {
        onChanged: {
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
        },
      },
    },
    (summary) => observed.push(summary.active ? summary.noteCount : 0),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  noteCount = 0;
  for (const listener of listeners) {
    listener({ [SESSION_REVISION_STORAGE_KEY]: { newValue: 2 } }, "local");
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (const listener of listeners) {
    listener({ [SESSION_REVISION_STORAGE_KEY]: { newValue: 3 } }, "sync");
  }
  stop();
  noteCount = 4;
  for (const listener of listeners) {
    listener({ [SESSION_REVISION_STORAGE_KEY]: { newValue: 4 } }, "local");
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(observed, [1, 0]);
});

Deno.test("session summary watcher rejects malformed background replies", async () => {
  const errors: unknown[] = [];
  watchSessionSummary(
    {
      runtime: { sendMessage: () => Promise.resolve({ active: true, noteCount: -1 }) },
      storage: {
        onChanged: {
          addListener: () => undefined,
          removeListener: () => undefined,
        },
      },
    },
    () => undefined,
    (error) => errors.push(error),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(
    (errors[0] as Error).message,
    "The background returned an invalid active-session summary.",
  );
});
