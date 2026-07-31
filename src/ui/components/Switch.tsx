/// <reference lib="dom" />

import type { JSX } from "preact";

/** Props accepted by {@link Switch}. */
export interface SwitchProps {
  /** Accessible name for standalone use outside a wrapping label. */
  readonly accessibleName?: string;
  /** Whether the switch is on. */
  readonly checked?: boolean;
  /** Called with the next checked state after one user activation. */
  readonly onChange?: (checked: boolean) => void;
}

/**
 * Renders a controlled, keyboard-operable binary switch.
 *
 * Place the switch inside a `<label>` so its accessible name describes the setting it controls.
 *
 * @param props Accessible name, controlled state, and change callback.
 * @returns The switch control.
 */
export function Switch(
  { accessibleName, checked = false, onChange }: SwitchProps,
): JSX.Element {
  return (
    <button
      aria-checked={checked}
      aria-label={accessibleName}
      className="ps-switch"
      onClick={() => onChange?.(!checked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="ps-switch__thumb" />
    </button>
  );
}
