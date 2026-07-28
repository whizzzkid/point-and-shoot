/**
 * Background entry point. Wave 3 wires up capture orchestration and message routing; this stub
 * only proves the background bundle loads and boots in both browsers.
 *
 * @module
 */

import { browser } from "../shared/browser.ts";

browser.commands.onCommand.addListener((command) => {
  console.log(`point-and-shoot: received command "${command}"`);
});
