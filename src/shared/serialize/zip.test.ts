import { assertEquals, assertThrows } from "@std/assert";
import { EXPORT_FIXTURE_SESSION } from "./fixture.ts";
import { createExportArchive } from "./zip.ts";

const decoder = new TextDecoder();

function readStoredEntries(archive: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const entries = new Map<string, Uint8Array>();
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength));
    entries.set(name, archive.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }

  return entries;
}

Deno.test("createExportArchive writes only the canonical bundle entries", () => {
  const entries = readStoredEntries(createExportArchive(EXPORT_FIXTURE_SESSION));

  assertEquals([...entries.keys()], [
    "session.json",
    "plan.md",
    "shots/note-01.webp",
    "shots/note-02.webp",
  ]);
  const markdown = decoder.decode(entries.get("plan.md"));
  assertEquals(markdown.includes("./shots/note-01.webp"), true);
  assertEquals(entries.has("shots/note-01.webp"), true);
  assertEquals(markdown.includes("./shots/note-02.webp"), true);
  assertEquals(entries.has("shots/note-02.webp"), true);
  assertEquals(decoder.decode(entries.get("session.json")).includes("secret"), false);
  const screenshot = entries.get("shots/note-01.webp");
  assertEquals(decoder.decode(screenshot?.slice(0, 4)), "RIFF");
  assertEquals(decoder.decode(screenshot?.slice(8, 12)), "WEBP");
});

Deno.test("createExportArchive applies the same inclusion set to every projection", () => {
  const entries = readStoredEntries(
    createExportArchive(EXPORT_FIXTURE_SESSION, {
      includedNoteIds: new Set(["note-summary"]),
    }),
  );

  assertEquals([...entries.keys()], [
    "session.json",
    "plan.md",
    "shots/note-01.webp",
  ]);
  assertEquals(decoder.decode(entries.get("plan.md")).includes("primary action"), false);
  assertEquals(
    JSON.parse(decoder.decode(entries.get("session.json"))).notes.map(
      (note: { readonly id: string }) => note.id,
    ),
    ["note-summary"],
  );
});

Deno.test("createExportArchive is deterministic and rejects malformed screenshots", () => {
  assertEquals(
    createExportArchive(EXPORT_FIXTURE_SESSION),
    createExportArchive(EXPORT_FIXTURE_SESSION),
  );
  const note = EXPORT_FIXTURE_SESSION.notes[0];
  if (note === undefined) throw new Error("export fixture is missing note-button");
  assertThrows(
    () =>
      createExportArchive({
        ...EXPORT_FIXTURE_SESSION,
        notes: [{
          ...note,
          region: { ...note.region, screenshot: "data:image/png;base64,AAAA" },
        }],
      }),
    TypeError,
    "Screenshot must be a base64 WebP data URL",
  );
  assertThrows(
    () =>
      createExportArchive({
        ...EXPORT_FIXTURE_SESSION,
        notes: [{
          ...note,
          region: {
            ...note.region,
            screenshot: "data:image/webp;base64,V0VCUA==",
          },
        }],
      }),
    TypeError,
    "Screenshot data does not contain a WebP image",
  );
});
