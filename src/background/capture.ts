/// <reference lib="webworker" />

import type { RegionCapture } from "../shared/schema.ts";
import type { BrowserShim, CaptureOptions } from "../shared/browser.ts";
import { type CaptureRegionResponse, isCaptureRegionRequest } from "../shared/messages.ts";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type ScreenshotMaxDimension,
  type ScreenshotQuality,
} from "../shared/settings.ts";

/** CSS-pixel rectangle requested by the content script. */
export interface CaptureRegionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Geometry sent from the inspected page for one visible-tab crop. */
export interface CaptureRegionInput {
  readonly devicePixelRatio: number;
  readonly region: CaptureRegionRect;
  readonly viewport: { readonly width: number; readonly height: number };
}

/** WebP encoder settings selected in the options page. */
export interface CaptureEncodingSettings {
  readonly maximumDimension: ScreenshotMaxDimension;
  readonly quality: ScreenshotQuality;
}

/** Minimal visible-tab method consumed by {@link captureRegion}. */
export interface CaptureBrowser {
  captureVisibleTab(options?: CaptureOptions): Promise<string>;
}

/** Decoded image used by the cross-browser crop runtime. */
export interface CaptureBitmap {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** Draw operations used by {@link CaptureCanvas}. */
export interface CaptureCanvasContext {
  drawImage(
    bitmap: CaptureBitmap,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ): void;
}

/** Offscreen encoding surface used by the capture pipeline. */
export interface CaptureCanvas {
  getContext(): CaptureCanvasContext | null;
  convertToBlob(options: { readonly type: string; readonly quality: number }): Promise<Blob>;
}

/** Injectable image primitives; production uses `createImageBitmap` and `OffscreenCanvas`. */
export interface CaptureImageRuntime {
  decode(dataUrl: string): Promise<CaptureBitmap>;
  createCanvas(width: number, height: number): CaptureCanvas;
  toDataUrl(blob: Blob): Promise<string>;
}

/**
 * A visible-tab capture rejected before image processing, usually because `activeTab` is absent.
 */
export class CapturePermissionError extends Error {
  constructor(cause: unknown) {
    super("Capture needs an active-tab permission granted by a toolbar or keyboard gesture.");
    this.name = "CapturePermissionError";
    this.cause = cause;
  }
}

/** The browser returned an image that could not be cropped or encoded. */
export class CaptureProcessingError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CaptureProcessingError";
    this.cause = cause;
  }
}

interface CapturePlan {
  readonly box: CaptureRegionRect;
  readonly source: CaptureRegionRect;
  readonly truncated: boolean;
}

function validateFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
}

function capturePlan(input: CaptureRegionInput): CapturePlan {
  const values: readonly [string, number][] = [
    ["devicePixelRatio", input.devicePixelRatio],
    ["region.x", input.region.x],
    ["region.y", input.region.y],
    ["region.width", input.region.width],
    ["region.height", input.region.height],
    ["viewport.width", input.viewport.width],
    ["viewport.height", input.viewport.height],
  ];
  for (const [label, value] of values) validateFinite(label, value);
  if (
    input.devicePixelRatio <= 0 ||
    input.region.width <= 0 ||
    input.region.height <= 0 ||
    input.viewport.width <= 0 ||
    input.viewport.height <= 0
  ) {
    throw new RangeError("capture dimensions and devicePixelRatio must be positive");
  }

  const left = Math.max(0, input.region.x);
  const top = Math.max(0, input.region.y);
  const right = Math.min(input.viewport.width, input.region.x + input.region.width);
  const bottom = Math.min(input.viewport.height, input.region.y + input.region.height);
  if (right <= left || bottom <= top) {
    throw new RangeError("capture region must intersect the visible viewport");
  }
  const box = { height: bottom - top, width: right - left, x: left, y: top };
  return {
    box,
    source: {
      height: Math.ceil(bottom * input.devicePixelRatio) -
        Math.floor(top * input.devicePixelRatio),
      width: Math.ceil(right * input.devicePixelRatio) -
        Math.floor(left * input.devicePixelRatio),
      x: Math.floor(left * input.devicePixelRatio),
      y: Math.floor(top * input.devicePixelRatio),
    },
    truncated: box.x !== input.region.x ||
      box.y !== input.region.y ||
      box.width !== input.region.width ||
      box.height !== input.region.height,
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 32_768;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    let binary = "";
    for (const byte of bytes.subarray(offset, offset + chunkSize)) {
      binary += String.fromCharCode(byte);
    }
    chunks.push(binary);
  }
  return `data:${blob.type};base64,${btoa(chunks.join(""))}`;
}

const webImageRuntime: CaptureImageRuntime = {
  async decode(dataUrl) {
    const response = await fetch(dataUrl);
    return await createImageBitmap(await response.blob());
  },
  createCanvas(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    return {
      convertToBlob: (options) => canvas.convertToBlob(options),
      getContext() {
        const context = canvas.getContext("2d");
        return context === null ? null : {
          drawImage(
            bitmap,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            destinationX,
            destinationY,
            destinationWidth,
            destinationHeight,
          ) {
            context.drawImage(
              bitmap as ImageBitmap,
              sourceX,
              sourceY,
              sourceWidth,
              sourceHeight,
              destinationX,
              destinationY,
              destinationWidth,
              destinationHeight,
            );
          },
        };
      },
    };
  },
  toDataUrl: blobToDataUrl,
};

/**
 * Captures, crops, scales, and WebP-encodes one visible viewport region.
 *
 * @param browser Promise-based visible-tab capture seam.
 * @param input CSS geometry and device-pixel ratio measured by the content script.
 * @param imageRuntime Image primitives; tests inject fakes.
 * @param encoding Persisted WebP quality and longest-edge limit.
 * @returns The canonical region record stored with a note.
 * @throws {@link CapturePermissionError} when visible-tab capture is unavailable.
 * @throws {TypeError|RangeError|CaptureProcessingError} for invalid geometry or image processing.
 */
export async function captureRegion(
  browser: CaptureBrowser,
  input: CaptureRegionInput,
  imageRuntime: CaptureImageRuntime = webImageRuntime,
  encoding: CaptureEncodingSettings = {
    maximumDimension: DEFAULT_SETTINGS.screenshotMaxDimension,
    quality: DEFAULT_SETTINGS.screenshotQuality,
  },
): Promise<RegionCapture> {
  const plan = capturePlan(input);
  let dataUrl: string;
  try {
    dataUrl = await browser.captureVisibleTab({ format: "png" });
  } catch (error) {
    throw new CapturePermissionError(error);
  }

  let bitmap: CaptureBitmap;
  try {
    bitmap = await imageRuntime.decode(dataUrl);
  } catch (cause) {
    throw new CaptureProcessingError("The visible-tab screenshot could not be decoded.", cause);
  }
  try {
    const sourceWidth = Math.min(plan.source.width, bitmap.width - plan.source.x);
    const sourceHeight = Math.min(plan.source.height, bitmap.height - plan.source.y);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new CaptureProcessingError("Captured bitmap does not contain the requested region.");
    }
    const scale = Math.min(
      1,
      encoding.maximumDimension / Math.max(sourceWidth, sourceHeight),
    );
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
    const bitmapTruncated = sourceWidth !== plan.source.width ||
      sourceHeight !== plan.source.height;
    const canvas = imageRuntime.createCanvas(outputWidth, outputHeight);
    const context = canvas.getContext();
    if (context === null) {
      throw new CaptureProcessingError("OffscreenCanvas has no 2D rendering context.");
    }
    context.drawImage(
      bitmap,
      plan.source.x,
      plan.source.y,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    const blob = await canvas.convertToBlob({
      quality: encoding.quality,
      type: "image/webp",
    });
    if (blob.type !== "image/webp" || blob.size === 0) {
      throw new CaptureProcessingError("OffscreenCanvas returned an invalid WebP image.");
    }
    return {
      box: plan.box,
      screenshot: await imageRuntime.toDataUrl(blob),
      truncated: plan.truncated || bitmapTruncated || scale < 1,
      viewport: input.viewport,
    };
  } catch (error) {
    if (error instanceof CaptureProcessingError) throw error;
    throw new CaptureProcessingError("The screenshot could not be cropped or encoded.", error);
  } finally {
    bitmap.close();
  }
}

function captureErrorResponse(error: unknown): CaptureRegionResponse {
  if (error instanceof CapturePermissionError) {
    return {
      error: { code: "permission-denied", message: error.message },
      ok: false,
    };
  }
  if (error instanceof TypeError || error instanceof RangeError) {
    return {
      error: { code: "invalid-region", message: error.message },
      ok: false,
    };
  }
  return {
    error: {
      code: "processing-failed",
      message: error instanceof Error ? error.message : "Screenshot processing failed.",
    },
    ok: false,
  };
}

/**
 * Registers the background request handler for content-script region captures.
 *
 * @param extensionBrowser Browser shim used for messaging and visible-tab capture.
 * @param imageRuntime Image primitives; tests inject fakes.
 */
export function registerCaptureHandler(
  extensionBrowser: BrowserShim,
  imageRuntime: CaptureImageRuntime = webImageRuntime,
): void {
  extensionBrowser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCaptureRegionRequest(message)) return;
    const input: CaptureRegionInput = {
      devicePixelRatio: message.devicePixelRatio,
      region: message.region,
      viewport: message.viewport,
    };
    void loadSettings(extensionBrowser.storage.local)
      .then((settings) =>
        captureRegion(extensionBrowser.tabs, input, imageRuntime, {
          maximumDimension: settings.screenshotMaxDimension,
          quality: settings.screenshotQuality,
        })
      )
      .then((capture) => sendResponse({ capture, ok: true } satisfies CaptureRegionResponse))
      .catch((error: unknown) => sendResponse(captureErrorResponse(error)));
    return true;
  });
}
