/**
 * Local development server for the component gallery.
 *
 * @module
 */

import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { preactResolverPlugin } from "../../../build/preact.ts";

const ROOT = new URL("../../../", import.meta.url);
const GALLERY_ENTRY = new URL("src/ui/gallery/index.tsx", ROOT);
const TOKENS_CSS = new URL("src/shared/design/tokens.css", ROOT);
const COMPONENTS_CSS = new URL("src/ui/components/components.css", ROOT);
const GALLERY_CSS = new URL("src/ui/gallery/gallery.css", ROOT);
const ICONS_SVG = new URL("src/shared/design/icons.svg", ROOT);
const FONTS_DIR = new URL("src/shared/design/fonts/", ROOT);
const CAPTURE_SCREENSHOT = new URL("docs/assets/wave-1/dark.png", ROOT);

const GALLERY_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Point and Shoot component gallery</title>
    <link rel="icon" href="data:,">
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
    <link rel="stylesheet" href="/gallery.css">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/gallery.js"></script>
  </body>
</html>
`;

async function bundleGallery(): Promise<string> {
  try {
    const result = await esbuild.build({
      entryPoints: [fromFileUrl(GALLERY_ENTRY)],
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      format: "esm",
      target: ["chrome116", "firefox109"],
      jsx: "automatic",
      jsxImportSource: "preact",
      write: false,
      plugins: [preactResolverPlugin],
    });
    const output = result.outputFiles?.[0];
    if (output === undefined) throw new Error("gallery: esbuild emitted no JavaScript");
    return output.text;
  } finally {
    await esbuild.stop();
  }
}

/** A running gallery server and its browser-facing URL. */
export interface GalleryServer {
  /** Base URL with no trailing slash. */
  readonly url: string;
  /** Stops the HTTP listener and resolves after it has closed. */
  close(): Promise<void>;
}

/**
 * Starts the component gallery on an OS-assigned loopback port.
 *
 * @returns The running server and its browser-facing URL.
 */
export async function startGalleryServer(): Promise<GalleryServer> {
  const [
    galleryJavaScript,
    tokensCss,
    componentsCss,
    galleryCss,
    iconsSvg,
    captureScreenshot,
  ] = await Promise.all([
    bundleGallery(),
    Deno.readTextFile(TOKENS_CSS),
    Deno.readTextFile(COMPONENTS_CSS),
    Deno.readTextFile(GALLERY_CSS),
    Deno.readTextFile(ICONS_SVG),
    Deno.readFile(CAPTURE_SCREENSHOT),
  ]);
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    async (request) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/" || pathname === "/index.html") {
        return new Response(GALLERY_HTML, {
          headers: {
            "cache-control": "no-store",
            "content-type": "text/html; charset=utf-8",
          },
        });
      }
      if (pathname === "/favicon.ico") {
        return new Response(null, { status: 204 });
      }
      if (pathname === "/gallery.js") {
        return new Response(galleryJavaScript, {
          headers: { "content-type": "text/javascript; charset=utf-8" },
        });
      }
      if (pathname === "/tokens.css") {
        return new Response(tokensCss, { headers: { "content-type": "text/css; charset=utf-8" } });
      }
      if (pathname === "/components.css") {
        return new Response(componentsCss, {
          headers: { "content-type": "text/css; charset=utf-8" },
        });
      }
      if (pathname === "/gallery.css") {
        return new Response(galleryCss, {
          headers: { "content-type": "text/css; charset=utf-8" },
        });
      }
      if (pathname === "/src/shared/design/icons.svg") {
        return new Response(iconsSvg, {
          headers: { "content-type": "image/svg+xml; charset=utf-8" },
        });
      }
      if (pathname === "/gallery-capture.png") {
        return new Response(captureScreenshot.buffer, {
          headers: { "content-type": "image/png" },
        });
      }
      if (pathname.startsWith("/fonts/")) {
        const fileName = pathname.slice("/fonts/".length);
        if (!/^[a-z0-9-]+\.woff2$/.test(fileName)) {
          return new Response("Not found\n", { status: 404 });
        }
        try {
          return new Response((await Deno.readFile(new URL(fileName, FONTS_DIR))).buffer, {
            headers: { "content-type": "font/woff2" },
          });
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) {
            return new Response("Not found\n", { status: 404 });
          }
          throw error;
        }
      }
      return new Response("Not found\n", { status: 404 });
    },
  );

  return {
    url: `http://127.0.0.1:${server.addr.port}`,
    async close(): Promise<void> {
      await server.shutdown();
    },
  };
}

if (import.meta.main) {
  const gallery = await startGalleryServer();
  console.log(`component gallery: ${gallery.url}`);
  await new Promise<void>(() => {});
}
