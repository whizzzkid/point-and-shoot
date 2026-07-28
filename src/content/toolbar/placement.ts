/** Viewport-coordinate rectangle consumed and returned by the toolbar placement engine. */
export interface PlacementRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Visible viewport bounds in the same coordinate space as selections and obstacles. */
export type ViewportRect = PlacementRect;

/** Measured toolbar dimensions before it is positioned. */
export interface ToolbarSize {
  readonly width: number;
  readonly height: number;
}

/** Inputs used to place the floating toolbar. */
export interface ToolbarPlacementOptions {
  readonly viewport: ViewportRect;
  readonly toolbar: ToolbarSize;
  readonly edgeGap: number;
  readonly collisionGap: number;
  readonly selection?: PlacementRect;
  readonly composer?: PlacementRect;
  readonly obstacles?: readonly PlacementRect[];
}

/** Design-system anchor retained for diagnostics after collision displacement. */
export type ToolbarAnchor = "bottom-center" | "top-right";

/** Chosen toolbar anchor and viewport-coordinate rectangle. */
export interface ToolbarPlacement {
  readonly anchor: ToolbarAnchor;
  readonly rect: PlacementRect;
}

function validateNumber(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
}

function validateRect(label: string, rect: PlacementRect): void {
  validateNumber(`${label}.left`, rect.left);
  validateNumber(`${label}.top`, rect.top);
  validateNumber(`${label}.width`, rect.width);
  validateNumber(`${label}.height`, rect.height);
  if (rect.width < 0 || rect.height < 0) {
    throw new RangeError(`${label} dimensions must not be negative`);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function clampToViewport(
  rect: PlacementRect,
  viewport: ViewportRect,
  edgeGap: number,
): PlacementRect {
  const minimumLeft = viewport.left + edgeGap;
  const minimumTop = viewport.top + edgeGap;
  const maximumLeft = viewport.left + viewport.width - edgeGap - rect.width;
  const maximumTop = viewport.top + viewport.height - edgeGap - rect.height;
  return {
    ...rect,
    left: clamp(rect.left, minimumLeft, maximumLeft),
    top: clamp(rect.top, minimumTop, maximumTop),
  };
}

function expandRect(rect: PlacementRect, gap: number): PlacementRect {
  return {
    left: rect.left - gap,
    top: rect.top - gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  };
}

function intersectionArea(first: PlacementRect, second: PlacementRect): number {
  const width = Math.min(first.left + first.width, second.left + second.width) -
    Math.max(first.left, second.left);
  const height = Math.min(first.top + first.height, second.top + second.height) -
    Math.max(first.top, second.top);
  return Math.max(0, width) * Math.max(0, height);
}

function displacedCandidates(
  placement: ToolbarPlacement,
  obstacle: PlacementRect,
  viewport: ViewportRect,
  edgeGap: number,
  collisionGap: number,
): ToolbarPlacement[] {
  if (intersectionArea(placement.rect, expandRect(obstacle, collisionGap)) === 0) return [];
  const { rect } = placement;
  const candidates = [
    { ...rect, top: obstacle.top - collisionGap - rect.height },
    { ...rect, top: obstacle.top + obstacle.height + collisionGap },
    { ...rect, left: obstacle.left - collisionGap - rect.width },
    { ...rect, left: obstacle.left + obstacle.width + collisionGap },
  ];
  return candidates.map((candidate) => ({
    anchor: placement.anchor,
    rect: clampToViewport(candidate, viewport, edgeGap),
  }));
}

/**
 * Places the toolbar at its preferred anchor, displacing it around collisions when necessary.
 *
 * @param options Viewport, measured toolbar, spacing, active selection, composer, and page
 *   obstacles.
 * @returns The first collision-free placement, or the lowest-overlap fallback when none exists.
 * @throws When any input is non-finite or any dimension or gap is negative.
 */
export function placeToolbar(options: ToolbarPlacementOptions): ToolbarPlacement {
  const {
    collisionGap,
    composer,
    edgeGap,
    obstacles = [],
    selection,
    toolbar,
    viewport,
  } = options;
  validateRect("viewport", viewport);
  validateRect("toolbar", { left: 0, top: 0, ...toolbar });
  validateNumber("edgeGap", edgeGap);
  validateNumber("collisionGap", collisionGap);
  if (edgeGap < 0 || collisionGap < 0) throw new RangeError("placement gaps must not be negative");

  const avoidances = [selection, composer, ...obstacles].filter(
    (rect): rect is PlacementRect => rect !== undefined,
  );
  for (const [index, rect] of avoidances.entries()) validateRect(`obstacle[${index}]`, rect);

  const basePlacements: ToolbarPlacement[] = [
    {
      anchor: "bottom-center",
      rect: clampToViewport(
        {
          left: viewport.left + (viewport.width - toolbar.width) / 2,
          top: viewport.top + viewport.height - edgeGap - toolbar.height,
          ...toolbar,
        },
        viewport,
        edgeGap,
      ),
    },
    {
      anchor: "top-right",
      rect: clampToViewport(
        {
          left: viewport.left + viewport.width - edgeGap - toolbar.width,
          top: viewport.top + edgeGap,
          ...toolbar,
        },
        viewport,
        edgeGap,
      ),
    },
  ];
  const candidates = [
    ...basePlacements,
    ...basePlacements.flatMap((placement) =>
      avoidances.flatMap((obstacle) =>
        displacedCandidates(placement, obstacle, viewport, edgeGap, collisionGap)
      )
    ),
  ];
  const expandedAvoidances = avoidances.map((rect) => expandRect(rect, collisionGap));
  const score = (placement: ToolbarPlacement): number =>
    expandedAvoidances.reduce(
      (total, obstacle) => total + intersectionArea(placement.rect, obstacle),
      0,
    );
  const collisionFree = candidates.find((candidate) => score(candidate) === 0);
  if (collisionFree !== undefined) return collisionFree;

  return candidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best);
}
