/// <reference lib="dom" />

import type { ComponentChildren, JSX } from "preact";
import { useId, useState } from "preact/hooks";

/** Props accepted by {@link Tooltip}. */
export interface TooltipProps {
  readonly label: string;
  readonly children?: ComponentChildren;
}

/**
 * Renders a tooltip on pointer hover and keyboard focus.
 *
 * @param props Tooltip text and its trigger content.
 * @returns The trigger wrapper and tooltip.
 */
export function Tooltip({ label, children }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  return (
    <span
      aria-describedby={visible ? tooltipId : undefined}
      className="ps-tooltip"
      onBlurCapture={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setVisible(false);
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      role="group"
    >
      {children}
      <span
        aria-hidden={!visible}
        className="ps-tooltip__bubble"
        data-visible={visible}
        id={tooltipId}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
