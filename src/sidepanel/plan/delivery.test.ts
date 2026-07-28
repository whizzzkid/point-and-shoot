/// <reference lib="dom" />

import { assert, assertEquals, assertRejects } from "@std/assert";
import { EXPORT_FIXTURE_SESSION } from "../../shared/serialize/fixture.ts";
import { copySessionPrompt, downloadSessionArchive, exportFilename } from "./delivery.ts";

Deno.test("downloadSessionArchive delivers a ZIP through downloads and revokes its object URL", async () => {
  const calls: string[] = [];
  let deliveredBlob: Blob | undefined;

  const downloadId = await downloadSessionArchive(EXPORT_FIXTURE_SESSION, {}, {
    clipboard: { writeText: () => Promise.resolve() },
    createObjectURL(blob) {
      deliveredBlob = blob;
      calls.push("create");
      return "blob:export";
    },
    downloads: {
      download(options) {
        assertEquals(options, {
          filename: "point-and-shoot/checkout-review.zip",
          saveAs: true,
          url: "blob:export",
        });
        calls.push("download");
        return Promise.resolve(42);
      },
    },
    revokeObjectURL(url) {
      assertEquals(url, "blob:export");
      calls.push("revoke");
    },
  });

  assertEquals(downloadId, 42);
  assert(deliveredBlob !== undefined);
  assertEquals(deliveredBlob.type, "application/zip");
  assertEquals((await deliveredBlob.arrayBuffer()).byteLength > 0, true);
  assertEquals(calls, ["create", "download", "revoke"]);
});

Deno.test("downloadSessionArchive revokes the URL when downloads rejects", async () => {
  const calls: string[] = [];

  await assertRejects(
    () =>
      downloadSessionArchive(EXPORT_FIXTURE_SESSION, {}, {
        clipboard: { writeText: () => Promise.resolve() },
        createObjectURL: () => "blob:failed-export",
        downloads: {
          download: () => Promise.reject(new Error("Downloads permission denied.")),
        },
        revokeObjectURL(url) {
          calls.push(url);
        },
      }),
    Error,
    "Downloads permission denied.",
  );
  assertEquals(calls, ["blob:failed-export"]);
});

Deno.test("copySessionPrompt writes image-free, privacy-projected Markdown", async () => {
  let clipboardText = "";

  await copySessionPrompt(EXPORT_FIXTURE_SESSION, {
    includedNoteIds: new Set(["note-button"]),
  }, {
    clipboard: {
      writeText(text) {
        clipboardText = text;
        return Promise.resolve();
      },
    },
    createObjectURL: () => "blob:unused",
    downloads: { download: () => Promise.resolve(1) },
    revokeObjectURL: () => undefined,
  });

  assertEquals(clipboardText.includes("primary action"), true);
  assertEquals(clipboardText.includes("shots/"), false);
  assertEquals(clipboardText.includes("secret"), false);
  assertEquals(clipboardText.includes("total wraps"), false);
});

Deno.test("exportFilename creates a stable, safe name with a fallback", () => {
  assertEquals(exportFilename(EXPORT_FIXTURE_SESSION), "point-and-shoot/checkout-review.zip");
  assertEquals(
    exportFilename({ ...EXPORT_FIXTURE_SESSION, name: "  <>  " }),
    "point-and-shoot/session-checkout.zip",
  );
});
