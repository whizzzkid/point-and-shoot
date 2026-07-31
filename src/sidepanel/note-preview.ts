import type { BrowserShim } from "../shared/browser.ts";
import { NOTE_PREVIEW_MESSAGE, type NotePreviewRequest } from "../shared/messages.ts";
import type { Note } from "../shared/schema.ts";
import { shouldStripQueryByDefault } from "../shared/session.ts";

/** Note-preview operations consumed by the notes panel. */
export interface NotePreviewController {
  /** Clears any preview owned by this panel. */
  clear(): void;
  /**
   * Requests a preview for one note.
   *
   * @param note Captured note whose selectors and page identity should be previewed.
   */
  show(note: Note): void;
}

/** Runtime dependency required to route note previews through the background. */
export interface NotePreviewRuntime {
  sendMessage(message: NotePreviewRequest): Promise<unknown>;
}

/**
 * Creates a generation-ordered note-preview client for the side panel.
 *
 * @param runtime Extension runtime message channel.
 * @param reportError Receives channel failures without disrupting note review.
 * @returns A controller that emits show and clear requests in strict generation order.
 */
export function createNotePreviewController(
  runtime: NotePreviewRuntime,
  reportError: (error: unknown) => void = (error) => {
    console.error("point-and-shoot: note preview failed:", error);
  },
): NotePreviewController {
  let generation = 0;
  const send = (request: NotePreviewRequest): void => {
    void runtime.sendMessage(request).catch(reportError);
  };
  return {
    clear() {
      generation += 1;
      send({ action: "clear", generation, type: NOTE_PREVIEW_MESSAGE });
    },
    show(note) {
      generation += 1;
      const selectors = note.elements.map((element) => element.selectors);
      if (selectors.length === 0) {
        send({ action: "clear", generation, type: NOTE_PREVIEW_MESSAGE });
        return;
      }
      send({
        action: "show",
        generation,
        pageUrl: note.pageUrl,
        selectors,
        stripQuery: note.stripQuery ?? shouldStripQueryByDefault(note.pageUrl),
        type: NOTE_PREVIEW_MESSAGE,
      });
    },
  };
}

/** Browser-backed preview controller used by the shipped side panel. */
export function browserNotePreviewController(
  browser: Pick<BrowserShim, "runtime">,
): NotePreviewController {
  return createNotePreviewController(browser.runtime);
}
