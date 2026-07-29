import { assertEquals } from "@std/assert";
import {
  CAPTURE_REGION_MESSAGE,
  isCaptureRegionRequest,
  isCaptureRegionResponse,
} from "./messages.ts";

const VALID_REQUEST = {
  devicePixelRatio: 2,
  region: { height: 200, width: 300, x: 100, y: 50 },
  type: CAPTURE_REGION_MESSAGE,
  viewport: { height: 600, width: 800 },
};

const VALID_CAPTURE = {
  box: VALID_REQUEST.region,
  screenshot: "data:image/webp;base64,V0VCUA==",
  truncated: false,
  viewport: VALID_REQUEST.viewport,
};

Deno.test("capture message guards accept valid requests and both response variants", () => {
  assertEquals(isCaptureRegionRequest(VALID_REQUEST), true);
  assertEquals(isCaptureRegionResponse({ capture: VALID_CAPTURE, ok: true }), true);
  assertEquals(
    isCaptureRegionResponse({
      error: { code: "permission-denied", message: "Active-tab access is required." },
      ok: false,
    }),
    true,
  );
});

Deno.test("capture message guards reject malformed and non-finite geometry", () => {
  assertEquals(
    isCaptureRegionRequest({
      ...VALID_REQUEST,
      region: { ...VALID_REQUEST.region, width: Number.NaN },
    }),
    false,
  );
  assertEquals(
    isCaptureRegionResponse({
      capture: {
        ...VALID_CAPTURE,
        screenshot: "data:image/png;base64,UE5H",
      },
      ok: true,
    }),
    false,
  );
  assertEquals(
    isCaptureRegionResponse({
      capture: {
        ...VALID_CAPTURE,
        viewport: { height: Number.POSITIVE_INFINITY, width: 800 },
      },
      ok: true,
    }),
    false,
  );
  assertEquals(
    isCaptureRegionResponse({
      error: { code: "unknown", message: "No typed reason." },
      ok: false,
    }),
    false,
  );
  assertEquals(isCaptureRegionResponse(undefined), false);
});
