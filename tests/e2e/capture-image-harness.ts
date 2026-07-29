/// <reference lib="dom" />

import { captureRegion, type CaptureRegionInput } from "../../src/background/capture.ts";

interface CaptureImageInspection {
  readonly box: CaptureRegionInput["region"];
  readonly byteLength: number;
  readonly height: number;
  readonly mediaType: string;
  readonly screenshotPrefix: string;
  readonly truncated: boolean;
  readonly viewport: CaptureRegionInput["viewport"];
  readonly width: number;
}

const harness = {
  async inspect(screenshot: string, input: CaptureRegionInput): Promise<CaptureImageInspection> {
    const capture = await captureRegion(
      { captureVisibleTab: () => Promise.resolve(screenshot) },
      input,
    );
    const response = await fetch(capture.screenshot);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      return {
        box: capture.box,
        byteLength: blob.size,
        height: bitmap.height,
        mediaType: blob.type,
        screenshotPrefix: capture.screenshot.slice(0, 23),
        truncated: capture.truncated,
        viewport: capture.viewport,
        width: bitmap.width,
      };
    } finally {
      bitmap.close();
    }
  },
};

(globalThis as unknown as { pointShootCaptureImageTest: typeof harness })
  .pointShootCaptureImageTest = harness;
