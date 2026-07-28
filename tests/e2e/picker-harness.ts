/// <reference lib="dom" />

import {
  capturePickerElement,
  collectDragElements,
  navigatePickerElement,
  resolvePickerTarget,
  type SelectionRect,
} from "../../src/content/picker/engine.ts";

function elementForSelector(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) throw new Error(`picker harness found no element for "${selector}"`);
  return element;
}

function identity(element: Element): string {
  return element.getAttribute("data-testid") ??
    element.getAttribute("id") ??
    element.textContent?.replace(/\s+/g, " ").trim() ??
    element.tagName.toLowerCase();
}

const harness = {
  capture(selector: string) {
    const capture = capturePickerElement(elementForSelector(selector), true);
    return {
      primary: capture.primary,
      reachable: capture.selectors.reachable,
      tagClasses: capture.selectors.tagClasses,
      textSnippet: capture.selectors.textSnippet,
      width: capture.styleDigest?.self.box.width,
    };
  },
  captureClosedInterior() {
    const host = document.createElement("div");
    document.body.append(host);
    const root = host.attachShadow({ mode: "closed" });
    const button = document.createElement("button");
    button.textContent = "Closed action";
    root.append(button);
    const capture = capturePickerElement(button, true);
    host.remove();
    return {
      reachable: capture.selectors.reachable,
      styleDigest: capture.styleDigest,
      unreachable: capture.selectors.reachable ? undefined : capture.selectors.unreachable,
    };
  },
  collect(rect: SelectionRect, primarySelector?: string) {
    const captures = collectDragElements(
      document,
      rect,
      primarySelector === undefined ? undefined : elementForSelector(primarySelector),
    );
    return {
      count: captures.length,
      identities: captures.map((capture) => identity(capture.element)),
      primaryCount: captures.filter((capture) => capture.primary).length,
    };
  },
  navigate(selector: string, direction: "parent" | "child" | "next" | "previous") {
    return identity(navigatePickerElement(elementForSelector(selector), direction));
  },
  resolve(x: number, y: number) {
    const target = resolvePickerTarget(document, { x, y });
    return target.kind === "element"
      ? { identity: identity(target.element), kind: target.kind }
      : target.kind === "unreachable"
      ? { kind: target.kind, reason: target.reason }
      : { kind: target.kind };
  },
};

(globalThis as unknown as { pointShootPickerTest: typeof harness }).pointShootPickerTest = harness;
