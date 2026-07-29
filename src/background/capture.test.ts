import { assertEquals, assertRejects } from "@std/assert";
import {
  type CaptureBitmap,
  type CaptureBrowser,
  type CaptureCanvas,
  type CaptureImageRuntime,
  CapturePermissionError,
  CaptureProcessingError,
  captureRegion,
  type CaptureRegionInput,
  registerCaptureHandler,
} from "./capture.ts";
import type { BrowserShim, MessageListener } from "../shared/browser.ts";
import { CAPTURE_REGION_MESSAGE } from "../shared/messages.ts";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../shared/settings.ts";

const BASE_INPUT: CaptureRegionInput = {
  devicePixelRatio: 2,
  region: { height: 200, width: 300, x: 100, y: 50 },
  viewport: { height: 600, width: 800 },
};

interface FakeImageRuntime extends CaptureImageRuntime {
  readonly canvasSizes: { readonly height: number; readonly width: number }[];
  readonly drawCalls: readonly unknown[][];
  readonly encodeOptions: { readonly quality?: number; readonly type?: string }[];
  readonly wasClosed: () => boolean;
}

function createFakeImageRuntime(
  bitmapSize = { height: 1_200, width: 1_600 },
): FakeImageRuntime {
  const canvasSizes: { height: number; width: number }[] = [];
  const drawCalls: unknown[][] = [];
  const encodeOptions: { quality?: number; type?: string }[] = [];
  let closed = false;
  const bitmap: CaptureBitmap = {
    ...bitmapSize,
    close() {
      closed = true;
    },
  };
  return {
    canvasSizes,
    decode() {
      return Promise.resolve(bitmap);
    },
    drawCalls,
    encodeOptions,
    createCanvas(width, height): CaptureCanvas {
      canvasSizes.push({ height, width });
      return {
        convertToBlob(options) {
          encodeOptions.push(options);
          return Promise.resolve(new Blob(["webp"], { type: options.type }));
        },
        getContext() {
          return {
            drawImage(bitmap, ...coordinates) {
              drawCalls.push([bitmap, ...coordinates]);
            },
          };
        },
      };
    },
    toDataUrl() {
      return Promise.resolve("data:image/webp;base64,V0VCUA==");
    },
    wasClosed: () => closed,
  };
}

function successfulBrowser() {
  return {
    captureVisibleTab() {
      return Promise.resolve("data:image/png;base64,UE5H");
    },
  };
}

function registeredCaptureListener(
  tabs: CaptureBrowser,
  runtime: CaptureImageRuntime,
  storedSettings: unknown = DEFAULT_SETTINGS,
): MessageListener {
  let listener: MessageListener | undefined;
  const extensionBrowser = {
    runtime: {
      onMessage: {
        addListener(nextListener: MessageListener) {
          listener = nextListener;
        },
      },
    },
    storage: {
      local: {
        get: () => Promise.resolve({ [SETTINGS_STORAGE_KEY]: storedSettings }),
      },
    },
    tabs,
  } as unknown as BrowserShim;
  registerCaptureHandler(extensionBrowser, runtime);
  if (listener === undefined) throw new Error("capture handler did not register a listener");
  return listener;
}

Deno.test("captureRegion applies device-pixel crop math and WebP encoding", async () => {
  const runtime = createFakeImageRuntime();
  const result = await captureRegion(successfulBrowser(), BASE_INPUT, runtime);

  assertEquals(runtime.drawCalls[0]?.slice(1), [
    200,
    100,
    600,
    400,
    0,
    0,
    600,
    400,
  ]);
  assertEquals(runtime.canvasSizes, [{ height: 400, width: 600 }]);
  assertEquals(runtime.encodeOptions, [{ quality: 0.7, type: "image/webp" }]);
  assertEquals(runtime.wasClosed(), true);
  assertEquals(result, {
    box: { height: 200, width: 300, x: 100, y: 50 },
    screenshot: "data:image/webp;base64,V0VCUA==",
    truncated: false,
    viewport: { height: 600, width: 800 },
  });
});

Deno.test("captureRegion clamps to the viewport and caps the longest encoded edge", async () => {
  const runtime = createFakeImageRuntime();
  const result = await captureRegion(
    successfulBrowser(),
    {
      devicePixelRatio: 2,
      region: { height: 900, width: 1_200, x: -100, y: -50 },
      viewport: { height: 600, width: 800 },
    },
    runtime,
  );

  assertEquals(runtime.drawCalls[0]?.slice(1), [
    0,
    0,
    1_600,
    1_200,
    0,
    0,
    1_024,
    768,
  ]);
  assertEquals(runtime.canvasSizes, [{ height: 768, width: 1_024 }]);
  assertEquals(result.box, { height: 600, width: 800, x: 0, y: 0 });
  assertEquals(result.truncated, true);
});

Deno.test("captureRegion applies persisted quality and longest-edge choices", async () => {
  const runtime = createFakeImageRuntime();

  await captureRegion(
    successfulBrowser(),
    {
      devicePixelRatio: 2,
      region: { height: 600, width: 800, x: 0, y: 0 },
      viewport: { height: 600, width: 800 },
    },
    runtime,
    { maximumDimension: 512, quality: 0.85 },
  );

  assertEquals(runtime.canvasSizes, [{ height: 384, width: 512 }]);
  assertEquals(runtime.encodeOptions, [{ quality: 0.85, type: "image/webp" }]);
});

Deno.test(
  "captureRegion reports a browser bitmap smaller than the requested crop as truncated",
  async () => {
    const runtime = createFakeImageRuntime({ height: 350, width: 700 });
    const result = await captureRegion(successfulBrowser(), BASE_INPUT, runtime);

    assertEquals(runtime.drawCalls[0]?.slice(1), [
      200,
      100,
      500,
      250,
      0,
      0,
      500,
      250,
    ]);
    assertEquals(result.truncated, true);
  },
);

Deno.test("captureRegion rejects invalid or empty geometry before capturing", async () => {
  let captureCalls = 0;
  const browser = {
    captureVisibleTab() {
      captureCalls++;
      return Promise.resolve("data:image/png;base64,UE5H");
    },
  };

  await assertRejects(
    () =>
      captureRegion(browser, {
        ...BASE_INPUT,
        region: { ...BASE_INPUT.region, width: Number.NaN },
      }),
    TypeError,
    "finite",
  );
  await assertRejects(
    () =>
      captureRegion(browser, {
        ...BASE_INPUT,
        region: { height: 20, width: 20, x: 900, y: 700 },
      }),
    RangeError,
    "visible viewport",
  );
  assertEquals(captureCalls, 0);
});

Deno.test(
  "captureRegion translates visible-tab capture rejection to a typed permission error",
  async () => {
    const cause = new Error("Either the '<all_urls>' or 'activeTab' permission is required.");
    const error = await assertRejects(
      () =>
        captureRegion(
          { captureVisibleTab: () => Promise.reject(cause) },
          BASE_INPUT,
          createFakeImageRuntime(),
        ),
      CapturePermissionError,
      "active-tab permission",
    );
    assertEquals(error.cause, cause);
  },
);

Deno.test("captureRegion wraps image failures and always closes a decoded bitmap", async (t) => {
  await t.step("missing canvas context", async () => {
    const base = createFakeImageRuntime();
    const runtime: CaptureImageRuntime = {
      ...base,
      createCanvas() {
        return {
          convertToBlob: () => Promise.resolve(new Blob(["webp"], { type: "image/webp" })),
          getContext: () => null,
        };
      },
    };
    await assertRejects(
      () => captureRegion(successfulBrowser(), BASE_INPUT, runtime),
      CaptureProcessingError,
      "no 2D rendering context",
    );
    assertEquals(base.wasClosed(), true);
  });

  await t.step("WebP encoding rejection", async () => {
    const base = createFakeImageRuntime();
    const cause = new Error("encoder unavailable");
    const runtime: CaptureImageRuntime = {
      ...base,
      createCanvas(width, height) {
        const canvas = base.createCanvas(width, height);
        return {
          convertToBlob: () => Promise.reject(cause),
          getContext: () => canvas.getContext(),
        };
      },
    };
    const error = await assertRejects(
      () => captureRegion(successfulBrowser(), BASE_INPUT, runtime),
      CaptureProcessingError,
      "could not be cropped or encoded",
    );
    assertEquals(error.cause, cause);
    assertEquals(base.wasClosed(), true);
  });

  await t.step("decode rejection", async () => {
    const cause = new Error("invalid PNG");
    const runtime: CaptureImageRuntime = {
      ...createFakeImageRuntime(),
      decode: () => Promise.reject(cause),
    };
    const error = await assertRejects(
      () => captureRegion(successfulBrowser(), BASE_INPUT, runtime),
      CaptureProcessingError,
      "could not be decoded",
    );
    assertEquals(error.cause, cause);
  });
});

Deno.test(
  "registerCaptureHandler ignores foreign messages and returns typed capture results",
  async () => {
    const runtime = createFakeImageRuntime();
    const listener = registeredCaptureListener(successfulBrowser(), runtime);

    const responses: unknown[] = [];
    assertEquals(listener("other", {}, (response) => responses.push(response)), undefined);
    assertEquals(
      listener(
        { ...BASE_INPUT, type: CAPTURE_REGION_MESSAGE },
        {},
        (response) => responses.push(response),
      ),
      true,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    assertEquals(responses, [{
      capture: {
        box: BASE_INPUT.region,
        screenshot: "data:image/webp;base64,V0VCUA==",
        truncated: false,
        viewport: BASE_INPUT.viewport,
      },
      ok: true,
    }]);
  },
);

Deno.test("registerCaptureHandler reads persisted screenshot settings for each request", async () => {
  const runtime = createFakeImageRuntime();
  const listener = registeredCaptureListener(successfulBrowser(), runtime, {
    ...DEFAULT_SETTINGS,
    screenshotMaxDimension: 512,
    screenshotQuality: 0.85,
  });

  assertEquals(
    listener(
      {
        devicePixelRatio: 2,
        region: { height: 600, width: 800, x: 0, y: 0 },
        type: CAPTURE_REGION_MESSAGE,
        viewport: { height: 600, width: 800 },
      },
      {},
      () => undefined,
    ),
    true,
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assertEquals(runtime.canvasSizes, [{ height: 384, width: 512 }]);
  assertEquals(runtime.encodeOptions, [{ quality: 0.85, type: "image/webp" }]);
});

Deno.test("registerCaptureHandler returns typed permission and invalid-region errors", async () => {
  const denied = registeredCaptureListener(
    { captureVisibleTab: () => Promise.reject(new Error("activeTab missing")) },
    createFakeImageRuntime(),
  );
  const invalid = registeredCaptureListener(successfulBrowser(), createFakeImageRuntime());
  const responses: unknown[] = [];

  assertEquals(
    denied(
      { ...BASE_INPUT, type: CAPTURE_REGION_MESSAGE },
      {},
      (response) => responses.push(response),
    ),
    true,
  );
  assertEquals(
    invalid(
      {
        ...BASE_INPUT,
        region: { ...BASE_INPUT.region, height: -1 },
        type: CAPTURE_REGION_MESSAGE,
      },
      {},
      (response) => responses.push(response),
    ),
    true,
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const expected = [
    {
      error: {
        code: "invalid-region",
        message: "capture dimensions and devicePixelRatio must be positive",
      },
      ok: false,
    },
    {
      error: {
        code: "permission-denied",
        message: "Capture needs an active-tab permission granted by a toolbar or keyboard gesture.",
      },
      ok: false,
    },
  ];
  const byJson = (left: unknown, right: unknown): number =>
    JSON.stringify(left).localeCompare(JSON.stringify(right));
  assertEquals(responses.sort(byJson), expected.sort(byJson));
});
