import { assertEquals } from "@std/assert";
import { NOTE_PREVIEW_MESSAGE, type NotePreviewRequest } from "../shared/messages.ts";
import { createLazyNotePreviewLayer, type NotePreviewLayer } from "./note-preview.ts";

const CLEAR = (generation: number): NotePreviewRequest => ({
  action: "clear",
  generation,
  type: NOTE_PREVIEW_MESSAGE,
});

const SHOW = (generation: number): NotePreviewRequest => ({
  action: "show",
  generation,
  pageUrl: "https://example.com/page",
  selectors: [],
  stripQuery: false,
  type: NOTE_PREVIEW_MESSAGE,
});

Deno.test("lazy note preview avoids page work until the first current show request", () => {
  const handled: NotePreviewRequest[] = [];
  let creations = 0;
  let destroys = 0;
  const inner: NotePreviewLayer = {
    destroy() {
      destroys += 1;
    },
    handle(request) {
      handled.push(request);
      return true;
    },
  };
  const preview = createLazyNotePreviewLayer(() => {
    creations += 1;
    return inner;
  });

  assertEquals(preview.handle(CLEAR(2)), false);
  assertEquals(preview.handle(SHOW(1)), false);
  assertEquals(creations, 0);
  assertEquals(preview.handle(SHOW(3)), true);
  assertEquals(preview.handle(CLEAR(4)), true);
  preview.destroy();

  assertEquals(creations, 1);
  assertEquals(handled, [SHOW(3), CLEAR(4)]);
  assertEquals(destroys, 1);
});
