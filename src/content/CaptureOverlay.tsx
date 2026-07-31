/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Button, Input } from "../ui/components/index.ts";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker.tsx";
import type { SelectionRect } from "./picker/engine.ts";
import { FloatingToolbar, type ToolbarTool } from "./toolbar/FloatingToolbar.tsx";

const COMPOSER_EDGE_GAP = 12;
const COMPOSER_GAP = 10;
const COMPOSER_HEIGHT = 216;
const COMPOSER_WIDTH = 320;

/** Props accepted by {@link CaptureOverlay}. */
export interface CaptureOverlayProps {
  readonly iconSpriteUrl: string;
  readonly noteCount?: number;
  readonly onCancel?: () => void;
  readonly onDismiss?: () => void;
  readonly onPreviewChange?: (rect: SelectionRect | undefined) => void;
  readonly onSave?: (text: string) => Promise<void>;
  readonly onSelection?: (selection: PickerSelection) => Promise<void> | void;
  readonly onSend?: () => void;
  readonly ownerDocument?: Document;
  readonly ownerWindow?: Window;
  readonly version: string;
}

/**
 * Coordinates the floating toolbar with the active in-page capture tool.
 *
 * @param props Icon resource, note state, capture callbacks, and DOM owners.
 * @returns The toolbar and its active picker layer.
 */
export function CaptureOverlay(
  {
    iconSpriteUrl,
    noteCount = 0,
    onCancel,
    onDismiss,
    onPreviewChange,
    onSave,
    onSelection,
    onSend,
    ownerDocument = document,
    ownerWindow = window,
    version,
  }: CaptureOverlayProps,
): JSX.Element | null {
  const [activeTool, setActiveTool] = useState<ToolbarTool | null>("select");
  const [preview, setPreview] = useState<SelectionRect>();
  const [selection, setSelection] = useState<SelectionRect>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string>();
  const [focusToolbar, setFocusToolbar] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const composerInput = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const previousFocus = useRef<HTMLElement>();
  const handlePreviewChange = (rect: SelectionRect | undefined): void => {
    setPreview(rect);
    onPreviewChange?.(rect);
  };
  const dismiss = (): void => {
    setDismissed(true);
    onCancel?.();
    onDismiss?.();
  };
  const cancel = (): void => {
    setComposerOpen(false);
    setPreview(undefined);
    setSelection(undefined);
    setNoteText("");
    setError(undefined);
    setActiveTool("select");
    const focusTarget = previousFocus.current;
    setFocusToolbar(focusTarget === undefined);
    if (focusTarget !== undefined) {
      ownerWindow.requestAnimationFrame(() => focusTarget.focus());
    }
    onCancel?.();
  };
  const beginSelection = async (nextSelection: PickerSelection): Promise<void> => {
    const activeElement = ownerDocument.activeElement;
    previousFocus.current = activeElement instanceof HTMLElement &&
        activeElement !== ownerDocument.body &&
        activeElement !== ownerDocument.documentElement &&
        !activeElement.matches("[data-point-and-shoot-host]")
      ? activeElement
      : undefined;
    setActiveTool(null);
    setFocusToolbar(false);
    setSelection(nextSelection.region);
    setError(undefined);
    try {
      await onSelection?.(nextSelection);
      setComposerOpen(true);
    } catch (cause) {
      setSelection(undefined);
      setActiveTool("select");
      setError(cause instanceof Error ? cause.message : "The selected area could not be captured.");
    }
  };
  const save = async (text: string): Promise<void> => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave?.(text);
      cancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const composer = selection === undefined ? undefined : {
    height: COMPOSER_HEIGHT,
    left: Math.max(
      COMPOSER_EDGE_GAP,
      Math.min(selection.left, ownerWindow.innerWidth - COMPOSER_WIDTH - COMPOSER_EDGE_GAP),
    ),
    top: Math.max(
      COMPOSER_EDGE_GAP,
      Math.min(
        selection.top + selection.height + COMPOSER_GAP,
        ownerWindow.innerHeight - COMPOSER_HEIGHT - COMPOSER_EDGE_GAP,
      ),
    ),
    width: COMPOSER_WIDTH,
  };
  const toolbarSelection = selection ?? preview;

  useEffect(() => {
    if (activeTool !== null) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    return () => ownerDocument.removeEventListener("keydown", handleKeyDown, true);
  }, [activeTool, ownerDocument]);
  useEffect(() => {
    if (composerOpen) composerInput.current?.focus();
  }, [composerOpen]);

  if (dismissed) return null;

  return (
    <>
      <ElementPicker
        active={activeTool === "select"}
        onExit={dismiss}
        onPreviewChange={handlePreviewChange}
        ownerDocument={ownerDocument}
        ownerWindow={ownerWindow}
        onSelection={(nextSelection) => {
          void beginSelection(nextSelection);
        }}
      />
      {activeTool === null && selection !== undefined
        ? (
          <div
            aria-hidden="true"
            className="ps-picker-highlight"
            data-kind="pinned"
            style={{
              blockSize: `${selection.height}px`,
              inlineSize: `${selection.width}px`,
              insetBlockStart: `${selection.top}px`,
              insetInlineStart: `${selection.left}px`,
            }}
          />
        )
        : null}
      {composerOpen && composer !== undefined
        ? (
          <div
            aria-label="Add note"
            className="ps-note-composer"
            role="dialog"
            style={{
              insetInlineStart: `${composer.left}px`,
              insetBlockStart: `${composer.top}px`,
            }}
          >
            <span className="ps-note-composer-label">Describe the issue</span>
            <Input
              accessibleName="Note"
              autoFocus
              elementRef={(element) => {
                composerInput.current = element;
              }}
              multiline
              onChange={setNoteText}
              placeholder="What's wrong here?"
              rows={3}
              value={noteText}
            />
            {error === undefined
              ? null
              : <p className="ps-note-composer-error" role="alert">{error}</p>}
            <div className="ps-note-composer-actions">
              <Button disabled={saving} onClick={cancel} size="sm" variant="ghost">
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void save("")} size="sm" variant="secondary">
                Save without note
              </Button>
              <Button disabled={saving} onClick={() => void save(noteText)} size="sm">
                Save note
              </Button>
            </div>
          </div>
        )
        : null}
      {error !== undefined && !composerOpen
        ? <p className="ps-capture-error" role="alert">{error}</p>
        : null}
      <FloatingToolbar
        activeTool={activeTool}
        focusSelect={focusToolbar}
        {...(composerOpen && composer !== undefined ? { composer } : {})}
        iconSpriteUrl={iconSpriteUrl}
        noteCount={noteCount}
        onToolChange={setActiveTool}
        ownerDocument={ownerDocument}
        ownerWindow={ownerWindow}
        version={version}
        {...(onSend === undefined ? {} : { onSend })}
        {...(toolbarSelection === undefined ? {} : { selection: toolbarSelection })}
      />
    </>
  );
}
