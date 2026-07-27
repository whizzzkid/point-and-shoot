export interface CaptureMinimapProps {
  /** Rendered width in px. Default 72. */
  width?: number;
  /** Rendered height in px. Default 54. */
  height?: number;
  /** Highlighted region as fractions (0–1) of the captured page. */
  region?: { x: number; y: number; w: number; h: number };
  /** Accessible label / tooltip, e.g. "Captured region on acme.cloud/pricing". */
  label?: string;
  /** Click to open the full-size capture. */
  onClick?: () => void;
}
export declare function CaptureMinimap(props: CaptureMinimapProps): JSX.Element;
