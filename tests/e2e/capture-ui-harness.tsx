/// <reference lib="dom" />

import { render } from "preact";
import { CaptureOverlay } from "../../src/content/CaptureOverlay.tsx";
import {
  CaptureRequestError,
  captureSelectedRegion,
  captureWithoutOverlay,
} from "../../src/content/capture.ts";
import { createShadowHost } from "../../src/content/host.ts";
import pickerStyles from "../../src/content/picker/picker.css" with { type: "text" };
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import toolbarStyles from "../../src/content/toolbar/toolbar.css" with { type: "text" };

const shadowHost = createShadowHost({
  inlineIconSprite: iconSprite,
  resourceUrl: () => "data:font/woff2;base64,d09GMg==",
  styles: [pickerStyles, toolbarStyles],
  theme: "dark",
});
render(<CaptureOverlay iconSpriteUrl="" />, shadowHost.mount);

let captureComplete: Promise<string> | undefined;
let captureReady = false;
let releaseCapture: (() => void) | undefined;

const harness = {
  begin() {
    captureComplete = captureWithoutOverlay(shadowHost.element, window, async () => {
      captureReady = true;
      await new Promise<void>((resolve) => {
        releaseCapture = resolve;
      });
      return "captured";
    });
  },
  async finish() {
    releaseCapture?.();
    return await captureComplete;
  },
  state() {
    return {
      captureReady,
      display: getComputedStyle(shadowHost.element).display,
    };
  },
  async request(response: unknown) {
    let displayDuringRequest = "";
    let message: unknown;
    try {
      const capture = await captureSelectedRegion(
        {
          sendMessage(nextMessage) {
            message = nextMessage;
            displayDuringRequest = getComputedStyle(shadowHost.element).display;
            return Promise.resolve(response);
          },
        },
        shadowHost.element,
        window,
        { height: 40, left: 10, top: 20, width: 30 },
      );
      return {
        capture,
        displayAfterRequest: getComputedStyle(shadowHost.element).display,
        displayDuringRequest,
        message,
        ok: true as const,
      };
    } catch (error) {
      return {
        code: error instanceof CaptureRequestError ? error.code : undefined,
        displayAfterRequest: getComputedStyle(shadowHost.element).display,
        displayDuringRequest,
        message,
        ok: false as const,
      };
    }
  },
  async overlap() {
    let releaseFirst = (): void => undefined;
    let releaseSecond = (): void => undefined;
    let signalFirstStarted = (): void => undefined;
    let signalSecondStarted = (): void => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      signalSecondStarted = resolve;
    });
    const first = captureWithoutOverlay(shadowHost.element, window, async () => {
      signalFirstStarted();
      await firstGate;
    });
    const second = captureWithoutOverlay(shadowHost.element, window, async () => {
      signalSecondStarted();
      await secondGate;
    });
    await Promise.all([firstStarted, secondStarted]);
    const whileBothActive = getComputedStyle(shadowHost.element).display;
    releaseFirst();
    await first;
    const afterFirstCompletes = getComputedStyle(shadowHost.element).display;
    releaseSecond();
    await second;
    return {
      afterBothComplete: getComputedStyle(shadowHost.element).display,
      afterFirstCompletes,
      whileBothActive,
    };
  },
};

(globalThis as unknown as { pointShootCaptureUiTest: typeof harness }).pointShootCaptureUiTest =
  harness;
