/** Background entry point for gesture-driven overlay activation. */

import { createActivationController, registerActivationHandlers } from "./activation.ts";
import { browser } from "../shared/browser.ts";
import { registerCaptureHandler } from "./capture.ts";
import { registerFrameworkProbeHandler } from "./framework-probe.ts";
import { registerNoteHandler } from "./notes.ts";
import { registerNotePreviewHandler } from "./note-preview.ts";
import {
  createSessionActionController,
  registerSessionActionHandler,
  registerSessionStateHandlers,
} from "./session-action.ts";
import { createSessionService } from "./session.ts";

/**
 * Boot marker. `scripts/boot-firefox.ts` greps this out of Firefox's own stdout: with no static
 * content-script registration there is nothing that runs on a page by itself, so the background
 * booting is what "the extension loaded" now means for that check.
 */
console.log("point-and-shoot: background ready");

const sessions = createSessionService(browser.storage.local);
const activation = createActivationController(browser);
const sessionAction = createSessionActionController(browser, activation, sessions);

registerSessionActionHandler(browser, sessionAction);
registerSessionStateHandlers(browser, sessionAction);
registerActivationHandlers(
  browser,
  (error) => {
    console.error("point-and-shoot: activation failed:", error);
  },
  activation,
  () => sessionAction.synchronize(),
);
registerCaptureHandler(browser);
registerFrameworkProbeHandler(browser);
registerNoteHandler(browser, sessions);
registerNotePreviewHandler(browser);
