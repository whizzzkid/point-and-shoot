/** Background entry point for gesture-driven overlay activation. */

import { registerActivationHandlers } from "./activation.ts";
import { browser } from "../shared/browser.ts";
import { registerCaptureHandler } from "./capture.ts";

/**
 * Boot marker. `scripts/boot-firefox.ts` greps this out of Firefox's own stdout: with no static
 * content-script registration there is nothing that runs on a page by itself, so the background
 * booting is what "the extension loaded" now means for that check.
 */
console.log("point-and-shoot: background ready");

registerActivationHandlers(browser);
registerCaptureHandler(browser);
