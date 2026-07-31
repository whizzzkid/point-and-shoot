/// <reference lib="dom" />

import { assert, assertEquals, assertRejects } from "@std/assert";
import { EXPORT_FIXTURE_SESSION } from "../../shared/serialize/fixture.ts";
import {
  copySessionPrompt,
  downloadSessionArchive,
  downloadSessionPrompt,
  exportFilename,
  promptFilename,
} from "./delivery.ts";

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

Deno.test("downloadSessionPrompt downloads the image-free Markdown shown in the preview", async () => {
  const calls: string[] = [];
  let deliveredBlob: Blob | undefined;

  const downloadId = await downloadSessionPrompt(EXPORT_FIXTURE_SESSION, {
    includedNoteIds: new Set(["note-button"]),
  }, {
    clipboard: { writeText: () => Promise.resolve() },
    createObjectURL(blob) {
      deliveredBlob = blob;
      calls.push("create");
      return "blob:prompt";
    },
    downloads: {
      download(options) {
        assertEquals(options, {
          filename: "point-and-shoot/checkout-review.md",
          saveAs: true,
          url: "blob:prompt",
        });
        calls.push("download");
        return Promise.resolve(84);
      },
    },
    revokeObjectURL(url) {
      assertEquals(url, "blob:prompt");
      calls.push("revoke");
    },
  });

  assertEquals(downloadId, 84);
  assert(deliveredBlob !== undefined);
  assertEquals(deliveredBlob.type, "text/markdown;charset=utf-8");
  const prompt = await deliveredBlob.text();
  assertEquals(prompt.includes("primary action"), true);
  assertEquals(prompt.includes("shots/"), false);
  assertEquals(prompt.includes("secret"), false);
  assertEquals(calls, ["create", "download", "revoke"]);
});

Deno.test("downloadSessionPrompt revokes the URL when downloads rejects", async () => {
  const calls: string[] = [];

  await assertRejects(
    () =>
      downloadSessionPrompt(EXPORT_FIXTURE_SESSION, {}, {
        clipboard: { writeText: () => Promise.resolve() },
        createObjectURL: () => "blob:failed-prompt",
        downloads: {
          download: () => Promise.reject(new Error("Prompt download was denied.")),
        },
        revokeObjectURL(url) {
          calls.push(url);
        },
      }),
    Error,
    "Prompt download was denied.",
  );
  assertEquals(calls, ["blob:failed-prompt"]);
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
  assertEquals(promptFilename(EXPORT_FIXTURE_SESSION), "point-and-shoot/checkout-review.md");
  assertEquals(
    exportFilename({ ...EXPORT_FIXTURE_SESSION, name: "  <>  " }),
    "point-and-shoot/session-checkout.zip",
  );
  assertEquals(
    promptFilename({ ...EXPORT_FIXTURE_SESSION, name: "  <>  " }),
    "point-and-shoot/session-checkout.md",
  );
});
