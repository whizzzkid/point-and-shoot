/// <reference lib="dom" />

/** A rendered color sample in the sRGB color space. */
export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

interface RenderedColor extends RgbColor {
  readonly alpha: number;
}

/** Inputs accepted by {@link resolveTheme}. */
export interface ResolveThemeOptions {
  readonly override?: ThemeOverride;
  readonly previousTheme?: Theme;
  readonly sample: () => readonly RgbColor[];
}

/** The two design-system theme variants. */
export type Theme = "dark" | "light";

/** Persisted theme preference; `auto` follows the sampled backdrop. */
export type ThemeOverride = Theme | "auto";

/** Inputs accepted by {@link watchTheme}. */
export interface WatchThemeOptions {
  readonly debounceMilliseconds?: number;
  readonly onChange: (theme: Theme) => void;
  readonly override?: () => ThemeOverride;
  readonly ownerWindow: Window;
  readonly sample: () => readonly RgbColor[];
}

const LUMINANCE_THRESHOLD = 0.5;
const DARK_TO_LIGHT_THRESHOLD = 0.58;
const LIGHT_TO_DARK_THRESHOLD = 0.42;
const DEFAULT_DEBOUNCE_MILLISECONDS = 120;
const MAXIMUM_SAMPLE_COUNT = 5;
const TRANSPARENT_ALPHA = 0.01;
let forcedTheme: Theme | null = null;

function linearizeChannel(channel: number): number {
  const normalized = Math.min(255, Math.max(0, channel)) / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor): number {
  return 0.2126 * linearizeChannel(color.red) +
    0.7152 * linearizeChannel(color.green) +
    0.0722 * linearizeChannel(color.blue);
}

function renderedColor(computedColor: string): RenderedColor | null {
  const match = computedColor.match(
    /^rgba?\(\s*(?<red>[\d.]+)\s*,\s*(?<green>[\d.]+)\s*,\s*(?<blue>[\d.]+)(?:\s*,\s*(?<alpha>[\d.]+))?\s*\)$/,
  );
  const red = Number(match?.groups?.red);
  const green = Number(match?.groups?.green);
  const blue = Number(match?.groups?.blue);
  const alpha = match?.groups?.alpha === undefined ? 1 : Number(match.groups.alpha);
  if (
    !Number.isFinite(red) ||
    !Number.isFinite(green) ||
    !Number.isFinite(blue) ||
    !Number.isFinite(alpha) ||
    alpha <= TRANSPARENT_ALPHA
  ) {
    return null;
  }
  return { alpha: Math.min(1, alpha), red, green, blue };
}

function clamp(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, value));
}

function composite(foreground: RenderedColor, background: RenderedColor): RenderedColor {
  const backgroundContribution = background.alpha * (1 - foreground.alpha);
  const alpha = foreground.alpha + backgroundContribution;
  return {
    alpha,
    blue: (foreground.blue * foreground.alpha + background.blue * backgroundContribution) / alpha,
    green: (foreground.green * foreground.alpha + background.green * backgroundContribution) /
      alpha,
    red: (foreground.red * foreground.alpha + background.red * backgroundContribution) / alpha,
  };
}

function samplePoints(
  bounds: DOMRectReadOnly,
  viewportWidth: number,
  viewportHeight: number,
): readonly (readonly [number, number])[] {
  if (bounds.width <= 0 || bounds.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return [];
  }
  const centerX = clamp(bounds.left + bounds.width / 2, viewportWidth - 1);
  const centerY = clamp(bounds.top + bounds.height / 2, viewportHeight - 1);
  const quarterX = bounds.width / 4;
  const quarterY = bounds.height / 4;
  const candidates = [
    [centerX, centerY],
    [clamp(centerX - quarterX, viewportWidth - 1), centerY],
    [clamp(centerX + quarterX, viewportWidth - 1), centerY],
    [centerX, clamp(centerY - quarterY, viewportHeight - 1)],
    [centerX, clamp(centerY + quarterY, viewportHeight - 1)],
  ] as const;
  return candidates.filter(
    ([x, y], index) =>
      candidates.findIndex(([otherX, otherY]) => otherX === x && otherY === y) ===
        index,
  );
}

function canvasColor(ownerDocument: Document, ownerWindow: Window): RenderedColor | null {
  const rootColor = renderedColor(
    ownerWindow.getComputedStyle(ownerDocument.documentElement).backgroundColor,
  );
  if (rootColor !== null) return rootColor;
  if (ownerDocument.body === null) return null;
  return renderedColor(ownerWindow.getComputedStyle(ownerDocument.body).backgroundColor);
}

function sampleColorAtPoint(
  ownerDocument: Document,
  ownerWindow: Window,
  x: number,
  y: number,
  ignoredElement?: Element,
): RgbColor | null {
  let sampledColor: RenderedColor | null = null;
  for (const element of ownerDocument.elementsFromPoint(x, y)) {
    if (
      ignoredElement !== undefined &&
      (element === ignoredElement || ignoredElement.contains(element))
    ) {
      continue;
    }
    const layerColor = renderedColor(ownerWindow.getComputedStyle(element).backgroundColor);
    if (layerColor === null) continue;
    sampledColor = sampledColor === null ? layerColor : composite(sampledColor, layerColor);
    if (sampledColor.alpha >= 1) return sampledColor;
  }
  const backdropColor = canvasColor(ownerDocument, ownerWindow);
  if (backdropColor === null) return sampledColor;
  return sampledColor === null ? backdropColor : composite(sampledColor, backdropColor);
}

/**
 * Samples at most five opaque backdrop colors under a prospective toolbar rectangle.
 *
 * @param ownerDocument Page document that owns the backdrop.
 * @param bounds Viewport-relative toolbar bounds.
 * @param ignoredElement Extension overlay to skip while walking each point's element stack.
 * @returns Opaque sRGB colors ordered by their sample point.
 */
export function sampleBackdrop(
  ownerDocument: Document,
  bounds: DOMRectReadOnly,
  ignoredElement?: Element,
): readonly RgbColor[] {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow === null) return [];
  const colors: RgbColor[] = [];
  for (
    const [x, y] of samplePoints(bounds, ownerWindow.innerWidth, ownerWindow.innerHeight).slice(
      0,
      MAXIMUM_SAMPLE_COUNT,
    )
  ) {
    // CSS propagates the root background, or the body's when the root is transparent, to the
    // viewport canvas. Below a short body neither element necessarily appears in the point stack.
    const sampledColor = sampleColorAtPoint(ownerDocument, ownerWindow, x, y, ignoredElement);
    if (sampledColor !== null) colors.push(sampledColor);
  }
  return colors;
}

/**
 * Resolves the overlay theme from a bounded set of backdrop color samples.
 *
 * @param options Deferred backdrop sampler.
 * @returns The dark or light design-system theme.
 */
export function resolveTheme(
  { override, previousTheme, sample }: ResolveThemeOptions,
): Theme {
  const selectedOverride = forcedTheme ?? override;
  if (selectedOverride === "dark" || selectedOverride === "light") return selectedOverride;
  const colors = sample();
  if (colors.length === 0) return previousTheme ?? "dark";
  const averageLuminance = colors.reduce(
    (total, color) => total + relativeLuminance(color),
    0,
  ) / colors.length;
  if (previousTheme === "dark") {
    return averageLuminance >= DARK_TO_LIGHT_THRESHOLD ? "light" : "dark";
  }
  if (previousTheme === "light") {
    return averageLuminance <= LIGHT_TO_DARK_THRESHOLD ? "dark" : "light";
  }
  return averageLuminance >= LUMINANCE_THRESHOLD ? "light" : "dark";
}

/**
 * Pins every subsequent theme resolution for deterministic automated checks.
 *
 * @param theme Forced theme, or `null` to restore ordinary override and sampling behavior.
 * @returns Nothing.
 */
export function forceTheme(theme: Theme | null): void {
  forcedTheme = theme;
}

function resolveWatchedTheme(
  sample: () => readonly RgbColor[],
  override: (() => ThemeOverride) | undefined,
  previousTheme: Theme | undefined,
): Theme {
  if (override !== undefined) {
    const selectedOverride = override();
    if (previousTheme === undefined) return resolveTheme({ override: selectedOverride, sample });
    return resolveTheme({ override: selectedOverride, previousTheme, sample });
  }
  if (previousTheme !== undefined) return resolveTheme({ previousTheme, sample });
  return resolveTheme({ sample });
}

/**
 * Resolves the initial theme and debounces recomputation after page movement.
 *
 * @param options Window event source, backdrop sampler, override reader, and update callback.
 * @returns Cleanup callback that removes listeners and cancels pending work.
 */
export function watchTheme(
  {
    debounceMilliseconds = DEFAULT_DEBOUNCE_MILLISECONDS,
    onChange,
    override,
    ownerWindow,
    sample,
  }: WatchThemeOptions,
): () => void {
  let currentTheme: Theme | undefined;
  let timeout: number | undefined;

  const update = () => {
    const nextTheme = resolveWatchedTheme(sample, override, currentTheme);
    if (nextTheme !== currentTheme) {
      currentTheme = nextTheme;
      onChange(nextTheme);
    }
  };
  const schedule = () => {
    if (timeout !== undefined) ownerWindow.clearTimeout(timeout);
    timeout = ownerWindow.setTimeout(() => {
      timeout = undefined;
      update();
    }, debounceMilliseconds);
  };

  update();
  ownerWindow.addEventListener("scroll", schedule, { capture: true, passive: true });
  ownerWindow.addEventListener("resize", schedule, { passive: true });

  return () => {
    if (timeout !== undefined) ownerWindow.clearTimeout(timeout);
    ownerWindow.removeEventListener("scroll", schedule, true);
    ownerWindow.removeEventListener("resize", schedule);
  };
}
