/// <reference lib="dom" />

import type { JSX } from "preact";

/** Props accepted by {@link Checkbox}. */
export interface CheckboxProps {
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (checked: boolean) => void;
  readonly label?: string;
}

/**
 * Renders a native checkbox with the design-system treatment.
 *
 * @param props Controlled state, disabled state, change callback, and visible label.
 * @returns The labelled checkbox.
 */
export function Checkbox(
  { checked = false, disabled = false, onChange, label }: CheckboxProps,
): JSX.Element {
  return (
    <label className="ps-checkbox" data-disabled={disabled}>
      <input
        aria-label={label ?? "Toggle option"}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="ps-checkbox__box">
        <span className="ps-checkbox__check" />
      </span>
      {label === undefined ? null : <span>{label}</span>}
    </label>
  );
}
