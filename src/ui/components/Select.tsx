/// <reference lib="dom" />

import type { JSX } from "preact";

/** One labelled value accepted by {@link Select}. */
export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

/** Props accepted by {@link Select}. */
export interface SelectProps {
  readonly options: readonly (SelectOption | string)[];
  readonly value?: string;
  readonly onChange?: (value: string) => void;
}

/**
 * Renders a native select so platform keyboard and assistive-technology behavior stays intact.
 *
 * @param props Available options, controlled value, and change callback.
 * @returns The select control.
 */
export function Select({ options, value, onChange }: SelectProps): JSX.Element {
  return (
    <span className="ps-select">
      <select
        className="ps-select__control"
        onChange={(event) => onChange?.(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
      <span aria-hidden="true" className="ps-select__chevron" />
    </span>
  );
}
