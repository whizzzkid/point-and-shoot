/// <reference lib="dom" />

/**
 * Content-script entry point. Wave 3 injects the toolbar overlay and drag-box UI; this stub only
 * proves the content bundle loads on the page. Bundled as an IIFE — see build/build.ts — rather
 * than ESM, since MV3 content-script module support is verified in W2.9, not assumed here.
 *
 * Injected on a user gesture by `src/background/index.ts`, never registered in the manifest
 * (ADR-0002), so it must tolerate running on a page that finished loading long ago and being
 * injected more than once — a second gesture on the same tab re-runs this file top to bottom.
 *
 * The `data-point-and-shoot-content-ready` attribute is W2.9's deterministic boot signal: a
 * Playwright test can poll for it without sniffing for UI that doesn't exist yet.
 *
 * @module
 */

if (document.documentElement.dataset.pointAndShootContentReady === "true") {
  console.log("point-and-shoot: content script already present, skipping re-init");
} else {
  document.documentElement.dataset.pointAndShootContentReady = "true";
  console.log("point-and-shoot: content script ready");
}
