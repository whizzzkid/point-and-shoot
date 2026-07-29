/// <reference lib="dom" />

import type { JSX } from "preact";

/** Props accepted by {@link Switch}. */
export interface SwitchProps {
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
 * @param props The controlled state and change callback.
 * @returns The switch control.
 */
export function Switch({ checked = false, onChange }: SwitchProps): JSX.Element {
  return (
    <button
      aria-checked={checked}
      className="ps-switch"
      onClick={() => onChange?.(!checked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="ps-switch__thumb" />
    </button>
  );
}
