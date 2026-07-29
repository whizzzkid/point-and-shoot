import type { Session } from "../schema.ts";
import { type SerializeOptions, shotPath, toJson, toMarkdown } from "./index.ts";

interface ZipEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

const encoder = new TextEncoder();
const UTF8_FLAG = 0x0800;
const DOS_DATE_1980_01_01 = 33;

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(
  name: Uint8Array,
  bytes: Uint8Array,
  checksum: number,
): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, DOS_DATE_1980_01_01, true);
  view.setUint32(14, checksum, true);
  view.setUint32(18, bytes.byteLength, true);
  view.setUint32(22, bytes.byteLength, true);
  view.setUint16(26, name.byteLength, true);
  view.setUint16(28, 0, true);
  return header;
}

function centralHeader(
  name: Uint8Array,
  bytes: Uint8Array,
  checksum: number,
  localOffset: number,
): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, DOS_DATE_1980_01_01, true);
  view.setUint32(16, checksum, true);
  view.setUint32(20, bytes.byteLength, true);
  view.setUint32(24, bytes.byteLength, true);
  view.setUint16(28, name.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  return header;
}

function endOfCentralDirectory(
  entryCount: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return footer;
}

function createStoredZip(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length > 0xffff) throw new RangeError("ZIP entry count exceeds 65,535");

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    if (entry.bytes.byteLength > 0xffffffff) {
      throw new RangeError(`ZIP entry ${entry.name} exceeds 4 GB`);
    }
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = concatenate([localHeader(name, entry.bytes, checksum), name, entry.bytes]);
    const central = concatenate([
      centralHeader(name, entry.bytes, checksum, localOffset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    localOffset += local.byteLength;
  }

  const central = concatenate(centrals);
  return concatenate([
    ...locals,
    central,
    endOfCentralDirectory(entries.length, central.byteLength, localOffset),
  ]);
}

function decodeWebpDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (match?.[1] === undefined) {
    throw new TypeError("Screenshot must be a base64 WebP data URL");
  }
  let decoded: string;
  try {
    decoded = atob(match[1]);
  } catch (cause) {
    throw new TypeError("Screenshot contains invalid base64", { cause });
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const isWebp = bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  const declaredSize = isWebp
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8
    : 0;
  if (!isWebp || declaredSize > bytes.byteLength) {
    throw new TypeError("Screenshot data does not contain a WebP image");
  }
  return bytes;
}

function selectedNotes(session: Session, options: SerializeOptions): Session["notes"] {
  if (options.includedNoteIds === undefined) return session.notes;
  return session.notes.filter((note) => options.includedNoteIds?.has(note.id));
}

/**
 * Creates the deterministic ZIP delivered to the browser downloads API.
 *
 * @param session Validated session record.
 * @param options Optional per-note inclusion selection.
 * @returns Store-only ZIP bytes containing JSON, Markdown, and one WebP per included note.
 */
export function createExportArchive(
  session: Session,
  options: SerializeOptions = {},
): Uint8Array {
  const notes = selectedNotes(session, options);
  const entries: ZipEntry[] = [
    { name: "session.json", bytes: encoder.encode(toJson(session, options)) },
    {
      name: "plan.md",
      bytes: encoder.encode(toMarkdown(session, { ...options, includeImageReferences: true })),
    },
    ...notes.map((note, index) => ({
      name: shotPath(index, notes.length),
      bytes: decodeWebpDataUrl(note.region.screenshot),
    })),
  ];
  return createStoredZip(entries);
}
