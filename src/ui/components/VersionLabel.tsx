import type { JSX } from "preact";

/** Props accepted by {@link VersionLabel}. */
export interface VersionLabelProps {
  readonly version: string;
}

/**
 * Shows the packaged extension version unobtrusively in a surface corner.
 *
 * @param props Packaged extension version.
 * @returns A non-interactive, assistive-technology-labelled version marker.
 */
export function VersionLabel({ version }: VersionLabelProps): JSX.Element {
  return (
    <small
      aria-label={`Version ${version}`}
      className="ps-version-label"
    >
      v{version}
    </small>
  );
}
