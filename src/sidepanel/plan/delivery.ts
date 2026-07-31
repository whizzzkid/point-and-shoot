/// <reference lib="dom" />

import type { BrowserShim } from "../../shared/browser.ts";
import type { Session } from "../../shared/schema.ts";
import type { SerializeOptions } from "../../shared/serialize/index.ts";
import { toMarkdown } from "../../shared/serialize/index.ts";
import { createExportArchive } from "../../shared/serialize/zip.ts";

/** Browser-owned capabilities used to copy or download an export. */
export interface ExportDeliveryDependencies {
  readonly clipboard: { writeText(text: string): Promise<void> };
  readonly createObjectURL: (blob: Blob) => string;
  readonly downloads: BrowserShim["downloads"];
  readonly revokeObjectURL: (url: string) => void;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

/**
 * Returns the download path used for a session archive.
 *
 * @param session Session being exported.
 * @returns A safe filename under the Point & Shoot downloads folder.
 */
export function exportFilename(session: Session): string {
  return `point-and-shoot/${slug(session.name) || slug(session.id) || "session"}.zip`;
}

/**
 * Returns the download path used for a standalone Markdown prompt.
 *
 * @param session Session being exported.
 * @returns A safe filename under the Point & Shoot downloads folder.
 */
export function promptFilename(session: Session): string {
  return `point-and-shoot/${slug(session.name) || slug(session.id) || "session"}.md`;
}

async function downloadBlob(
  blob: Blob,
  filename: string,
  dependencies: ExportDeliveryDependencies,
): Promise<number> {
  const objectUrl = dependencies.createObjectURL(blob);
  try {
    return await dependencies.downloads.download({
      filename,
      saveAs: true,
      url: objectUrl,
    });
  } finally {
    dependencies.revokeObjectURL(objectUrl);
  }
}

/**
 * Builds and downloads the selected session notes as a ZIP archive.
 *
 * @param session Validated session record.
 * @param options Per-note inclusion selection.
 * @param dependencies Browser download and object-URL capabilities.
 * @returns The browser-assigned download id.
 */
export async function downloadSessionArchive(
  session: Session,
  options: SerializeOptions,
  dependencies: ExportDeliveryDependencies,
): Promise<number> {
  const archive = createExportArchive(session, options);
  const archiveBuffer = archive.slice().buffer as ArrayBuffer;
  return await downloadBlob(
    new Blob([archiveBuffer], { type: "application/zip" }),
    exportFilename(session),
    dependencies,
  );
}

/**
 * Downloads the selected notes as standalone image-free Markdown.
 *
 * @param session Validated session record.
 * @param options Per-note inclusion selection.
 * @param dependencies Browser download and object-URL capabilities.
 * @returns The browser-assigned download id.
 */
export async function downloadSessionPrompt(
  session: Session,
  options: SerializeOptions,
  dependencies: ExportDeliveryDependencies,
): Promise<number> {
  const markdown = toMarkdown(session, { ...options, includeImageReferences: false });
  return await downloadBlob(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    promptFilename(session),
    dependencies,
  );
}

/**
 * Copies the selected notes as image-free Markdown for pasting into an agent chat.
 *
 * @param session Validated session record.
 * @param options Per-note inclusion selection.
 * @param dependencies Clipboard capability.
 * @returns A promise that settles once the browser clipboard write finishes.
 */
export function copySessionPrompt(
  session: Session,
  options: SerializeOptions,
  dependencies: ExportDeliveryDependencies,
): Promise<void> {
  return dependencies.clipboard.writeText(
    toMarkdown(session, { ...options, includeImageReferences: false }),
  );
}
