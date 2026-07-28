/// <reference lib="dom" />
/**
 * Computed-style digest engine — given an element, emits a bounded snapshot of its box model,
 * typography, and resolved colors, plus the same digest for its parent and immediate siblings so
 * spacing bugs (which are only explicable relative to neighbours) are legible without a screenshot.
 *
 * Runs inside a page via `elementHandle.evaluate`/`page.evaluate`, which serialize
 * {@link buildStyleDigest} by source text (`Function.prototype.toString()`) and re-parse it with no
 * surrounding module. Every helper this module needs is therefore nested inside
 * {@link buildStyleDigest}'s own body rather than shared at module scope — a reference to a
 * module-level helper would resolve to nothing once the source text is re-parsed on its own.
 *
 * @module
 */

/**
 * Ceiling on distinct style properties a single {@link ElementDigest} may report. The fixed field
 * list below (14 box-model + 5 typography + 6 color = 25) is already under this cap by design — the
 * constant exists so every consumer reads the same number from {@link ../../docs/plans/README.md}'s
 * settled-numbers table rather than each picking its own.
 */
export const MAX_STYLE_PROPERTIES = 40;

/** Siblings included on each side of the target, in DOM order. */
export const SIBLINGS_PER_SIDE = 3;

/** Total sibling entries a {@link StyleDigestBundle} may report ({@link SIBLINGS_PER_SIDE} × 2). */
export const MAX_SIBLINGS = SIBLINGS_PER_SIDE * 2;

/**
 * Subtree depth budget for callers that walk descendants around a digest target (e.g. a drag-box
 * element collector). Not applied inside this module — {@link buildStyleDigest} only ever looks at
 * one element, its parent, and its siblings, none of which require a subtree walk — but defined here
 * so every consumer reads the same settled number rather than re-deriving it.
 */
export const MAX_SUBTREE_DEPTH = 3;

/** Box-model measurements, in CSS pixels, read from `getComputedStyle`. */
export interface BoxModelDigest {
  readonly width: number;
  readonly height: number;
  readonly paddingTop: number;
  readonly paddingRight: number;
  readonly paddingBottom: number;
  readonly paddingLeft: number;
  readonly marginTop: number;
  readonly marginRight: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly borderTopWidth: number;
  readonly borderRightWidth: number;
  readonly borderBottomWidth: number;
  readonly borderLeftWidth: number;
}

/** Typography, read from `getComputedStyle`. `fontSize` is normalized to a bare pixel number. */
export interface TypographyDigest {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: string;
  readonly lineHeight: string;
  readonly letterSpacing: string;
}

/** Resolved colors, normalized to `#rrggbb`/`#rrggbbaa` hex so two digests diff cleanly. */
export interface ColorDigest {
  readonly color: string;
  readonly backgroundColor: string;
  readonly borderTopColor: string;
  readonly borderRightColor: string;
  readonly borderBottomColor: string;
  readonly borderLeftColor: string;
}

/** The full style digest for a single element. */
export interface ElementDigest {
  readonly box: BoxModelDigest;
  readonly typography: TypographyDigest;
  readonly color: ColorDigest;
}

/** A neighbouring sibling's digest plus its vertical gap from the target, in DOM order. */
export interface SiblingDigest {
  readonly direction: "preceding" | "following";
  /** 1-based distance from the target; `1` is the nearest sibling on that side. */
  readonly distance: number;
  /** Vertical gap between the target and this sibling, in CSS pixels. Negative if they overlap. */
  readonly gapPx: number;
  readonly element: ElementDigest;
}

/** The complete bounded digest for one element: itself, its parent, and its immediate siblings. */
export interface StyleDigestBundle {
  readonly self: ElementDigest;
  /** `null` only when `target` has no parent element (e.g. a detached node, or `<html>`). */
  readonly parent: ElementDigest | null;
  /** Up to {@link MAX_SIBLINGS} entries, nearest-first on each side. */
  readonly siblings: readonly SiblingDigest[];
}

/**
 * Builds a {@link StyleDigestBundle} for `target`: its own box/typography/color digest, its
 * parent's, and up to {@link SIBLINGS_PER_SIDE} preceding and following siblings each, with the
 * vertical gap to each sibling.
 *
 * @example buildStyleDigest(document.querySelector("button")) // => { self, parent, siblings }
 */
export function buildStyleDigest(target: Element): StyleDigestBundle {
  // Inlined rather than referencing the module-level `SIBLINGS_PER_SIDE` export — this function is
  // serialized by source text alone (see the module TSDoc) and re-parsed with no surrounding module.
  const siblingsPerSide = 3;

  /** Converts `rgb(r, g, b)`/`rgba(r, g, b, a)` to `#rrggbb`/`#rrggbbaa`; passes through anything else. */
  function toHex(value: string): string {
    const match = value.match(
      /^rgba?\((?<r>\d+),\s*(?<g>\d+),\s*(?<b>\d+)(?:,\s*(?<a>[\d.]+))?\)$/,
    );
    if (match?.groups === undefined) return value;
    const { r, g, b, a } = match.groups as { r: string; g: string; b: string; a?: string };
    const channel = (n: string) => Number(n).toString(16).padStart(2, "0");
    const hex = `${channel(r)}${channel(g)}${channel(b)}`;
    if (a !== undefined && Number(a) < 1) {
      const alphaHex = Math.round(Number(a) * 255).toString(16).padStart(2, "0");
      return `#${hex}${alphaHex}`;
    }
    return `#${hex}`;
  }

  /** Parses a `getComputedStyle` pixel string (e.g. `"12px"`) to a bare number; `0` if unparseable. */
  function px(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function digestOf(el: Element): ElementDigest {
    const computed = getComputedStyle(el);
    return {
      box: {
        width: px(computed.width),
        height: px(computed.height),
        paddingTop: px(computed.paddingTop),
        paddingRight: px(computed.paddingRight),
        paddingBottom: px(computed.paddingBottom),
        paddingLeft: px(computed.paddingLeft),
        marginTop: px(computed.marginTop),
        marginRight: px(computed.marginRight),
        marginBottom: px(computed.marginBottom),
        marginLeft: px(computed.marginLeft),
        borderTopWidth: px(computed.borderTopWidth),
        borderRightWidth: px(computed.borderRightWidth),
        borderBottomWidth: px(computed.borderBottomWidth),
        borderLeftWidth: px(computed.borderLeftWidth),
      },
      typography: {
        fontFamily: computed.fontFamily,
        fontSize: px(computed.fontSize),
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
      },
      color: {
        color: toHex(computed.color),
        backgroundColor: toHex(computed.backgroundColor),
        borderTopColor: toHex(computed.borderTopColor),
        borderRightColor: toHex(computed.borderRightColor),
        borderBottomColor: toHex(computed.borderBottomColor),
        borderLeftColor: toHex(computed.borderLeftColor),
      },
    };
  }

  /** Vertical gap between two elements' boxes, given `above` sits earlier in visual flow than `below`. */
  function verticalGapPx(above: Element, below: Element): number {
    return below.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
  }

  const self = digestOf(target);

  const parentElement = target.parentElement;
  const parent = parentElement === null ? null : digestOf(parentElement);

  const siblings: SiblingDigest[] = [];

  let preceding: Element | null = target;
  for (let distance = 1; distance <= siblingsPerSide; distance++) {
    preceding = preceding.previousElementSibling;
    if (preceding === null) break;
    siblings.push({
      direction: "preceding",
      distance,
      gapPx: verticalGapPx(preceding, target),
      element: digestOf(preceding),
    });
  }

  let following: Element | null = target;
  for (let distance = 1; distance <= siblingsPerSide; distance++) {
    following = following.nextElementSibling;
    if (following === null) break;
    siblings.push({
      direction: "following",
      distance,
      gapPx: verticalGapPx(target, following),
      element: digestOf(following),
    });
  }

  return { self, parent, siblings };
}
