import { assertEquals } from "@std/assert";
import type { Note } from "../shared/schema.ts";
import { NOTE_PREVIEW_MESSAGE } from "../shared/messages.ts";
import { createNotePreviewController } from "./note-preview.ts";

function note(elements = 1): Note {
  return {
    createdAt: "2026-07-31T06:00:00.000Z",
    elements: Array.from({ length: elements }, () => ({
      selectors: {
        cssPath: ["#save"],
        reachable: true as const,
        tagClasses: "button",
        testIds: [{ attribute: "data-testid" as const, value: "save" }],
        textSnippet: "Save",
        xpath: ["/html/body/button"],
      },
      styleDigest: null,
    })),
    id: "note-1",
    pageTitle: "Fixture",
    pageUrl: "https://example.com/editor?access_token=secret",
    region: {
      box: { height: 40, width: 80, x: 10, y: 20 },
      screenshot: "data:image/webp;base64,V0VCUA==",
      truncated: false,
      viewport: { height: 600, width: 800 },
    },
    text: "Save is hidden.",
  };
}

Deno.test("note preview controller emits ordered show, clear, and selector-free requests", () => {
  const messages: unknown[] = [];
  const controller = createNotePreviewController({
    sendMessage(message) {
      messages.push(message);
      return Promise.resolve();
    },
  });

  controller.show(note());
  controller.clear();
  controller.show(note(0));

  assertEquals(messages, [
    {
      action: "show",
      generation: 1,
      pageUrl: "https://example.com/editor?access_token=secret",
      selectors: [note().elements[0]?.selectors],
      stripQuery: true,
      type: NOTE_PREVIEW_MESSAGE,
    },
    { action: "clear", generation: 2, type: NOTE_PREVIEW_MESSAGE },
    { action: "clear", generation: 3, type: NOTE_PREVIEW_MESSAGE },
  ]);
});

Deno.test("note preview controller reports channel failures without throwing into the panel", async () => {
  const errors: unknown[] = [];
  const controller = createNotePreviewController(
    { sendMessage: () => Promise.reject(new Error("No active tab")) },
    (error) => errors.push(error),
  );

  controller.show(note());
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals((errors[0] as Error).message, "No active tab");
});
