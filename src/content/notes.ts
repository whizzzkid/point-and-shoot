/// <reference lib="dom" />

import {
  ADD_NOTE_MESSAGE,
  type AddNoteRequest,
  type AddNoteResponse,
  isAddNoteResponse,
} from "../shared/messages.ts";
import type { NoteElement, RegionCapture } from "../shared/schema.ts";
import type { PickerSelection } from "./picker/ElementPicker.tsx";

/** Runtime message surface consumed by {@link saveCapturedSelection}. */
export interface NoteMessageRuntime {
  sendMessage(message: unknown): Promise<unknown>;
}

/** Page identity recorded with one captured note. */
export interface CapturedPage {
  readonly title: string;
  readonly url: string;
}

/** A typed failure returned by captured-note persistence or its message channel. */
export class NoteSaveError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NoteSaveError";
    this.cause = cause;
  }
}

function serializableElements(selection: PickerSelection): readonly NoteElement[] {
  if (selection.kind === "unreachable") {
    return [{
      selectors: {
        reachable: false,
        tagClasses: "iframe",
        testIds: [],
        textSnippet: "",
        unreachable: selection.reason,
      },
      styleDigest: null,
    }];
  }
  return selection.elements.map(({ componentHint, selectors, styleDigest }) => ({
    ...(componentHint === undefined ? {} : { componentHint }),
    selectors,
    styleDigest,
  }));
}

/**
 * Serializes picker evidence and durably appends a captured note in the background context.
 *
 * @param runtime Promise-based extension message channel.
 * @param capture Completed region screenshot.
 * @param selection Picker evidence to strip of live DOM references.
 * @param page Full recorded page identity.
 * @returns Durable note and session identifiers plus the current note count.
 * @throws {@link NoteSaveError} when the message channel or storage operation fails.
 */
export async function saveCapturedSelection(
  runtime: NoteMessageRuntime,
  capture: RegionCapture,
  selection: PickerSelection,
  page: CapturedPage,
): Promise<Extract<AddNoteResponse, { readonly ok: true }>> {
  const request: AddNoteRequest = {
    capture,
    elements: serializableElements(selection),
    pageTitle: page.title,
    pageUrl: page.url,
    type: ADD_NOTE_MESSAGE,
  };
  let response: unknown;
  try {
    response = await runtime.sendMessage(request);
  } catch (cause) {
    throw new NoteSaveError("The captured note could not reach extension storage.", cause);
  }
  if (!isAddNoteResponse(response)) {
    throw new NoteSaveError("The background context returned an invalid note response.");
  }
  if (!response.ok) throw new NoteSaveError(response.error.message);
  return response;
}
