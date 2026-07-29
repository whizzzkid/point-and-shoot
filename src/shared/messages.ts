import {
  type ComponentHint,
  MAX_COMPONENT_HINT_TEXT_LENGTH,
  type NoteElement,
  type RegionCapture,
} from "./schema.ts";
import type { SelectorBundle } from "./selectors.ts";
import { MAXIMUM_NOTE_ELEMENTS } from "./session.ts";
import { MAX_SIBLINGS } from "./style-digest.ts";

/** Runtime message sent from the background to toggle the current page's overlay. */
export const TOGGLE_OVERLAY_MESSAGE = "point-and-shoot:toggle-overlay";

/** Runtime message sent from extension UI to toggle the active tab through the shared controller. */
export const TOGGLE_ACTIVE_TAB_MESSAGE = "point-and-shoot:toggle-active-tab";

/** Tab message sent from extension UI to read the current content realm's mounted state. */
export const GET_OVERLAY_STATE_MESSAGE = "point-and-shoot:get-overlay-state";

/** Runtime message sent from the content picker to capture one visible viewport region. */
export const CAPTURE_REGION_MESSAGE = "point-and-shoot:capture-region";

/** Runtime message sent after a capture to append its serializable note evidence. */
export const ADD_NOTE_MESSAGE = "point-and-shoot:add-note";

/** Runtime message requesting opt-in component hints from the page's main execution world. */
export const FRAMEWORK_PROBE_MESSAGE = "point-and-shoot:framework-probe";

/** Runtime message sent by a direct content-UI gesture to open the notes workspace. */
export const OPEN_NOTES_PANEL_MESSAGE = "point-and-shoot:open-notes-panel";

/** State returned by the content realm after an overlay state query or toggle. */
export interface OverlayStateResponse {
  readonly mounted: boolean;
}

/** Result returned by the background after a popup-triggered active-tab activation. */
export type ToggleActiveTabResponse =
  | {
    readonly ok: true;
    readonly mounted: boolean;
    readonly result: "injected" | "toggled" | "unavailable";
  }
  | { readonly ok: false; readonly error: { readonly message: string } };

/** Captured note payload sent from the inspected page to extension-owned persistence. */
export interface AddNoteRequest {
  readonly type: typeof ADD_NOTE_MESSAGE;
  readonly capture: RegionCapture;
  readonly elements: readonly NoteElement[];
  readonly pageTitle: string;
  readonly pageUrl: string;
}

/** Result returned after one captured note is durably appended. */
export type AddNoteResponse =
  | {
    readonly ok: true;
    readonly noteCount: number;
    readonly noteId: string;
    readonly sessionId: string;
  }
  | { readonly ok: false; readonly error: { readonly message: string } };

/** Reachable selector paths to probe together in the sender's frame. */
export interface FrameworkProbeRequest {
  readonly type: typeof FRAMEWORK_PROBE_MESSAGE;
  readonly cssPaths: readonly (readonly string[])[];
}

/** Hints aligned one-for-one with a {@link FrameworkProbeRequest}'s paths. */
export interface FrameworkProbeResponse {
  readonly hints: readonly (ComponentHint | null)[];
}

/** Serializable capture request measured in the inspected page's CSS-pixel coordinate space. */
export interface CaptureRegionRequest {
  readonly type: typeof CAPTURE_REGION_MESSAGE;
  readonly devicePixelRatio: number;
  readonly region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly viewport: { readonly width: number; readonly height: number };
}

/** Stable capture failure reasons the content UI can translate into guidance. */
export type CaptureRegionErrorCode =
  | "permission-denied"
  | "invalid-region"
  | "processing-failed";

const CAPTURE_REGION_ERROR_CODES: readonly CaptureRegionErrorCode[] = [
  "permission-denied",
  "invalid-region",
  "processing-failed",
];
const WEBP_DATA_URL_PREFIX = "data:image/webp;base64,";

/** Typed background response the UI can translate into capture guidance. */
export type CaptureRegionResponse =
  | { readonly ok: true; readonly capture: RegionCapture }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: CaptureRegionErrorCode;
      readonly message: string;
    };
  };

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

/**
 * Narrows a content-script reply to its current overlay state.
 *
 * @param message Value returned by a tab message.
 * @returns Whether the reply contains only a boolean mounted state.
 */
export function isOverlayStateResponse(message: unknown): message is OverlayStateResponse {
  return isRecord(message) &&
    hasOnlyKeys(message, ["mounted"]) &&
    typeof message.mounted === "boolean";
}

/**
 * Narrows a background reply to a popup-triggered activation result.
 *
 * @param message Value returned by the runtime message channel.
 * @returns Whether the reply is a valid success or typed failure.
 */
export function isToggleActiveTabResponse(message: unknown): message is ToggleActiveTabResponse {
  if (!isRecord(message) || typeof message.ok !== "boolean") return false;
  if (!message.ok) {
    return hasOnlyKeys(message, ["error", "ok"]) &&
      isRecord(message.error) &&
      hasOnlyKeys(message.error, ["message"]) &&
      typeof message.error.message === "string";
  }
  return hasOnlyKeys(message, ["mounted", "ok", "result"]) &&
    typeof message.mounted === "boolean" &&
    ["injected", "toggled", "unavailable"].includes(message.result as string);
}

function hasFiniteNumbers(candidate: unknown, fields: readonly string[]): boolean {
  if (!isRecord(candidate)) return false;
  return fields.every((field) => {
    const value = candidate[field];
    return typeof value === "number" && Number.isFinite(value);
  });
}

function hasOnlyKeys(candidate: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(candidate).every((key) => allowed.includes(key));
}

function isStringArray(candidate: unknown): candidate is readonly string[] {
  return Array.isArray(candidate) && candidate.every((value) => typeof value === "string");
}

function isComponentHint(candidate: unknown): candidate is ComponentHint {
  return isRecord(candidate) &&
    hasOnlyKeys(candidate, ["file", "framework", "line", "name"]) &&
    ["react", "vue", "svelte", "angular"].includes(candidate.framework as string) &&
    typeof candidate.name === "string" &&
    candidate.name.trim() !== "" &&
    candidate.name.length <= MAX_COMPONENT_HINT_TEXT_LENGTH &&
    (candidate.file === undefined ||
      (typeof candidate.file === "string" &&
        candidate.file.trim() !== "" &&
        candidate.file.length <= MAX_COMPONENT_HINT_TEXT_LENGTH)) &&
    (candidate.line === undefined ||
      (typeof candidate.line === "number" &&
        Number.isInteger(candidate.line) &&
        candidate.line > 0));
}

function isRegionCapture(candidate: unknown): candidate is RegionCapture {
  if (!isRecord(candidate)) return false;
  if (
    typeof candidate.screenshot !== "string" ||
    !candidate.screenshot.startsWith(WEBP_DATA_URL_PREFIX) ||
    typeof candidate.truncated !== "boolean" ||
    !hasFiniteNumbers(candidate.box, ["x", "y", "width", "height"]) ||
    !hasFiniteNumbers(candidate.viewport, ["width", "height"])
  ) {
    return false;
  }
  const box = candidate.box as Record<"height" | "width" | "x" | "y", number>;
  const viewport = candidate.viewport as Record<"height" | "width", number>;
  return box.x >= 0 &&
    box.y >= 0 &&
    box.width > 0 &&
    box.height > 0 &&
    viewport.width > 0 &&
    viewport.height > 0 &&
    hasOnlyKeys(box, ["height", "width", "x", "y"]) &&
    hasOnlyKeys(viewport, ["height", "width"]) &&
    hasOnlyKeys(candidate, ["box", "screenshot", "truncated", "viewport"]);
}

function isAriaRoleName(candidate: unknown): boolean {
  return isRecord(candidate) &&
    hasOnlyKeys(candidate, ["name", "role"]) &&
    typeof candidate.name === "string" &&
    typeof candidate.role === "string";
}

function isSelectorBundle(candidate: unknown): candidate is SelectorBundle {
  if (!isRecord(candidate) || typeof candidate.reachable !== "boolean") return false;
  const testIdAttributes = ["data-testid", "data-test", "data-cy", "id"];
  if (
    !Array.isArray(candidate.testIds) ||
    !candidate.testIds.every((signal) =>
      isRecord(signal) && typeof signal.attribute === "string" &&
      testIdAttributes.includes(signal.attribute) &&
      typeof signal.value === "string" &&
      hasOnlyKeys(signal, ["attribute", "value"])
    ) ||
    typeof candidate.tagClasses !== "string" ||
    typeof candidate.textSnippet !== "string" ||
    (candidate.ariaRoleName !== undefined && !isAriaRoleName(candidate.ariaRoleName))
  ) {
    return false;
  }
  if (candidate.reachable) {
    return hasOnlyKeys(candidate, [
      "ariaRoleName",
      "cssPath",
      "reachable",
      "tagClasses",
      "testIds",
      "textSnippet",
      "xpath",
    ]) &&
      isStringArray(candidate.cssPath) &&
      candidate.cssPath.length > 0 &&
      isStringArray(candidate.xpath) &&
      candidate.xpath.length > 0;
  }
  return hasOnlyKeys(candidate, [
    "ariaRoleName",
    "reachable",
    "tagClasses",
    "testIds",
    "textSnippet",
    "unreachable",
  ]) &&
    [
      "closed-shadow-root",
      "cross-origin-iframe",
      "detached",
      "foreign-document",
      "not-an-element",
    ].includes(candidate.unreachable as string);
}

function isElementDigest(candidate: unknown): boolean {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, ["box", "color", "typography"]) ||
    !isRecord(candidate.typography) ||
    !isRecord(candidate.color)
  ) {
    return false;
  }
  const boxFields = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "height",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "marginTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "width",
  ];
  const typographyFields = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
  ];
  const colorFields = [
    "backgroundColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderRightColor",
    "borderTopColor",
    "color",
  ];
  const color = candidate.color;
  return isRecord(candidate.box) &&
    hasOnlyKeys(candidate.box, boxFields) &&
    hasFiniteNumbers(candidate.box, boxFields) &&
    hasOnlyKeys(candidate.typography, typographyFields) &&
    typeof candidate.typography.fontFamily === "string" &&
    typeof candidate.typography.fontSize === "number" &&
    Number.isFinite(candidate.typography.fontSize) &&
    typeof candidate.typography.fontWeight === "string" &&
    typeof candidate.typography.letterSpacing === "string" &&
    typeof candidate.typography.lineHeight === "string" &&
    hasOnlyKeys(color, colorFields) &&
    colorFields.every((field) => typeof color[field] === "string");
}

function isStyleDigest(candidate: unknown): boolean {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, ["parent", "self", "siblings"]) ||
    !isElementDigest(candidate.self) ||
    (candidate.parent !== null && !isElementDigest(candidate.parent)) ||
    !Array.isArray(candidate.siblings) ||
    candidate.siblings.length > MAX_SIBLINGS
  ) {
    return false;
  }
  return candidate.siblings.every((sibling) =>
    isRecord(sibling) &&
    hasOnlyKeys(sibling, ["direction", "distance", "element", "gapPx"]) &&
    (sibling.direction === "preceding" || sibling.direction === "following") &&
    typeof sibling.distance === "number" &&
    Number.isInteger(sibling.distance) &&
    sibling.distance > 0 &&
    typeof sibling.gapPx === "number" &&
    Number.isFinite(sibling.gapPx) &&
    isElementDigest(sibling.element)
  );
}

function isNoteElement(candidate: unknown): candidate is NoteElement {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, ["componentHint", "selectors", "styleDigest"]) ||
    !isSelectorBundle(candidate.selectors) ||
    (candidate.styleDigest !== null && !isStyleDigest(candidate.styleDigest))
  ) {
    return false;
  }
  if (!candidate.selectors.reachable) {
    return candidate.styleDigest === null && candidate.componentHint === undefined;
  }
  if (candidate.componentHint === undefined) return true;
  return isComponentHint(candidate.componentHint);
}

/**
 * Narrows an untrusted runtime value to a bounded framework probe request.
 *
 * @param message Value received from a content realm.
 * @returns Whether it contains one to the settled maximum number of non-empty selector paths.
 */
export function isFrameworkProbeRequest(message: unknown): message is FrameworkProbeRequest {
  return isRecord(message) &&
    hasOnlyKeys(message, ["cssPaths", "type"]) &&
    message.type === FRAMEWORK_PROBE_MESSAGE &&
    Array.isArray(message.cssPaths) &&
    message.cssPaths.length > 0 &&
    message.cssPaths.length <= MAXIMUM_NOTE_ELEMENTS &&
    message.cssPaths.every((path) =>
      Array.isArray(path) &&
      path.length > 0 &&
      path.every((segment) => typeof segment === "string" && segment !== "")
    );
}

/**
 * Narrows an untrusted page-world result to aligned component hints.
 *
 * @param message Value returned by the background probe handler.
 * @param expectedCount Number of selector paths in the corresponding request.
 * @returns Whether the result has exactly one valid hint or `null` per requested path.
 */
export function isFrameworkProbeResponse(
  message: unknown,
  expectedCount: number,
): message is FrameworkProbeResponse {
  return isRecord(message) &&
    hasOnlyKeys(message, ["hints"]) &&
    Array.isArray(message.hints) &&
    message.hints.length === expectedCount &&
    message.hints.every((hint) => hint === null || isComponentHint(hint));
}

/**
 * Narrows an untrusted runtime message to {@link CaptureRegionRequest}.
 *
 * @param message Value received from another extension context.
 * @returns Whether every required request field has the expected primitive shape.
 */
export function isCaptureRegionRequest(message: unknown): message is CaptureRegionRequest {
  if (!isRecord(message)) return false;
  const candidate = message;
  if (candidate.type !== CAPTURE_REGION_MESSAGE) return false;
  if (
    typeof candidate.devicePixelRatio !== "number" ||
    !Number.isFinite(candidate.devicePixelRatio)
  ) {
    return false;
  }
  return hasFiniteNumbers(candidate.region, ["x", "y", "width", "height"]) &&
    hasFiniteNumbers(candidate.viewport, ["width", "height"]);
}

/**
 * Narrows an untrusted runtime reply to {@link CaptureRegionResponse}.
 *
 * @param message Value returned by the background message channel.
 * @returns Whether the reply contains either a valid region capture or a typed capture error.
 */
export function isCaptureRegionResponse(message: unknown): message is CaptureRegionResponse {
  if (!isRecord(message) || typeof message.ok !== "boolean") return false;
  if (!message.ok) {
    if (!isRecord(message.error) || typeof message.error.message !== "string") return false;
    return CAPTURE_REGION_ERROR_CODES.includes(message.error.code as CaptureRegionErrorCode);
  }
  return isRegionCapture(message.capture);
}

/**
 * Narrows an untrusted runtime message to {@link AddNoteRequest}.
 *
 * @param message Value received from another extension context.
 * @returns Whether the value contains only serializable captured-note evidence.
 */
export function isAddNoteRequest(message: unknown): message is AddNoteRequest {
  return isRecord(message) &&
    message.type === ADD_NOTE_MESSAGE &&
    typeof message.pageTitle === "string" &&
    typeof message.pageUrl === "string" &&
    isRegionCapture(message.capture) &&
    Array.isArray(message.elements) &&
    message.elements.every(isNoteElement);
}

/**
 * Narrows an untrusted runtime reply to {@link AddNoteResponse}.
 *
 * @param message Value returned by the background note handler.
 * @returns Whether the reply contains a durable result or typed storage error.
 */
export function isAddNoteResponse(message: unknown): message is AddNoteResponse {
  if (!isRecord(message) || typeof message.ok !== "boolean") return false;
  if (!message.ok) {
    return isRecord(message.error) && typeof message.error.message === "string";
  }
  return typeof message.noteCount === "number" &&
    Number.isInteger(message.noteCount) &&
    message.noteCount >= 0 &&
    typeof message.noteId === "string" &&
    typeof message.sessionId === "string";
}
