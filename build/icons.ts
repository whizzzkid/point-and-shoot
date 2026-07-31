/** Generates the raster extension icons declared by `manifestBase.icons`. */

/** The sizes `manifestBase.icons` declares in `build/manifest.ts`. */
export const ICON_SIZES = [16, 32, 48, 128] as const;

/** Viewfinder blue from `.claude-design/point-and-shoot/assets/icon.svg`. */
const BRAND_RGB: readonly [number, number, number] = [0x4f, 0x7c, 0xff];
const SOURCE_SIZE = 48;
const SOURCE_CENTER = SOURCE_SIZE / 2;
const CORNER_INSET = 6;
const CORNER_RADIUS = 4;
const CORNER_END = 16;
const CENTER_DOT_RADIUS = 5;
const STROKE_RADIUS = 1.5;
const SAMPLES_PER_AXIS = 4;

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const tableEntry = CRC_TABLE[(crc ^ byte) & 0xff];
    crc = (tableEntry ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const crcInput = concat([typeBytes, data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(crcInput));
  return concat([length, crcInput, crc]);
}

/** zlib-format (RFC 1950) deflate — the compression PNG's `IDAT` chunk requires. */
async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  const writeDone = writer.write(data as Uint8Array<ArrayBuffer>);
  const closeDone = writer.close();
  const chunks: Uint8Array[] = [];
  for await (const part of stream.readable) chunks.push(part as Uint8Array);
  await writeDone;
  await closeDone;
  return concat(chunks);
}

function distanceToSegment(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;
  const projection = Math.min(
    1,
    Math.max(0, ((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared),
  );
  return Math.hypot(
    x - (startX + projection * segmentX),
    y - (startY + projection * segmentY),
  );
}

function isViewfinderPoint(x: number, y: number): boolean {
  if (Math.hypot(x - SOURCE_CENTER, y - SOURCE_CENTER) <= CENTER_DOT_RADIUS) return true;

  const cornerX = x > SOURCE_CENTER ? SOURCE_SIZE - x : x;
  const cornerY = y > SOURCE_CENTER ? SOURCE_SIZE - y : y;
  const verticalDistance = distanceToSegment(
    cornerX,
    cornerY,
    CORNER_INSET,
    CORNER_END,
    CORNER_INSET,
    CORNER_INSET + CORNER_RADIUS,
  );
  const horizontalDistance = distanceToSegment(
    cornerX,
    cornerY,
    CORNER_INSET + CORNER_RADIUS,
    CORNER_INSET,
    CORNER_END,
    CORNER_INSET,
  );
  const arcDistance = cornerX <= CORNER_INSET + CORNER_RADIUS &&
      cornerY <= CORNER_INSET + CORNER_RADIUS
    ? Math.abs(
      Math.hypot(
        cornerX - (CORNER_INSET + CORNER_RADIUS),
        cornerY - (CORNER_INSET + CORNER_RADIUS),
      ) - CORNER_RADIUS,
    )
    : Number.POSITIVE_INFINITY;
  return Math.min(verticalDistance, horizontalDistance, arcDistance) <= STROKE_RADIUS;
}

function coverageAt(size: number, pixelX: number, pixelY: number): number {
  let coveredSamples = 0;
  for (let sampleY = 0; sampleY < SAMPLES_PER_AXIS; sampleY++) {
    for (let sampleX = 0; sampleX < SAMPLES_PER_AXIS; sampleX++) {
      const sourceX = (pixelX + (sampleX + 0.5) / SAMPLES_PER_AXIS) * SOURCE_SIZE / size;
      const sourceY = (pixelY + (sampleY + 0.5) / SAMPLES_PER_AXIS) * SOURCE_SIZE / size;
      if (isViewfinderPoint(sourceX, sourceY)) coveredSamples++;
    }
  }
  return coveredSamples / SAMPLES_PER_AXIS ** 2;
}

/**
 * Rasterizes the design-system viewfinder mark into an antialiased RGBA PNG.
 *
 * @param size Square output dimension in pixels.
 * @returns Encoded PNG bytes.
 */
export async function extensionIconPng(size: number): Promise<Uint8Array> {
  const [r, g, b] = BRAND_RGB;
  const raw = new Uint8Array(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const alpha = Math.round(coverageAt(size, x, y) * 255);
      raw[offset++] = alpha === 0 ? 0 : r;
      raw[offset++] = alpha === 0 ? 0 : g;
      raw[offset++] = alpha === 0 ? 0 : b;
      raw[offset++] = alpha;
    }
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size);
  ihdrView.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const idat = await zlibDeflate(raw);
  return concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}
