import { dirname, join } from "@std/path";
import { Buffer } from "node:buffer";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Input paths and tolerance for one visual snapshot comparison. */
export interface VisualSnapshotOptions {
  readonly actualPath: string;
  readonly artifactDirectory: string;
  readonly baselinePath: string;
  readonly maxDiffPixelRatio: number;
  readonly snapshotName: string;
  readonly update: boolean;
}

/** Pixel counts observed while comparing one visual snapshot. */
export interface VisualSnapshotResult {
  readonly diffPixels: number;
  readonly totalPixels: number;
}

interface DecodedPng {
  readonly data: Uint8Array;
  readonly height: number;
  readonly width: number;
}

interface PngDifference extends VisualSnapshotResult {
  readonly image: PNG;
}

async function readPng(path: string): Promise<DecodedPng> {
  const decoded = PNG.sync.read(Buffer.from(await Deno.readFile(path)));
  return {
    data: decoded.data,
    height: decoded.height,
    width: decoded.width,
  };
}

function paddedPixels(image: DecodedPng, width: number, height: number): Uint8Array {
  if (image.width === width && image.height === height) return image.data;
  const padded = new Uint8Array(width * height * 4);
  for (let row = 0; row < image.height; row += 1) {
    const sourceStart = row * image.width * 4;
    const targetStart = row * width * 4;
    padded.set(
      image.data.subarray(sourceStart, sourceStart + image.width * 4),
      targetStart,
    );
  }
  return padded;
}

function comparePngs(expected: DecodedPng, actual: DecodedPng): PngDifference {
  const width = Math.max(actual.width, expected.width);
  const height = Math.max(actual.height, expected.height);
  const totalPixels = width * height;
  const image = new PNG({ height, width });
  const diffPixels = pixelmatch(
    paddedPixels(expected, width, height),
    paddedPixels(actual, width, height),
    image.data,
    width,
    height,
    { includeAA: false, threshold: 0.1 },
  );
  return { diffPixels, image, totalPixels };
}

async function readBaseline(path: string, snapshotName: string): Promise<DecodedPng> {
  try {
    return await readPng(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    throw new Error(
      `visual baseline is missing for ${snapshotName}; run deno task visual:update`,
    );
  }
}

async function writeFailureArtifacts(
  options: VisualSnapshotOptions,
  difference: PngDifference,
): Promise<void> {
  await Deno.mkdir(options.artifactDirectory, { recursive: true });
  await Promise.all([
    Deno.copyFile(
      options.actualPath,
      join(options.artifactDirectory, `${options.snapshotName}-actual.png`),
    ),
    Deno.writeFile(
      join(options.artifactDirectory, `${options.snapshotName}-diff.png`),
      PNG.sync.write(difference.image),
    ),
    Deno.copyFile(
      options.baselinePath,
      join(options.artifactDirectory, `${options.snapshotName}-expected.png`),
    ),
  ]);
}

/**
 * Compares a captured PNG with its committed baseline.
 *
 * @param options Snapshot paths, tolerance, and update behavior.
 * @returns Pixel counts from the comparison.
 */
export async function compareVisualSnapshot(
  options: VisualSnapshotOptions,
): Promise<VisualSnapshotResult> {
  if (options.maxDiffPixelRatio < 0 || options.maxDiffPixelRatio > 1) {
    throw new RangeError("maxDiffPixelRatio must be between 0 and 1");
  }

  const actual = await readPng(options.actualPath);
  if (options.update) {
    await Deno.mkdir(dirname(options.baselinePath), { recursive: true });
    await Deno.copyFile(options.actualPath, options.baselinePath);
    return { diffPixels: 0, totalPixels: actual.width * actual.height };
  }

  const expected = await readBaseline(options.baselinePath, options.snapshotName);
  const difference = comparePngs(expected, actual);
  if (difference.diffPixels / difference.totalPixels <= options.maxDiffPixelRatio) {
    return {
      diffPixels: difference.diffPixels,
      totalPixels: difference.totalPixels,
    };
  }

  await writeFailureArtifacts(options, difference);
  throw new Error(
    `visual snapshot ${options.snapshotName} changed: ${difference.diffPixels} of ` +
      `${difference.totalPixels} pixels exceed the ${options.maxDiffPixelRatio} ratio`,
  );
}
