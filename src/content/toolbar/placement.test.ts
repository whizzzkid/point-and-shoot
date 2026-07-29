import { assertEquals, assertThrows } from "@std/assert";
import {
  placeToolbar,
  type ToolbarPlacement,
  type ToolbarPlacementOptions,
  type ViewportRect,
} from "./placement.ts";

const VIEWPORT: ViewportRect = { left: 0, top: 0, width: 1_000, height: 600 };
const TOOLBAR = { width: 480, height: 56 };

function placementOptions(
  overrides: Partial<ToolbarPlacementOptions> = {},
): ToolbarPlacementOptions {
  return {
    collisionGap: 12,
    edgeGap: 24,
    toolbar: TOOLBAR,
    viewport: VIEWPORT,
    ...overrides,
  };
}

function overlaps(
  first: ToolbarPlacement["rect"],
  second: ToolbarPlacement["rect"],
): boolean {
  return first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top;
}

Deno.test("placeToolbar - prefers the hand-derived bottom-centre anchor", () => {
  assertEquals(placeToolbar(placementOptions()), {
    anchor: "bottom-center",
    rect: { left: 260, top: 520, width: 480, height: 56 },
  });
});

Deno.test("placeToolbar - stays clear of selections in every viewport quadrant", () => {
  const selections = [
    { left: 40, top: 80, width: 200, height: 140 },
    { left: 760, top: 80, width: 200, height: 140 },
    { left: 40, top: 430, width: 320, height: 140 },
    { left: 640, top: 430, width: 320, height: 140 },
  ];

  for (const selection of selections) {
    const placement = placeToolbar(placementOptions({ selection }));
    assertEquals(overlaps(placement.rect, selection), false);
    assertEquals(placement.rect.left >= 24, true);
    assertEquals(placement.rect.left + placement.rect.width <= 976, true);
    assertEquals(placement.rect.top >= 24, true);
    assertEquals(placement.rect.top + placement.rect.height <= 576, true);
  }
});

Deno.test("placeToolbar - moves below a sticky header when the selection blocks the bottom", () => {
  const selection = { left: 200, top: 430, width: 600, height: 140 };
  const stickyHeader = { left: 0, top: 0, width: 1_000, height: 64 };

  const placement = placeToolbar(
    placementOptions({ obstacles: [stickyHeader], selection }),
  );

  assertEquals(overlaps(placement.rect, selection), false);
  assertEquals(overlaps(placement.rect, stickyHeader), false);
  assertEquals(placement.rect.top >= 76, true);
});

Deno.test("placeToolbar - avoids both a selection and its note composer", () => {
  const selection = { left: 700, top: 24, width: 276, height: 180 };
  const composer = { left: 230, top: 490, width: 540, height: 86 };

  const placement = placeToolbar(placementOptions({ composer, selection }));

  assertEquals(overlaps(placement.rect, selection), false);
  assertEquals(overlaps(placement.rect, composer), false);
});

Deno.test("placeToolbar - rejects non-finite geometry", () => {
  assertThrows(
    () =>
      placeToolbar(
        placementOptions({
          selection: { left: Number.NaN, top: 0, width: 10, height: 10 },
        }),
      ),
    TypeError,
    "finite",
  );
});

Deno.test("placeToolbar - rejects invalid dimensions and gaps", () => {
  assertThrows(
    () => placeToolbar(placementOptions({ toolbar: { height: 56, width: -1 } })),
    RangeError,
    "dimensions",
  );
  assertThrows(
    () => placeToolbar(placementOptions({ collisionGap: -1 })),
    RangeError,
    "gaps",
  );
  assertThrows(
    () => placeToolbar(placementOptions({ edgeGap: Number.NaN })),
    TypeError,
    "edgeGap",
  );
});
