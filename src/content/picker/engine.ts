/// <reference lib="dom" />

import type { NoteElement } from "../../shared/schema.ts";
import { MAXIMUM_NOTE_ELEMENTS } from "../../shared/session.ts";
import { buildSelectorBundle, type UnreachableReason } from "../../shared/selectors.ts";
import { buildStyleDigest, MAX_SUBTREE_DEPTH } from "../../shared/style-digest.ts";

/** Settled maximum number of elements captured by one drag box. */
export const MAX_DRAG_ELEMENTS = MAXIMUM_NOTE_ELEMENTS;

/** Viewport-coordinate point used for hit testing. */
export interface PickerPoint {
  readonly x: number;
  readonly y: number;
}

/** Viewport-coordinate region used for highlight and drag collection. */
export interface SelectionRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Direction mapped to the picker's four arrow-key traversal commands. */
export type PickerNavigation = "parent" | "child" | "next" | "previous";

/** Captured live element plus the serializable evidence stored with its future note. */
export interface PickerElementCapture extends NoteElement {
  readonly element: Element;
  readonly primary: boolean;
  readonly rect: SelectionRect;
}

/** Result of resolving one viewport point through open shadow roots and same-origin frames. */
export type PickerTarget =
  | { readonly kind: "element"; readonly element: Element }
  | {
    readonly kind: "unreachable";
    readonly reason: Extract<UnreachableReason, "cross-origin-iframe">;
    readonly rect: SelectionRect;
  }
  | { readonly kind: "none" };

const STRUCTURAL_TAGS = new Set([
  "BODY",
  "HEAD",
  "HTML",
  "LINK",
  "META",
  "NOSCRIPT",
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "TITLE",
]);

function selectionRect(rect: DOMRect): SelectionRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function intersects(first: SelectionRect, second: SelectionRect): boolean {
  return first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top;
}

function contains(outer: SelectionRect, inner: SelectionRect): boolean {
  return outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.left + outer.width >= inner.left + inner.width &&
    outer.top + outer.height >= inner.top + inner.height;
}

function isExtensionElement(element: Element): boolean {
  return element.matches("[data-point-and-shoot-host]") ||
    element.closest("[data-point-and-shoot-host]") !== null;
}

function pageElementAtPoint(ownerDocument: Document, point: PickerPoint): Element | null {
  return ownerDocument.elementsFromPoint(point.x, point.y).find(
    (element) => !isExtensionElement(element),
  ) ?? null;
}

function deepestOpenShadowElement(element: Element, point: PickerPoint): Element {
  let current = element;
  while (current.shadowRoot !== null) {
    const inner = current.shadowRoot.elementsFromPoint(point.x, point.y).find(
      (candidate) => candidate !== current && !isExtensionElement(candidate),
    );
    if (inner === undefined) break;
    current = inner;
  }
  return current;
}

/**
 * Resolves a viewport point to the deepest reachable element.
 *
 * @param ownerDocument Document whose viewport owns the point.
 * @param point Viewport-coordinate point.
 * @returns A reachable element, an explicit cross-origin boundary, or no target.
 */
export function resolvePickerTarget(
  ownerDocument: Document,
  point: PickerPoint,
): PickerTarget {
  const hit = pageElementAtPoint(ownerDocument, point);
  if (hit === null) return { kind: "none" };
  const deepest = deepestOpenShadowElement(hit, point);
  if (deepest.tagName !== "IFRAME") {
    return { kind: "element", element: deepest };
  }

  const frame = deepest as HTMLIFrameElement;
  const frameRect = frame.getBoundingClientRect();
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    return {
      kind: "unreachable",
      reason: "cross-origin-iframe",
      rect: selectionRect(frameRect),
    };
  }
  return resolvePickerTarget(frameDocument, {
    x: point.x - frameRect.left,
    y: point.y - frameRect.top,
  });
}

function shadowParent(element: Element): Element | null {
  if (element.parentElement !== null) return element.parentElement;
  const root = element.getRootNode();
  return root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in root
    ? (root as ShadowRoot).host
    : null;
}

/**
 * Moves a keyboard picker selection through the reachable DOM without wrapping.
 *
 * @param element Current selected element.
 * @param direction Parent, first child, next sibling, or previous sibling.
 * @returns The reachable neighbour, or `element` when the requested neighbour does not exist.
 */
export function navigatePickerElement(
  element: Element,
  direction: PickerNavigation,
): Element {
  if (direction === "parent") return shadowParent(element) ?? element;
  if (direction === "child") {
    return element.shadowRoot?.firstElementChild ?? element.firstElementChild ?? element;
  }
  if (direction === "next") return element.nextElementSibling ?? element;
  return element.previousElementSibling ?? element;
}

/**
 * Builds selectors and a style digest for one live picker target.
 *
 * @param element Live element under the picker.
 * @param primary Whether this element anchors a multi-element capture.
 * @returns Live geometry plus the serializable note-element evidence.
 */
export function capturePickerElement(
  element: Element,
  primary: boolean,
): PickerElementCapture {
  const selectors = buildSelectorBundle(element);
  return {
    element,
    primary,
    rect: selectionRect(element.getBoundingClientRect()),
    selectors,
    styleDigest: selectors.reachable ? buildStyleDigest(element) : null,
  };
}

function collectionRoot(ownerDocument: Document, region: SelectionRect): Element {
  const center = {
    x: region.left + region.width / 2,
    y: region.top + region.height / 2,
  };
  let candidate = pageElementAtPoint(ownerDocument, center) ?? ownerDocument.body;
  while (candidate.parentElement !== null) {
    if (contains(selectionRect(candidate.getBoundingClientRect()), region)) return candidate;
    candidate = candidate.parentElement;
  }
  return ownerDocument.body;
}

function depthFromRoot(element: Element, root: Element): number | null {
  let depth = 0;
  let current: Element | null = element;
  while (current !== root) {
    current = current.parentElement;
    depth++;
    if (current === null) return null;
  }
  return depth;
}

function isVisualCaptureCandidate(
  element: Element,
  root: Element,
  region: SelectionRect,
): boolean {
  if (STRUCTURAL_TAGS.has(element.tagName) || isExtensionElement(element)) return false;
  const depth = depthFromRoot(element, root);
  if (depth === null || depth > MAX_SUBTREE_DEPTH) return false;
  const rect = selectionRect(element.getBoundingClientRect());
  if (rect.width === 0 || rect.height === 0 || !intersects(rect, region)) return false;
  const ownerWindow = element.ownerDocument.defaultView;
  if (ownerWindow === null) return false;
  const style = ownerWindow.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

/**
 * Collects visible intersecting elements in DOM order under the settled count and depth budgets.
 *
 * @param ownerDocument Document containing the drag region.
 * @param region Viewport-coordinate drag box.
 * @param requestedPrimary Element under the drag origin, when one was reachable.
 * @returns Up to {@link MAX_DRAG_ELEMENTS} captures with exactly one primary when non-empty.
 */
export function collectDragElements(
  ownerDocument: Document,
  region: SelectionRect,
  requestedPrimary?: Element,
): readonly PickerElementCapture[] {
  const root = collectionRoot(ownerDocument, region);
  const candidates = [root, ...root.querySelectorAll("*")]
    .filter((element) => isVisualCaptureCandidate(element, root, region))
    .slice(0, MAX_DRAG_ELEMENTS);
  const primary = requestedPrimary !== undefined && candidates.includes(requestedPrimary)
    ? requestedPrimary
    : candidates[0];
  return candidates.map((element) => capturePickerElement(element, element === primary));
}
