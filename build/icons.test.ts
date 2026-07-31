import { assertEquals } from "@std/assert";
import { extensionIconPng, ICON_SIZES } from "./icons.ts";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const VIEWFINDER_BLUE = [0x4f, 0x7c, 0xff, 0xff];

function readChunkTypes(png: Uint8Array): string[] {
  const types: string[] = [];
  let offset = 8; // past the signature
  while (offset < png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    types.push(type);
    offset += 4 + 4 + length + 4; // length + type + data + crc
  }
  return types;
}

async function decodePixels(png: Uint8Array): Promise<Uint8Array> {
  const idatParts: Uint8Array[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    if (type === "IDAT") idatParts.push(png.slice(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const compressedLength = idatParts.reduce((total, part) => total + part.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const part of idatParts) {
    compressed.set(part, compressedOffset);
    compressedOffset += part.length;
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate"));
  const decoded = new Uint8Array(await new Response(stream).arrayBuffer());
  const size = new DataView(png.buffer, png.byteOffset + 16, 4).getUint32(0);
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    const sourceOffset = row * (1 + size * 4);
    assertEquals(decoded[sourceOffset], 0, "generated icon rows use the none PNG filter");
    pixels.set(decoded.subarray(sourceOffset + 1, sourceOffset + 1 + size * 4), row * size * 4);
  }
  return pixels;
}

function pixelAt(pixels: Uint8Array, size: number, x: number, y: number): number[] {
  const offset = (y * size + x) * 4;
  return Array.from(pixels.subarray(offset, offset + 4));
}

Deno.test("extensionIconPng - starts with the PNG signature", async () => {
  const png = await extensionIconPng(16);
  assertEquals(Array.from(png.slice(0, 8)), PNG_SIGNATURE);
});

Deno.test("extensionIconPng - chunk sequence is IHDR, IDAT, IEND", async () => {
  const png = await extensionIconPng(16);
  assertEquals(readChunkTypes(png), ["IHDR", "IDAT", "IEND"]);
});

Deno.test("extensionIconPng - IHDR declares the requested size, 8-bit RGBA", async () => {
  const size = 48;
  const png = await extensionIconPng(size);
  const ihdrStart = 8 + 4 + 4; // past signature, IHDR length, IHDR type
  const view = new DataView(png.buffer, png.byteOffset + ihdrStart, 13);
  assertEquals(view.getUint32(0), size);
  assertEquals(view.getUint32(4), size);
  assertEquals(view.getUint8(8), 8); // bit depth
  assertEquals(view.getUint8(9), 6); // color type: RGBA
});

Deno.test("extensionIconPng - every settled manifest icon size encodes without throwing", async () => {
  for (const size of ICON_SIZES) {
    const png = await extensionIconPng(size);
    assertEquals(Array.from(png.slice(0, 8)), PNG_SIGNATURE);
  }
});

Deno.test("extensionIconPng - renders the transparent viewfinder brand mark", async () => {
  const size = 48;
  const pixels = await decodePixels(await extensionIconPng(size));

  assertEquals(pixelAt(pixels, size, 0, 0), [0, 0, 0, 0]);
  assertEquals(pixelAt(pixels, size, 6, 10), VIEWFINDER_BLUE);
  assertEquals(pixelAt(pixels, size, 24, 10), [0, 0, 0, 0]);
  assertEquals(pixelAt(pixels, size, 24, 24), VIEWFINDER_BLUE);
});
