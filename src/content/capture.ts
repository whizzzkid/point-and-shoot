/// <reference lib="dom" />

import type { RegionCapture } from "../shared/schema.ts";
import {
  CAPTURE_REGION_MESSAGE,
  type CaptureRegionErrorCode,
  type CaptureRegionRequest,
  isCaptureRegionResponse,
} from "../shared/messages.ts";
import type { SelectionRect } from "./picker/engine.ts";

interface HiddenHostState {
  activeCaptures: number;
  readonly previousPriority: string;
  readonly previousValue: string;
}

/** Runtime message surface consumed by {@link captureSelectedRegion}. */
export interface CaptureMessageRuntime {
  sendMessage(message: unknown): Promise<unknown>;
}

const hiddenHosts = new WeakMap<HTMLElement, HiddenHostState>();

function afterPaint(ownerWindow: Window): Promise<void> {
  return new Promise((resolve) => {
    ownerWindow.requestAnimationFrame(() => {
      ownerWindow.requestAnimationFrame(() => resolve());
    });
  });
}

function hideHost(host: HTMLElement): void {
  const state = hiddenHosts.get(host);
  if (state !== undefined) {
    state.activeCaptures++;
    return;
  }
  hiddenHosts.set(host, {
    activeCaptures: 1,
    previousPriority: host.style.getPropertyPriority("display"),
    previousValue: host.style.getPropertyValue("display"),
  });
  host.style.setProperty("display", "none", "important");
}

function restoreHost(host: HTMLElement): void {
  const state = hiddenHosts.get(host);
  if (state === undefined) return;
  state.activeCaptures--;
  if (state.activeCaptures > 0) return;
  hiddenHosts.delete(host);
  if (state.previousValue === "") {
    host.style.removeProperty("display");
  } else {
    host.style.setProperty("display", state.previousValue, state.previousPriority);
  }
}

/** A typed failure returned by the background capture pipeline or its message channel. */
export class CaptureRequestError extends Error {
  /** Machine-readable reason the note UI can translate into guidance. */
  readonly code: CaptureRegionErrorCode;

  constructor(code: CaptureRegionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "CaptureRequestError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Hides every extension-owned overlay for one painted frame while a visible-tab capture runs.
 *
 * @param host Closed-shadow host containing all extension pixels.
 * @param ownerWindow Window that schedules the inspected page's paint.
 * @param capture Visible-tab request to run only after the hidden state paints.
 * @returns The capture callback's result after restoring the host's prior display declaration.
 */
export async function captureWithoutOverlay<T>(
  host: HTMLElement,
  ownerWindow: Window,
  capture: () => Promise<T>,
): Promise<T> {
  hideHost(host);
  try {
    await afterPaint(ownerWindow);
    return await capture();
  } finally {
    restoreHost(host);
  }
}

/**
 * Requests a visible-tab screenshot for a completed picker selection.
 *
 * @param runtime Promise-based extension message channel.
 * @param host Closed-shadow host hidden while the browser captures the tab.
 * @param ownerWindow Inspected page window supplying viewport geometry and paint scheduling.
 * @param region CSS-pixel selection rectangle.
 * @returns The validated WebP region capture returned by the background context.
 * @throws {@link CaptureRequestError} when the channel or background capture fails.
 */
export async function captureSelectedRegion(
  runtime: CaptureMessageRuntime,
  host: HTMLElement,
  ownerWindow: Window,
  region: SelectionRect,
): Promise<RegionCapture> {
  const request: CaptureRegionRequest = {
    devicePixelRatio: ownerWindow.devicePixelRatio,
    region: {
      height: region.height,
      width: region.width,
      x: region.left,
      y: region.top,
    },
    type: CAPTURE_REGION_MESSAGE,
    viewport: {
      height: ownerWindow.innerHeight,
      width: ownerWindow.innerWidth,
    },
  };
  return await captureWithoutOverlay(host, ownerWindow, async () => {
    let response: unknown;
    try {
      response = await runtime.sendMessage(request);
    } catch (cause) {
      throw new CaptureRequestError(
        "processing-failed",
        "The screenshot request could not reach the background context.",
        cause,
      );
    }
    if (!isCaptureRegionResponse(response)) {
      throw new CaptureRequestError(
        "processing-failed",
        "The background context returned an invalid screenshot response.",
      );
    }
    if (!response.ok) {
      throw new CaptureRequestError(response.error.code, response.error.message);
    }
    return response.capture;
  });
}
