import type { ComponentChildren, JSX } from "preact";

/** Props accepted by {@link Card}. */
export interface CardProps {
  readonly children?: ComponentChildren;
  readonly padding?: string;
  readonly raised?: boolean;
  readonly style?: JSX.CSSProperties;
}

/**
 * Renders the base surface used for cards, popovers, and panel sections.
 *
 * @param props Content, token-derived padding, elevation, and optional style additions.
 * @returns The card surface.
 */
export function Card(
  {
    children,
    padding = "var(--space-4)",
    raised = false,
    style,
  }: CardProps,
): JSX.Element {
  const cardStyle = {
    "--ps-card-padding": padding,
    ...style,
  } as JSX.CSSProperties;
  return (
    <div className="ps-card" data-raised={raised} style={cardStyle}>
      {children}
    </div>
  );
}
