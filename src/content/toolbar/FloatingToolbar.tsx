/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Badge, Button, Icon, IconButton, IconSpriteProvider } from "../../ui/components/index.ts";
import {
  type PlacementRect,
  placeToolbar,
  type ToolbarPlacement,
  type ToolbarSize,
  type ViewportRect,
} from "./placement.ts";

const MAXIMUM_PAGE_OBSTACLES = 8;
const TOOLBAR_COLLISION_GAP_TOKEN = "--space-3";
const TOOLBAR_EDGE_GAP_TOKEN = "--space-6";

/** Tool selected from the floating capture toolbar. */
export type ToolbarTool = "select";

/** Props accepted by {@link FloatingToolbar}. */
export interface FloatingToolbarProps {
  readonly activeTool?: ToolbarTool | null;
  readonly iconSpriteUrl: string;
  readonly selection?: PlacementRect;
  readonly composer?: PlacementRect;
  readonly focusSelect?: boolean;
  readonly noteCount?: number;
  readonly onSend?: () => void;
  readonly onToolChange?: (tool: ToolbarTool) => void;
  readonly ownerDocument?: Document;
  readonly ownerWindow?: Window;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PositionedToolbar {
  readonly motion: "a" | "b";
  readonly placement: ToolbarPlacement;
}

function readPixelToken(element: HTMLElement, token: string, ownerWindow: Window): number {
  return Number.parseFloat(ownerWindow.getComputedStyle(element).getPropertyValue(token));
}

function rectFromDom(rect: DOMRect): PlacementRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function samplePointsForRect(rect: PlacementRect): Point[] {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  return [
    { x: rect.left + 1, y: rect.top + 1 },
    { x: right - 1, y: rect.top + 1 },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    { x: rect.left + 1, y: bottom - 1 },
    { x: right - 1, y: bottom - 1 },
  ];
}

function anchoredRects(
  viewport: ViewportRect,
  toolbar: ToolbarSize,
  edgeGap: number,
): PlacementRect[] {
  return [
    {
      height: toolbar.height,
      left: viewport.left + (viewport.width - toolbar.width) / 2,
      top: viewport.top + viewport.height - edgeGap - toolbar.height,
      width: toolbar.width,
    },
    {
      height: toolbar.height,
      left: viewport.left + viewport.width - edgeGap - toolbar.width,
      top: viewport.top + edgeGap,
      width: toolbar.width,
    },
  ];
}

function collectPageObstacles(
  ownerDocument: Document,
  ownerWindow: Window,
  toolbarElement: HTMLElement,
  viewport: ViewportRect,
  toolbar: ToolbarSize,
  edgeGap: number,
): PlacementRect[] {
  const obstacles: PlacementRect[] = [];
  const seen = new Set<Element>();
  const points = anchoredRects(viewport, toolbar, edgeGap).flatMap(samplePointsForRect);

  for (const point of points) {
    for (const element of ownerDocument.elementsFromPoint(point.x, point.y)) {
      if (
        seen.has(element) ||
        toolbarElement.contains(element) ||
        element.contains(toolbarElement)
      ) {
        continue;
      }
      const position = ownerWindow.getComputedStyle(element).position;
      if (position !== "fixed" && position !== "sticky") continue;
      seen.add(element);
      const rect = rectFromDom(element.getBoundingClientRect());
      if (rect.width === 0 || rect.height === 0) continue;
      obstacles.push(rect);
      if (obstacles.length === MAXIMUM_PAGE_OBSTACLES) return obstacles;
    }
  }

  return obstacles;
}

function viewportRect(ownerWindow: Window): ViewportRect {
  const viewport = ownerWindow.visualViewport;
  return viewport === null
    ? { left: 0, top: 0, width: ownerWindow.innerWidth, height: ownerWindow.innerHeight }
    : {
      left: viewport.offsetLeft,
      top: viewport.offsetTop,
      width: viewport.width,
      height: viewport.height,
    };
}

function samePlacement(
  first: ToolbarPlacement | undefined,
  second: ToolbarPlacement,
): boolean {
  return first?.anchor === second.anchor &&
    first.rect.left === second.rect.left &&
    first.rect.top === second.rect.top &&
    first.rect.width === second.rect.width &&
    first.rect.height === second.rect.height;
}

function useToolbarPlacement(
  toolbarRef: { readonly current: HTMLElement | null },
  selection: PlacementRect | undefined,
  composer: PlacementRect | undefined,
  ownerDocument: Document,
  ownerWindow: Window,
): PositionedToolbar | undefined {
  const [positioned, setPositioned] = useState<PositionedToolbar>();

  useLayoutEffect(() => {
    const toolbarElement = toolbarRef.current;
    if (toolbarElement === null) return;
    let animationFrame: number | undefined;

    const update = (): void => {
      animationFrame = undefined;
      const measured = toolbarElement.getBoundingClientRect();
      if (measured.width === 0 || measured.height === 0) return;
      const toolbar = { height: measured.height, width: measured.width };
      const viewport = viewportRect(ownerWindow);
      const edgeGap = readPixelToken(toolbarElement, TOOLBAR_EDGE_GAP_TOKEN, ownerWindow);
      const collisionGap = readPixelToken(
        toolbarElement,
        TOOLBAR_COLLISION_GAP_TOKEN,
        ownerWindow,
      );
      const nextPlacement = placeToolbar({
        collisionGap,
        edgeGap,
        obstacles: collectPageObstacles(
          ownerDocument,
          ownerWindow,
          toolbarElement,
          viewport,
          toolbar,
          edgeGap,
        ),
        toolbar,
        viewport,
        ...(composer === undefined ? {} : { composer }),
        ...(selection === undefined ? {} : { selection }),
      });
      setPositioned((current) =>
        samePlacement(current?.placement, nextPlacement) ? current : {
          motion: current?.motion === "a" ? "b" : "a",
          placement: nextPlacement,
        }
      );
    };
    const schedule = (): void => {
      if (animationFrame !== undefined) ownerWindow.cancelAnimationFrame(animationFrame);
      animationFrame = ownerWindow.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(toolbarElement);
    ownerWindow.addEventListener("resize", schedule, { passive: true });
    ownerWindow.visualViewport?.addEventListener("resize", schedule, { passive: true });
    ownerDocument.addEventListener("fullscreenchange", schedule);
    // A `scroll` listener here re-ran `placeToolbar` every frame the user scrolled, which made
    // the toolbar chase the viewport and look like it was fleeing the pointer — users reported
    // it as "moves around, can't click." The toolbar is positioned in viewport coordinates via
    // `position: fixed`; scrolling does not change its visible location, and rerunning
    // placement on scroll only reshuffles it when the set of visible obstacles happens to
    // change. Placement still re-runs on selection/composer changes (via the deps below),
    // viewport resize, and fullscreen transitions — the events that actually move the geometry
    // the placement engine cares about.
    update();

    return () => {
      if (animationFrame !== undefined) ownerWindow.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      ownerWindow.removeEventListener("resize", schedule);
      ownerWindow.visualViewport?.removeEventListener("resize", schedule);
      ownerDocument.removeEventListener("fullscreenchange", schedule);
    };
  }, [
    composer,
    ownerDocument,
    ownerWindow,
    selection,
    toolbarRef,
  ]);

  return positioned;
}

function notesLabel(noteCount: number): string {
  return `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
}

/**
 * Renders the injected toolbar and continuously positions it clear of active page geometry.
 *
 * @param props Icon resource, selection/composer geometry, note state, callbacks, and DOM owners.
 * @returns The floating capture toolbar.
 */
export function FloatingToolbar(
  {
    activeTool,
    composer,
    focusSelect = false,
    iconSpriteUrl,
    noteCount = 0,
    onSend,
    onToolChange,
    ownerDocument = document,
    ownerWindow = window,
    selection,
  }: FloatingToolbarProps,
): JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusSelect) selectRef.current?.focus();
  }, [focusSelect]);
  const positioned = useToolbarPlacement(
    toolbarRef,
    selection,
    composer,
    ownerDocument,
    ownerWindow,
  );
  const [uncontrolledTool, setUncontrolledTool] = useState<ToolbarTool>("select");
  const selectedTool = activeTool === undefined ? uncontrolledTool : activeTool;
  const chooseTool = (tool: ToolbarTool): void => {
    if (activeTool === undefined) setUncontrolledTool(tool);
    onToolChange?.(tool);
  };
  const style = positioned === undefined ? undefined : {
    insetInlineStart: `${positioned.placement.rect.left}px`,
    insetBlockStart: `${positioned.placement.rect.top}px`,
  };

  return (
    <IconSpriteProvider url={iconSpriteUrl}>
      <div
        aria-label="Capture tools"
        className="ps-floating-toolbar"
        data-anchor={positioned?.placement.anchor}
        data-motion={positioned?.motion}
        data-positioned={positioned !== undefined}
        ref={toolbarRef}
        role="toolbar"
        style={style}
      >
        <IconButton
          active={selectedTool === "select"}
          elementRef={(element) => {
            selectRef.current = element;
          }}
          icon={<Icon name="crosshair" />}
          label="Select"
          onClick={() => chooseTool("select")}
        />
        <span aria-hidden="true" className="ps-toolbar-divider" />
        <Badge>{notesLabel(noteCount)}</Badge>
        <Button
          disabled={noteCount === 0}
          size="sm"
          {...(onSend === undefined ? {} : { onClick: onSend })}
        >
          Send to agent
        </Button>
      </div>
    </IconSpriteProvider>
  );
}
