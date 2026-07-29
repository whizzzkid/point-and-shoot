/// <reference lib="dom" />

import { assertEquals, assertRejects } from "@std/assert";
import type { RegionCapture } from "../shared/schema.ts";
import type { PickerSelection } from "./picker/ElementPicker.tsx";
import { NoteSaveError, saveCapturedSelection } from "./notes.ts";

const CAPTURE: RegionCapture = {
  box: { height: 40, width: 80, x: 10, y: 20 },
  screenshot: "data:image/webp;base64,V0VCUA==",
  truncated: false,
  viewport: { height: 600, width: 800 },
};

const REACHABLE_SELECTION: PickerSelection = {
  elements: [{
    element: {} as Element,
    primary: true,
    rect: { height: 40, left: 10, top: 20, width: 80 },
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
  kind: "elements",
  region: { height: 40, left: 10, top: 20, width: 80 },
};

Deno.test("saveCapturedSelection sends only serializable element evidence", async () => {
  let sent: unknown;
  const result = await saveCapturedSelection(
    {
      sendMessage(message) {
        sent = message;
        return Promise.resolve({
          noteCount: 1,
          noteId: "note-1",
          ok: true,
          sessionId: "session-1",
        });
      },
    },
    CAPTURE,
    REACHABLE_SELECTION,
    { title: "Checkout", url: "https://example.com/checkout" },
  );

  assertEquals(result.noteCount, 1);
  assertEquals(sent, {
    capture: CAPTURE,
    elements: [{
      selectors: REACHABLE_SELECTION.elements[0]?.selectors,
      styleDigest: null,
    }],
    pageTitle: "Checkout",
    pageUrl: "https://example.com/checkout",
    type: "point-and-shoot:add-note",
  });
});

Deno.test("saveCapturedSelection records an explicit cross-origin boundary", async () => {
  let sent: unknown;
  await saveCapturedSelection(
    {
      sendMessage(message) {
        sent = message;
        return Promise.resolve({
          noteCount: 2,
          noteId: "note-2",
          ok: true,
          sessionId: "session-1",
        });
      },
    },
    CAPTURE,
    {
      kind: "unreachable",
      reason: "cross-origin-iframe",
      region: { height: 200, left: 50, top: 100, width: 300 },
    },
    { title: "Frames", url: "https://example.com/frames" },
  );

  assertEquals((sent as { elements: unknown }).elements, [{
    selectors: {
      reachable: false,
      tagClasses: "iframe",
      testIds: [],
      textSnippet: "",
      unreachable: "cross-origin-iframe",
    },
    styleDigest: null,
  }]);
});

Deno.test("saveCapturedSelection translates storage and malformed replies", async () => {
  const denied = await assertRejects(
    () =>
      saveCapturedSelection(
        {
          sendMessage: () =>
            Promise.resolve({ error: { message: "Storage quota exceeded." }, ok: false }),
        },
        CAPTURE,
        REACHABLE_SELECTION,
        { title: "Checkout", url: "https://example.com/checkout" },
      ),
    NoteSaveError,
    "Storage quota exceeded",
  );
  assertEquals(denied.cause, undefined);

  await assertRejects(
    () =>
      saveCapturedSelection(
        { sendMessage: () => Promise.resolve({ ok: true }) },
        CAPTURE,
        REACHABLE_SELECTION,
        { title: "Checkout", url: "https://example.com/checkout" },
      ),
    NoteSaveError,
    "invalid",
  );

  const disconnected = await assertRejects(
    () =>
      saveCapturedSelection(
        { sendMessage: () => Promise.reject(new Error("service worker stopped")) },
        CAPTURE,
        REACHABLE_SELECTION,
        { title: "Checkout", url: "https://example.com/checkout" },
      ),
    NoteSaveError,
    "could not reach",
  );
  assertEquals((disconnected.cause as Error).message, "service worker stopped");
});
