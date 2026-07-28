import { assertEquals } from "@std/assert";
import { ICON_SIZES, placeholderIconPng } from "./icons.ts";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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

Deno.test("placeholderIconPng - starts with the PNG signature", async () => {
  const png = await placeholderIconPng(16);
  assertEquals(Array.from(png.slice(0, 8)), PNG_SIGNATURE);
});

Deno.test("placeholderIconPng - chunk sequence is IHDR, IDAT, IEND", async () => {
  const png = await placeholderIconPng(16);
  assertEquals(readChunkTypes(png), ["IHDR", "IDAT", "IEND"]);
});

Deno.test("placeholderIconPng - IHDR declares the requested size, 8-bit RGBA", async () => {
  const size = 48;
  const png = await placeholderIconPng(size);
  const ihdrStart = 8 + 4 + 4; // past signature, IHDR length, IHDR type
  const view = new DataView(png.buffer, png.byteOffset + ihdrStart, 13);
  assertEquals(view.getUint32(0), size);
  assertEquals(view.getUint32(4), size);
  assertEquals(view.getUint8(8), 8); // bit depth
  assertEquals(view.getUint8(9), 6); // color type: RGBA
});

Deno.test("placeholderIconPng - every settled manifest icon size encodes without throwing", async () => {
  for (const size of ICON_SIZES) {
    const png = await placeholderIconPng(size);
    assertEquals(Array.from(png.slice(0, 8)), PNG_SIGNATURE);
  }
});
