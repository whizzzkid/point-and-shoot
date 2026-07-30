import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { Buffer } from "node:buffer";
import { PNG } from "pngjs";
import { compareVisualSnapshot } from "./compare.ts";

interface Pixel {
  readonly alpha?: number;
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

function pngBytes(pixels: readonly Pixel[]): Uint8Array {
  const image = new PNG({ height: 1, width: pixels.length });
  for (const [index, pixel] of pixels.entries()) {
    const offset = index * 4;
    image.data[offset] = pixel.red;
    image.data[offset + 1] = pixel.green;
    image.data[offset + 2] = pixel.blue;
    image.data[offset + 3] = pixel.alpha ?? 255;
  }
  return PNG.sync.write(image);
}

async function writePng(path: string, pixels: readonly Pixel[]): Promise<void> {
  await Deno.writeFile(path, pngBytes(pixels));
}

const BLACK = { blue: 0, green: 0, red: 0 } as const;
const WHITE = { blue: 255, green: 255, red: 255 } as const;

Deno.test("visual comparison accepts an identical PNG", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    const baselinePath = join(directory, "baseline.png");
    await writePng(actualPath, [BLACK, WHITE]);
    await writePng(baselinePath, [BLACK, WHITE]);

    assertEquals(
      await compareVisualSnapshot({
        actualPath,
        artifactDirectory: join(directory, "artifacts"),
        baselinePath,
        maxDiffPixelRatio: 0,
        snapshotName: "identical",
        update: false,
      }),
      { diffPixels: 0, totalPixels: 2 },
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("visual comparison accepts the exact pixel-ratio boundary", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    const baselinePath = join(directory, "baseline.png");
    await writePng(actualPath, [WHITE, WHITE]);
    await writePng(baselinePath, [BLACK, WHITE]);

    assertEquals(
      await compareVisualSnapshot({
        actualPath,
        artifactDirectory: join(directory, "artifacts"),
        baselinePath,
        maxDiffPixelRatio: 0.5,
        snapshotName: "boundary",
        update: false,
      }),
      { diffPixels: 1, totalPixels: 2 },
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("visual comparison updates a missing baseline intentionally", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    const baselinePath = join(directory, "baselines", "updated.png");
    const expected = new Uint8Array(pngBytes([BLACK, WHITE]));
    await Deno.writeFile(actualPath, expected);

    assertEquals(
      await compareVisualSnapshot({
        actualPath,
        artifactDirectory: join(directory, "artifacts"),
        baselinePath,
        maxDiffPixelRatio: 0,
        snapshotName: "updated",
        update: true,
      }),
      { diffPixels: 0, totalPixels: 2 },
    );
    assertEquals(await Deno.readFile(baselinePath), expected);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("visual comparison rejects a missing baseline outside update mode", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    await writePng(actualPath, [BLACK]);

    await assertRejects(
      () =>
        compareVisualSnapshot({
          actualPath,
          artifactDirectory: join(directory, "artifacts"),
          baselinePath: join(directory, "missing.png"),
          maxDiffPixelRatio: 0,
          snapshotName: "missing",
          update: false,
        }),
      Error,
      "baseline is missing",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("visual comparison rejects a tolerance outside zero through one", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    const baselinePath = join(directory, "baseline.png");
    await writePng(actualPath, [BLACK]);
    await writePng(baselinePath, [BLACK]);

    await assertRejects(
      () =>
        compareVisualSnapshot({
          actualPath,
          artifactDirectory: join(directory, "artifacts"),
          baselinePath,
          maxDiffPixelRatio: 1.01,
          snapshotName: "invalid-tolerance",
          update: false,
        }),
      RangeError,
      "maxDiffPixelRatio must be between 0 and 1",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("visual comparison writes actual, expected, and diff artifacts on failure", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const actualPath = join(directory, "actual.png");
    const baselinePath = join(directory, "baseline.png");
    const artifactDirectory = join(directory, "artifacts");
    await writePng(actualPath, [WHITE, WHITE]);
    await writePng(baselinePath, [WHITE]);

    await assertRejects(
      () =>
        compareVisualSnapshot({
          actualPath,
          artifactDirectory,
          baselinePath,
          maxDiffPixelRatio: 0,
          snapshotName: "failed",
          update: false,
        }),
      Error,
      "1 of 2 pixels",
    );
    for (const suffix of ["actual", "diff", "expected"]) {
      const artifact = await Deno.readFile(join(artifactDirectory, `failed-${suffix}.png`));
      const decoded = PNG.sync.read(Buffer.from(artifact));
      if (suffix === "diff") assertEquals(decoded.width, 2);
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
