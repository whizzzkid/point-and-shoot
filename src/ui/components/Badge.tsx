import type { ComponentChildren, JSX } from "preact";

/** Props accepted by {@link Badge}. */
export interface BadgeProps {
  readonly children?: ComponentChildren;
  readonly tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

/** Props accepted by {@link Tag}. */
export interface TagProps {
  readonly children?: ComponentChildren;
  readonly onRemove?: () => void;
}

/**
 * Renders a compact status pill in technical mono type.
 *
 * @param props Status content and semantic tone.
 * @returns The status badge.
 */
export function Badge({ children, tone = "neutral" }: BadgeProps): JSX.Element {
  return <span className="ps-badge" data-tone={tone}>{children}</span>;
}

/**
 * Renders a compact tag with an optional keyboard-operable remove action.
 *
 * @param props Tag content and optional removal callback.
 * @returns The tag.
 */
export function Tag({ children, onRemove }: TagProps): JSX.Element {
  return (
    <span className="ps-tag">
      <span>{children}</span>
      {onRemove === undefined
        ? null
        : (
          <button aria-label="Remove tag" onClick={onRemove} type="button">
            <span aria-hidden="true" className="ps-close-mark" />
          </button>
        )}
    </span>
  );
}
