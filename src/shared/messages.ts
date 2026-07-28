import type { RegionCapture } from "./schema.ts";

/** Runtime message sent from the background to toggle the current page's overlay. */
export const TOGGLE_OVERLAY_MESSAGE = "point-and-shoot:toggle-overlay";

/** Runtime message sent from the content picker to capture one visible viewport region. */
export const CAPTURE_REGION_MESSAGE = "point-and-shoot:capture-region";

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

function hasFiniteNumbers(candidate: unknown, fields: readonly string[]): boolean {
  if (!isRecord(candidate)) return false;
  return fields.every((field) => {
    const value = candidate[field];
    return typeof value === "number" && Number.isFinite(value);
  });
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
  if (!isRecord(message.capture)) return false;
  return typeof message.capture.screenshot === "string" &&
    message.capture.screenshot.startsWith(WEBP_DATA_URL_PREFIX) &&
    typeof message.capture.truncated === "boolean" &&
    hasFiniteNumbers(message.capture.box, ["x", "y", "width", "height"]) &&
    hasFiniteNumbers(message.capture.viewport, ["width", "height"]);
}
