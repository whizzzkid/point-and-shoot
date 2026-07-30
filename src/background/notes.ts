import type { BrowserShim } from "../shared/browser.ts";
import {
  type AddNoteResponse,
  isAddNoteRequest,
  OPEN_NOTES_PANEL_MESSAGE,
} from "../shared/messages.ts";
import {
  createSessionService,
  type SessionService,
  type SessionServiceDependencies,
} from "./session.ts";

/** Captured-note capability consumed by the runtime message handler. */
export type CapturedNoteService = Pick<SessionService, "append">;

/**
 * Creates the serialized captured-note service.
 *
 * @param storage Extension-local session pointers.
 * @param dependencies Clock, identifier, and database seams.
 * @returns A captured-note capability backed by the shared session service.
 */
export function createCapturedNoteService(
  storage: BrowserShim["storage"]["local"],
  dependencies?: SessionServiceDependencies,
): CapturedNoteService {
  return dependencies === undefined
    ? createSessionService(storage)
    : createSessionService(storage, dependencies);
}

/**
 * Registers the runtime handler that persists captured notes.
 *
 * @param extensionBrowser Browser shim supplying the message channel.
 * @param service Serialized captured-note service.
 * @param onSaved Refreshes browser action and extension-page state after a successful write.
 */
export function registerNoteHandler(
  extensionBrowser: BrowserShim,
  service: CapturedNoteService = createCapturedNoteService(extensionBrowser.storage.local),
  onSaved: () => Promise<void> = () => Promise.resolve(),
): void {
  extensionBrowser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === OPEN_NOTES_PANEL_MESSAGE) {
      void extensionBrowser.openPanel(sender.tab?.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) =>
          sendResponse({
            error: {
              message: error instanceof Error ? error.message : "The notes panel could not open.",
            },
            ok: false,
          })
        );
      return true;
    }
    if (!isAddNoteRequest(message)) return;
    void service.append(message)
      .then((result) => {
        sendResponse({ ...result, ok: true } satisfies AddNoteResponse);
        void onSaved().catch((error: unknown) => {
          console.error("point-and-shoot: note action state could not refresh:", error);
        });
      })
      .catch((error: unknown) =>
        sendResponse(
          {
            error: {
              message: error instanceof Error ? error.message : "The note could not be saved.",
            },
            ok: false,
          } satisfies AddNoteResponse,
        )
      );
    return true;
  });
}
