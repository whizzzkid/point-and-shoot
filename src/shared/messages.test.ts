import { assertEquals } from "@std/assert";
import {
  ADD_NOTE_MESSAGE,
  CAPTURE_REGION_MESSAGE,
  FRAMEWORK_PROBE_MESSAGE,
  isActiveSessionSummary,
  isAddNoteRequest,
  isAddNoteResponse,
  isCaptureRegionRequest,
  isCaptureRegionResponse,
  isFrameworkProbeRequest,
  isFrameworkProbeResponse,
  isOverlayStateResponse,
  isToggleActiveTabResponse,
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

Deno.test("isAddNoteRequest accepts serializable evidence and rejects malformed elements", () => {
  const request = {
    capture: VALID_CAPTURE,
    elements: [{
      selectors: {
        cssPath: ["button"],
        reachable: true,
        tagClasses: "button.primary",
        testIds: [],
        textSnippet: "Save",
        xpath: ["//button"],
      },
      styleDigest: null,
    }],
    pageTitle: "Checkout",
    pageUrl: "https://example.com/checkout?access_token=secret",
    text: "The save button overlaps the total.",
    type: ADD_NOTE_MESSAGE,
  };
  const element = request.elements[0]!;
  assertEquals(isAddNoteRequest(request), true);
  assertEquals(
    isAddNoteRequest({
      ...request,
      elements: [{ ...element, element: { nodeType: 1 } }],
    }),
    false,
  );
  assertEquals(
    isAddNoteRequest({
      ...request,
      elements: [{
        ...element,
        componentHint: { framework: "jquery", name: "CheckoutButton" },
      }],
    }),
    false,
  );
  assertEquals(
    isAddNoteRequest({
      ...request,
      elements: [{ ...element, styleDigest: {} }],
    }),
    false,
  );
  assertEquals(
    isAddNoteRequest({
      ...request,
      elements: [{
        ...element,
        selectors: {
          ...element.selectors,
          ariaRoleName: { name: 12, role: "button" },
        },
      }],
    }),
    false,
  );
  assertEquals(isAddNoteRequest({ ...request, pageUrl: undefined }), false);
  assertEquals(isAddNoteRequest({ ...request, text: undefined }), false);
  assertEquals(
    isAddNoteRequest({
      ...request,
      capture: {
        ...request.capture,
        viewport: { ...request.capture.viewport, width: -1 },
      },
    }),
    false,
  );
});

Deno.test("isAddNoteResponse accepts durable results and typed errors", () => {
  assertEquals(
    isAddNoteResponse({
      noteCount: 2,
      noteId: "note-2",
      ok: true,
      sessionId: "session-1",
    }),
    true,
  );
  assertEquals(
    isAddNoteResponse({ error: { message: "Storage quota exceeded." }, ok: false }),
    true,
  );
  assertEquals(
    isAddNoteResponse({
      noteCount: Number.NaN,
      noteId: "note-2",
      ok: true,
      sessionId: "session-1",
    }),
    false,
  );
});

Deno.test("active session summaries accept only exact inactive and counted active states", () => {
  assertEquals(isActiveSessionSummary({ active: false }), true);
  assertEquals(
    isActiveSessionSummary({ active: true, noteCount: 2, sessionId: "session-1" }),
    true,
  );
  assertEquals(isActiveSessionSummary({ active: false, noteCount: 0 }), false);
  assertEquals(
    isActiveSessionSummary({ active: true, noteCount: -1, sessionId: "session-1" }),
    false,
  );
});

Deno.test("overlay response guards accept exact success and failure shapes", () => {
  assertEquals(isOverlayStateResponse({ mounted: true }), true);
  assertEquals(isOverlayStateResponse({ mounted: false, extra: true }), false);
  assertEquals(
    isToggleActiveTabResponse({ mounted: true, ok: true, result: "injected" }),
    true,
  );
  assertEquals(
    isToggleActiveTabResponse({ error: { message: "Unavailable" }, ok: false }),
    true,
  );
  assertEquals(
    isToggleActiveTabResponse({ mounted: "yes", ok: true, result: "toggled" }),
    false,
  );
});

Deno.test("framework probe guards preserve aligned optional source metadata", () => {
  const request = {
    cssPaths: [["#checkout"], ["#summary", "button"]],
    type: FRAMEWORK_PROBE_MESSAGE,
  };
  const response = {
    hints: [
      {
        file: "/workspace/src/CheckoutButton.tsx",
        framework: "react",
        line: 17,
        name: "CheckoutButton",
      },
      null,
    ],
  };

  assertEquals(isFrameworkProbeRequest(request), true);
  assertEquals(isFrameworkProbeResponse(response, 2), true);
  assertEquals(isFrameworkProbeRequest({ ...request, cssPaths: [] }), false);
  assertEquals(
    isFrameworkProbeRequest({ ...request, cssPaths: Array.from({ length: 26 }, () => ["main"]) }),
    false,
  );
  assertEquals(
    isFrameworkProbeResponse({
      hints: [{ ...response.hints[0], line: 0 }],
    }, 1),
    false,
  );
  assertEquals(
    isFrameworkProbeResponse({
      hints: [{ framework: "react", name: "x".repeat(1_025) }],
    }, 1),
    false,
  );
  assertEquals(isFrameworkProbeResponse({ hints: [null] }, 2), false);
});
