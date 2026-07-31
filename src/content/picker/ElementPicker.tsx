/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  capturePickerElement,
  collectDragElements,
  navigatePickerElement,
  type PickerElementCapture,
  type PickerNavigation,
  type PickerPoint,
  type PickerTarget,
  resolvePickerTarget,
  type SelectionRect,
} from "./engine.ts";

/** Completed picker output delivered to the note flow. */
export type PickerSelection =
  | {
    readonly kind: "elements";
    readonly elements: readonly PickerElementCapture[];
    readonly region: SelectionRect;
  }
  | {
    readonly kind: "unreachable";
    readonly reason: "cross-origin-iframe";
    readonly region: SelectionRect;
  };

/** Props accepted by {@link ElementPicker}. */
export interface ElementPickerProps {
  readonly active: boolean;
  readonly onExit?: () => void;
  readonly onPreviewChange?: (rect: SelectionRect | undefined) => void;
  readonly onSelection?: (selection: PickerSelection) => void;
  readonly ownerDocument?: Document;
  readonly ownerWindow?: Window;
}

interface Highlight {
  readonly kind: "hover" | "pinned" | "unreachable";
  readonly rect: SelectionRect;
}

interface DragState {
  readonly start: PickerPoint;
  readonly primary?: Element;
}

function selectionRect(rect: DOMRect): SelectionRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function dragRect(start: PickerPoint, current: PickerPoint): SelectionRect {
  return {
    height: Math.abs(current.y - start.y),
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
  };
}

function styleForRect(rect: SelectionRect): JSX.CSSProperties {
  return {
    blockSize: `${rect.height}px`,
    inlineSize: `${rect.width}px`,
    insetBlockStart: `${rect.top}px`,
    insetInlineStart: `${rect.left}px`,
  };
}

function isExtensionEvent(event: Event): boolean {
  const path = event.composedPath();
  if (
    path.some(
      (target) =>
        target instanceof Element &&
        target.matches("[data-point-and-shoot-frame-shield]"),
    )
  ) {
    return false;
  }
  return path.some(
    (target) =>
      target instanceof Element &&
      target.matches("[data-point-and-shoot-host], [data-point-and-shoot-mount]"),
  );
}

function crossOriginFrameRects(ownerDocument: Document): SelectionRect[] {
  return [...ownerDocument.querySelectorAll<HTMLIFrameElement>("iframe")]
    .filter((frame) => frame.contentDocument === null)
    .map((frame) => selectionRect(frame.getBoundingClientRect()))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function keyDirection(key: string): PickerNavigation | undefined {
  if (key === "ArrowUp") return "parent";
  if (key === "ArrowDown") return "child";
  if (key === "ArrowRight") return "next";
  if (key === "ArrowLeft") return "previous";
  return undefined;
}

/**
 * Renders picker visuals in the extension shadow root while observing pointer and keyboard input
 * from the inspected page.
 *
 * @param props Activity state, result callbacks, and DOM owners.
 * @returns Shadow-owned hover, pinned, unreachable, and drag-box overlays.
 */
export function ElementPicker(
  {
    active,
    onExit,
    onPreviewChange,
    onSelection,
    ownerDocument = document,
    ownerWindow = window,
  }: ElementPickerProps,
): JSX.Element | null {
  const [highlight, setHighlight] = useState<Highlight>();
  const [frameShields, setFrameShields] = useState<readonly SelectionRect[]>([]);
  const [visibleDrag, setVisibleDrag] = useState<SelectionRect>();
  const currentElement = useRef<Element>();
  const currentUnreachable = useRef<Extract<PickerTarget, { kind: "unreachable" }>>();
  const drag = useRef<DragState>();
  const exited = useRef(false);
  const ignoreNextClick = useRef(false);
  const pinned = useRef(false);
  const exitCallback = useRef(onExit);
  const previewCallback = useRef(onPreviewChange);
  const selectionCallback = useRef(onSelection);
  exitCallback.current = onExit;
  previewCallback.current = onPreviewChange;
  selectionCallback.current = onSelection;

  useEffect(() => {
    const clear = (): void => {
      currentElement.current = undefined;
      currentUnreachable.current = undefined;
      drag.current = undefined;
      pinned.current = false;
      setHighlight(undefined);
      setFrameShields([]);
      setVisibleDrag(undefined);
      previewCallback.current?.(undefined);
    };
    if (!active) {
      exited.current = true;
      clear();
      return;
    }

    exited.current = false;
    setFrameShields(crossOriginFrameRects(ownerDocument));
    const showTarget = (target: PickerTarget, kind: Highlight["kind"] = "hover"): void => {
      if (target.kind === "none") {
        clear();
        return;
      }
      pinned.current = false;
      if (target.kind === "unreachable") {
        currentElement.current = undefined;
        currentUnreachable.current = target;
        const next = { kind: "unreachable" as const, rect: target.rect };
        setHighlight(next);
        previewCallback.current?.(next.rect);
        return;
      }
      currentElement.current = target.element;
      currentUnreachable.current = undefined;
      const next = {
        kind,
        rect: selectionRect(target.element.getBoundingClientRect()),
      };
      setHighlight(next);
      previewCallback.current?.(next.rect);
    };
    const initial = ownerDocument.activeElement;
    if (
      initial !== null &&
      initial.nodeType === Node.ELEMENT_NODE &&
      initial !== ownerDocument.body &&
      initial !== ownerDocument.documentElement &&
      !initial.matches("[data-point-and-shoot-host]")
    ) {
      showTarget({ kind: "element", element: initial });
    }

    const handlePointerMove = (event: PointerEvent): void => {
      if (exited.current || isExtensionEvent(event)) return;
      const point = { x: event.clientX, y: event.clientY };
      if (drag.current !== undefined) {
        const next = dragRect(drag.current.start, point);
        setVisibleDrag(next);
        previewCallback.current?.(next);
        return;
      }
      if (pinned.current) return;
      showTarget(resolvePickerTarget(ownerDocument, point));
    };
    const handlePointerDown = (event: PointerEvent): void => {
      if (exited.current || !event.shiftKey || isExtensionEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const point = { x: event.clientX, y: event.clientY };
      const target = resolvePickerTarget(ownerDocument, point);
      drag.current = {
        start: point,
        ...(target.kind === "element" ? { primary: target.element } : {}),
      };
      ignoreNextClick.current = false;
      setHighlight(undefined);
      setVisibleDrag({ height: 0, left: point.x, top: point.y, width: 0 });
    };
    const handlePointerUp = (event: PointerEvent): void => {
      const currentDrag = drag.current;
      if (exited.current || currentDrag === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      const region = dragRect(currentDrag.start, { x: event.clientX, y: event.clientY });
      drag.current = undefined;
      setVisibleDrag(undefined);
      ignoreNextClick.current = true;
      const elements = collectDragElements(ownerDocument, region, currentDrag.primary);
      if (elements.length === 0) {
        clear();
        return;
      }
      setHighlight({ kind: "pinned", rect: region });
      pinned.current = true;
      previewCallback.current?.(region);
      selectionCallback.current?.({ elements, kind: "elements", region });
    };
    const confirmCurrent = (): void => {
      const activeElement = ownerDocument.activeElement;
      const element = currentElement.current ??
        (activeElement !== null &&
            activeElement !== ownerDocument.body &&
            activeElement !== ownerDocument.documentElement &&
            !activeElement.matches("[data-point-and-shoot-host]")
          ? activeElement
          : undefined);
      if (element !== undefined) {
        const capture = capturePickerElement(element, true);
        const region = capture.rect;
        setHighlight({ kind: "pinned", rect: region });
        pinned.current = true;
        previewCallback.current?.(region);
        selectionCallback.current?.({ elements: [capture], kind: "elements", region });
        return;
      }
      const unreachable = currentUnreachable.current;
      if (unreachable !== undefined) {
        setHighlight({ kind: "unreachable", rect: unreachable.rect });
        pinned.current = true;
        selectionCallback.current?.({
          kind: "unreachable",
          reason: unreachable.reason,
          region: unreachable.rect,
        });
      }
    };
    const handleClick = (event: MouseEvent): void => {
      if (exited.current || isExtensionEvent(event)) return;
      if (ignoreNextClick.current) {
        ignoreNextClick.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      confirmCurrent();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (exited.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        exited.current = true;
        clear();
        exitCallback.current?.();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        confirmCurrent();
        return;
      }
      const direction = keyDirection(event.key);
      const element = currentElement.current;
      if (direction === undefined || element === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      showTarget({ kind: "element", element: navigatePickerElement(element, direction) });
    };
    const refresh = (): void => {
      setFrameShields(crossOriginFrameRects(ownerDocument));
      const element = currentElement.current;
      if (exited.current || element === undefined || drag.current !== undefined) return;
      const rect = selectionRect(element.getBoundingClientRect());
      setHighlight((current) => current === undefined ? current : { ...current, rect });
      previewCallback.current?.(rect);
    };

    ownerDocument.addEventListener("click", handleClick, true);
    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
    ownerDocument.addEventListener("pointermove", handlePointerMove, true);
    ownerDocument.addEventListener("pointerup", handlePointerUp, true);
    ownerWindow.addEventListener("resize", refresh, { passive: true });
    ownerWindow.addEventListener("scroll", refresh, { capture: true, passive: true });

    return () => {
      ownerDocument.removeEventListener("click", handleClick, true);
      ownerDocument.removeEventListener("keydown", handleKeyDown, true);
      ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
      ownerDocument.removeEventListener("pointermove", handlePointerMove, true);
      ownerDocument.removeEventListener("pointerup", handlePointerUp, true);
      ownerWindow.removeEventListener("resize", refresh);
      ownerWindow.removeEventListener("scroll", refresh, true);
      clear();
    };
  }, [active, ownerDocument, ownerWindow]);

  if (!active) return null;
  return (
    <>
      {frameShields.map((rect, index) => (
        <div
          aria-hidden="true"
          className="ps-picker-frame-shield"
          data-point-and-shoot-frame-shield=""
          key={index}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            currentElement.current = undefined;
            const target = {
              kind: "unreachable" as const,
              reason: "cross-origin-iframe" as const,
              rect,
            };
            currentUnreachable.current = target;
            pinned.current = true;
            setHighlight({ kind: "unreachable", rect });
            previewCallback.current?.(rect);
            selectionCallback.current?.({
              kind: "unreachable",
              reason: target.reason,
              region: rect,
            });
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            currentElement.current = undefined;
            currentUnreachable.current = {
              kind: "unreachable",
              reason: "cross-origin-iframe",
              rect,
            };
            pinned.current = false;
            setHighlight({ kind: "unreachable", rect });
            previewCallback.current?.(rect);
          }}
          style={styleForRect(rect)}
        />
      ))}
      {highlight === undefined ? null : (
        <div
          aria-hidden="true"
          className="ps-picker-highlight"
          data-kind={highlight.kind}
          style={styleForRect(highlight.rect)}
        />
      )}
      {visibleDrag === undefined ? null : (
        <div
          aria-hidden="true"
          className="ps-picker-drag-box"
          style={styleForRect(visibleDrag)}
        />
      )}
    </>
  );
}
