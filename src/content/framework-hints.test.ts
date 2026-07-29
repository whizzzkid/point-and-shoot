import { assertEquals, assertStrictEquals } from "@std/assert";
import { FRAMEWORK_PROBE_MESSAGE } from "../shared/messages.ts";
import type { PickerSelection } from "./picker/ElementPicker.tsx";
import { addFrameworkComponentHints, type FrameworkProbeRuntime } from "./framework-hints.ts";

const SELECTION: PickerSelection = {
  elements: [
    {
      element: {} as Element,
      primary: true,
      rect: { height: 20, left: 10, top: 10, width: 80 },
      selectors: {
        cssPath: ["#checkout"],
        reachable: true,
        tagClasses: "button",
        testIds: [],
        textSnippet: "Checkout",
        xpath: ["//button"],
      },
      styleDigest: null,
    },
    {
      element: {} as Element,
      primary: false,
      rect: { height: 20, left: 10, top: 40, width: 80 },
      selectors: {
        reachable: false,
        tagClasses: "button",
        testIds: [],
        textSnippet: "Closed",
        unreachable: "closed-shadow-root",
      },
      styleDigest: null,
    },
  ],
  kind: "elements",
  region: { height: 50, left: 10, top: 10, width: 80 },
};

Deno.test("component hint enrichment is a no-op until the setting is enabled", async () => {
  let calls = 0;
  const runtime: FrameworkProbeRuntime = {
    sendMessage() {
      calls++;
      return Promise.resolve({ hints: [null] });
    },
  };

  const result = await addFrameworkComponentHints(runtime, SELECTION, false);

  assertStrictEquals(result, SELECTION);
  assertEquals(calls, 0);
});

Deno.test("component hint enrichment probes reachable paths and preserves live picker evidence", async () => {
  let sent: unknown;
  const result = await addFrameworkComponentHints(
    {
      sendMessage(message) {
        sent = message;
        return Promise.resolve({
          hints: [{
            file: "/workspace/src/CheckoutButton.tsx",
            framework: "react",
            line: 17,
            name: "CheckoutButton",
          }],
        });
      },
    },
    SELECTION,
    true,
  );

  assertEquals(sent, {
    cssPaths: [["#checkout"]],
    type: FRAMEWORK_PROBE_MESSAGE,
  });
  assertEquals(result.kind, "elements");
  if (result.kind !== "elements") throw new Error("expected element selection");
  assertEquals(result.elements[0]?.componentHint, {
    file: "/workspace/src/CheckoutButton.tsx",
    framework: "react",
    line: 17,
    name: "CheckoutButton",
  });
  assertEquals(result.elements[0]?.element, SELECTION.elements[0]?.element);
  assertEquals(result.elements[1]?.componentHint, undefined);
});

Deno.test("component hint enrichment silently ignores channel and response failures", async () => {
  const rejected = await addFrameworkComponentHints(
    { sendMessage: () => Promise.reject(new Error("background stopped")) },
    SELECTION,
    true,
  );
  const malformed = await addFrameworkComponentHints(
    { sendMessage: () => Promise.resolve({ hints: [{ framework: "jquery" }] }) },
    SELECTION,
    true,
  );
  const unreachable: PickerSelection = {
    kind: "unreachable",
    reason: "cross-origin-iframe",
    region: SELECTION.region,
  };

  assertStrictEquals(rejected, SELECTION);
  assertStrictEquals(malformed, SELECTION);
  assertStrictEquals(
    await addFrameworkComponentHints(
      { sendMessage: () => Promise.reject(new Error("must not send")) },
      unreachable,
      true,
    ),
    unreachable,
  );
});
