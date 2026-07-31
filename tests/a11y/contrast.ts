/** One parsed sRGB color with channels in the browser's 0–255 range. */
export interface CssColor {
  readonly alpha: number;
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

const HEX_COLOR_PATTERN = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(?<red>\d+(?:\.\d+)?)\s*,\s*(?<green>\d+(?:\.\d+)?)\s*,\s*(?<blue>\d+(?:\.\d+)?)(?:\s*,\s*(?<alpha>\d*(?:\.\d+)?))?\s*\)$/i;

function validatedColor(color: CssColor, source: string): CssColor {
  const channels = [color.red, color.green, color.blue];
  if (
    channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255) ||
    !Number.isFinite(color.alpha) ||
    color.alpha < 0 ||
    color.alpha > 1
  ) {
    throw new Error(`unsupported CSS color: "${source}"`);
  }
  return color;
}

/**
 * Parses the hexadecimal and comma-separated RGB formats returned by Chromium computed styles.
 *
 * @param source Browser CSS color string.
 * @returns Numeric sRGB channels and alpha.
 */
export function parseCssColor(source: string): CssColor {
  const hex = source.match(HEX_COLOR_PATTERN);
  if (hex?.groups !== undefined) {
    return {
      alpha: 1,
      blue: Number.parseInt(hex.groups.blue ?? "", 16),
      green: Number.parseInt(hex.groups.green ?? "", 16),
      red: Number.parseInt(hex.groups.red ?? "", 16),
    };
  }

  const rgb = source.match(RGB_COLOR_PATTERN);
  if (rgb?.groups !== undefined) {
    return validatedColor({
      alpha: rgb.groups.alpha === undefined ? 1 : Number(rgb.groups.alpha),
      blue: Number(rgb.groups.blue),
      green: Number(rgb.groups.green),
      red: Number(rgb.groups.red),
    }, source);
  }

  throw new Error(`unsupported CSS color: "${source}"`);
}

/**
 * Composites a foreground color over a background color.
 *
 * @param foreground Foreground sRGB color.
 * @param background Background sRGB color.
 * @returns The resulting sRGB color.
 */
export function compositeColors(foreground: CssColor, background: CssColor): CssColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) return { alpha: 0, blue: 0, green: 0, red: 0 };
  const channel = (foregroundChannel: number, backgroundChannel: number): number =>
    (
      foregroundChannel * foreground.alpha +
      backgroundChannel * background.alpha * (1 - foreground.alpha)
    ) / alpha;
  return {
    alpha,
    blue: channel(foreground.blue, background.blue),
    green: channel(foreground.green, background.green),
    red: channel(foreground.red, background.red),
  };
}

function linearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: CssColor): number {
  if (color.alpha !== 1) throw new Error("contrast ratio requires opaque colors");
  return 0.2126 * linearChannel(color.red) +
    0.7152 * linearChannel(color.green) +
    0.0722 * linearChannel(color.blue);
}

/**
 * Calculates the WCAG contrast ratio for two opaque sRGB colors.
 *
 * @param first First opaque color.
 * @param second Second opaque color.
 * @returns Contrast ratio from 1 through 21.
 */
export function contrastRatio(first: CssColor, second: CssColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
