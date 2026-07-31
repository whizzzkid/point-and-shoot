import type { ComponentChildren, JSX } from "preact";

/** Props accepted by {@link IconButton}. */
export interface IconButtonProps {
  readonly icon: ComponentChildren;
  readonly label: string;
  readonly size?: number;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

/**
 * Renders an icon-only toolbar button with a visible pressed state.
 *
 * @param props Icon, accessible label, size, pressed state, and click callback.
 * @returns The icon button.
 */
export function IconButton(
  { icon, label, size = 20, active = false, disabled = false, onClick }: IconButtonProps,
): JSX.Element {
  const style = {
    "--ps-icon-button-size": `calc(${size}px + var(--space-4))`,
  } as JSX.CSSProperties;
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="ps-icon-button"
      disabled={disabled}
      onClick={onClick}
      style={style}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}
