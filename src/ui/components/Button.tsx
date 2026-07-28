import type { ComponentChildren, JSX } from "preact";

/** Props accepted by {@link Button}. */
export interface ButtonProps {
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
 * @param props Visual variant, size, content, state, and click callback.
 * @returns The button.
 */
export function Button(
  {
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
