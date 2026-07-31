import type { ComponentChildren, JSX } from "preact";

/** Props accepted by {@link Button}. */
export interface ButtonProps {
  readonly autoFocus?: boolean;
  readonly variant?: "primary" | "secondary" | "ghost" | "danger";
  readonly size?: "sm" | "md" | "lg";
  readonly icon?: ComponentChildren;
  readonly children?: ComponentChildren;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

/**
 * Renders the shared text-button treatment used across extension surfaces.
 *
 * @param props Focus behavior, visual variant, size, content, state, and click callback.
 * @returns The button.
 */
export function Button(
  {
    autoFocus = false,
    variant = "primary",
    size = "md",
    icon,
    children,
    disabled = false,
    onClick,
  }: ButtonProps,
): JSX.Element {
  return (
    <button
      autoFocus={autoFocus}
      className="ps-button"
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}
