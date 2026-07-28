/// <reference lib="dom" />

import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker.tsx";
import type { SelectionRect } from "./picker/engine.ts";
import { FloatingToolbar, type ToolbarTool } from "./toolbar/FloatingToolbar.tsx";

/** Props accepted by {@link CaptureOverlay}. */
export interface CaptureOverlayProps {
  readonly iconSpriteUrl: string;
  readonly noteCount?: number;
  readonly onPreviewChange?: (rect: SelectionRect | undefined) => void;
  readonly onSelection?: (selection: PickerSelection) => void;
  readonly onSend?: () => void;
  readonly ownerDocument?: Document;
  readonly ownerWindow?: Window;
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
    onPreviewChange,
    onSelection,
    onSend,
    ownerDocument = document,
    ownerWindow = window,
  }: CaptureOverlayProps,
): JSX.Element {
  const [activeTool, setActiveTool] = useState<ToolbarTool | null>("select");
  const [selection, setSelection] = useState<SelectionRect>();
  const handlePreviewChange = (rect: SelectionRect | undefined): void => {
    setSelection(rect);
    onPreviewChange?.(rect);
  };

  return (
    <>
      <ElementPicker
        active={activeTool === "select"}
        onExit={() => setActiveTool(null)}
        onPreviewChange={handlePreviewChange}
        ownerDocument={ownerDocument}
        ownerWindow={ownerWindow}
        {...(onSelection === undefined ? {} : { onSelection })}
      />
      <FloatingToolbar
        activeTool={activeTool}
        iconSpriteUrl={iconSpriteUrl}
        noteCount={noteCount}
        onToolChange={setActiveTool}
        ownerDocument={ownerDocument}
        ownerWindow={ownerWindow}
        {...(onSend === undefined ? {} : { onSend })}
        {...(selection === undefined ? {} : { selection })}
      />
    </>
  );
}
