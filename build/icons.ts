/**
 * Generates the four placeholder extension icon PNGs (`manifestBase.icons`' 16/32/48/128px set) as
 * a flat brand-color square. No real icon asset has been vendored from `.claude-design/` yet —
 * this keeps the build unblocked the same way W2.3's placeholder HTML shells do; a later wave
 * replaces this with a real rasterized export of `.claude-design/point-and-shoot/assets/icon.svg`.
 *
 * @module
 */

/** The sizes `manifestBase.icons` declares in `build/manifest.ts`. */
export const ICON_SIZES = [16, 32, 48, 128] as const;

/** Space Grotesk brand indigo, matched to `.claude-design/point-and-shoot/assets/icon.svg`. */
const BRAND_RGB: readonly [number, number, number] = [79, 70, 229];

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

/** Encodes a flat-color `size`x`size` RGBA PNG. */
export async function placeholderIconPng(size: number): Promise<Uint8Array> {
  const [r, g, b] = BRAND_RGB;
  const raw = new Uint8Array(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
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
