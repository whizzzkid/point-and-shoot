/// <reference lib="dom" />

/**
 * Content-script entry point. Wave 3 injects the toolbar overlay and drag-box UI; this stub only
 * proves the content bundle loads on the page. Bundled as an IIFE — see build/build.ts — rather
 * than ESM, since MV3 content-script module support is verified in W2.9, not assumed here.
 *
 * The `data-point-and-shoot-content-ready` attribute is W2.9's deterministic boot signal: a
 * Playwright test can poll for it without sniffing for UI that doesn't exist yet.
 *
 * @module
 */

document.documentElement.dataset.pointAndShootContentReady = "true";
console.log("point-and-shoot: content script ready");
