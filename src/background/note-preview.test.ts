import { assertEquals } from "@std/assert";
import type { MessageListener, TabInfo } from "../shared/browser.ts";
import { NOTE_PREVIEW_MESSAGE, type NotePreviewRequest } from "../shared/messages.ts";
import { registerNotePreviewHandler } from "./note-preview.ts";

const SELECTORS = {
  cssPath: ["#save"],
  reachable: true as const,
  tagClasses: "button",
  testIds: [],
  textSnippet: "Save",
  xpath: ["/html/body/button"],
};

function setup(tab: TabInfo | undefined): {
  readonly sent: { readonly message: unknown; readonly tabId: number }[];
  request(message: NotePreviewRequest): Promise<unknown>;
} {
  let listener: MessageListener | undefined;
  const sent: { message: unknown; tabId: number }[] = [];
  registerNotePreviewHandler({
    runtime: {
      onMessage: {
        addListener(next) {
          listener = next;
        },
      },
    },
    tabs: {
      query: () => Promise.resolve(tab === undefined ? [] : [tab]),
      sendMessage(tabId, message) {
        sent.push({ message, tabId });
        return Promise.resolve({ shown: true });
      },
    },
  });
  return {
    request(message) {
      return new Promise((resolve) => listener?.(message, {}, resolve));
    },
    sent,
  };
}

Deno.test("note preview routing validates query-projected page identity", async () => {
  const fake = setup({ id: 7, url: "https://example.com/editor?access_token=current#section" });
  const request: NotePreviewRequest = {
    action: "show",
    generation: 4,
    pageUrl: "https://example.com/editor?access_token=recorded",
    selectors: [SELECTORS],
    stripQuery: true,
    type: NOTE_PREVIEW_MESSAGE,
  };

  assertEquals(await fake.request(request), { shown: true });
  assertEquals(fake.sent, [{ message: request, tabId: 7 }]);
});

Deno.test("note preview routing clears a mismatched page and handles a missing tab", async () => {
  const mismatch = setup({ id: 8, url: "https://example.com/pricing" });
  assertEquals(
    await mismatch.request({
      action: "show",
      generation: 5,
      pageUrl: "https://example.com/editor",
      selectors: [SELECTORS],
      stripQuery: false,
      type: NOTE_PREVIEW_MESSAGE,
    }),
    { shown: false },
  );
  assertEquals(mismatch.sent, [{
    message: { action: "clear", generation: 5, type: NOTE_PREVIEW_MESSAGE },
    tabId: 8,
  }]);

  const missing = setup(undefined);
  assertEquals(
    await missing.request({ action: "clear", generation: 6, type: NOTE_PREVIEW_MESSAGE }),
    { shown: false },
  );
  assertEquals(missing.sent, []);
});
