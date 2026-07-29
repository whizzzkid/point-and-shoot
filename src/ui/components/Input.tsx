/// <reference lib="dom" />

import type { JSX } from "preact";

/** Props accepted by {@link Input}. */
export interface InputProps {
  readonly placeholder?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly mono?: boolean;
  readonly multiline?: boolean;
  readonly rows?: number;
}

/**
 * Renders a single-line or multiline controlled text field.
 *
 * @param props Placeholder, value, callback, technical-text treatment, and textarea options.
 * @returns The text field.
 */
export function Input(
  {
    placeholder,
    value,
    onChange,
    mono = false,
    multiline = false,
    rows = 4,
  }: InputProps,
): JSX.Element {
  const accessibleName = placeholder ?? (mono ? "Technical value" : "Text input");
  if (multiline) {
    return (
      <textarea
        aria-label={accessibleName}
        className="ps-input"
        data-mono={mono}
        onInput={(event) => onChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    );
  }
  return (
    <input
      aria-label={accessibleName}
      className="ps-input"
      data-mono={mono}
      onInput={(event) => onChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}
