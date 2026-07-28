import type { JSX } from "preact";

/** A highlighted rectangle expressed as fractions of the captured image. */
export interface CaptureMinimapRegion {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Props accepted by {@link CaptureMinimap}. */
export interface CaptureMinimapProps {
  readonly width?: number;
  readonly height?: number;
  readonly region?: CaptureMinimapRegion;
  readonly label?: string;
  readonly onClick?: () => void;
  /** Captured WebP data URI. When absent, the design specimen's skeleton proxy is rendered. */
  readonly screenshot?: string;
  /** Shows a semantic clipped marker when capture scaling truncated the requested region. */
  readonly truncated?: boolean;
}

const DEFAULT_REGION: CaptureMinimapRegion = { x: 0.42, y: 0.3, w: 0.34, h: 0.16 };

const SKELETON_ROWS = [
  { top: 0.12, left: 0.08, width: 0.5 },
  { top: 0.3, left: 0.08, width: 0.28 },
  { top: 0.44, left: 0.08, width: 0.72 },
  { top: 0.58, left: 0.08, width: 0.6 },
  { top: 0.74, left: 0.08, width: 0.44 },
] as const;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function minimapContents(
  region: CaptureMinimapRegion,
  screenshot: string | undefined,
  truncated: boolean,
): JSX.Element {
  const left = clampUnit(region.x);
  const top = clampUnit(region.y);
  const width = Math.min(clampUnit(region.w), 1 - left);
  const height = Math.min(clampUnit(region.h), 1 - top);
  const regionStyle = {
    "--ps-region-left": `${left * 100}%`,
    "--ps-region-top": `${top * 100}%`,
    "--ps-region-width": `${width * 100}%`,
    "--ps-region-height": `${height * 100}%`,
  } as JSX.CSSProperties;

  return (
    <>
      {screenshot === undefined
        ? SKELETON_ROWS.map((row) => (
          <span
            aria-hidden="true"
            className="ps-capture-minimap__row"
            key={row.top}
            style={{
              left: `${row.left * 100}%`,
              top: `${row.top * 100}%`,
              width: `${row.width * 100}%`,
            }}
          />
        ))
        : <img alt="" src={screenshot} />}
      {screenshot === undefined
        ? <span aria-hidden="true" className="ps-capture-minimap__region" style={regionStyle} />
        : null}
      {truncated ? <span className="ps-capture-minimap__clipped">Clipped</span> : null}
    </>
  );
}

/**
 * Renders a scaled screenshot with the captured region outlined.
 *
 * @param props Size, fractional region, accessible label, action, image, and truncation state.
 * @returns The capture thumbnail.
 */
export function CaptureMinimap(
  {
    width = 72,
    height = 54,
    region = DEFAULT_REGION,
    label = "Captured region",
    onClick,
    screenshot,
    truncated = false,
  }: CaptureMinimapProps,
): JSX.Element {
  const style = {
    "--ps-minimap-width": `${width}px`,
    "--ps-minimap-height": `${height}px`,
  } as JSX.CSSProperties;
  const contents = minimapContents(region, screenshot, truncated);

  if (onClick !== undefined) {
    return (
      <button
        aria-label={label}
        className="ps-capture-minimap"
        onClick={onClick}
        style={style}
        type="button"
      >
        {contents}
      </button>
    );
  }
  return (
    <span aria-label={label} className="ps-capture-minimap" role="img" style={style}>
      {contents}
    </span>
  );
}
