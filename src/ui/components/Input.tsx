/// <reference lib="dom" />

import type { JSX } from "preact";

/** Props accepted by {@link Input}. */
export interface InputProps {
  /** Accessible name when it should differ from placeholder guidance. */
  readonly accessibleName?: string;
  readonly autoFocus?: boolean;
  readonly elementRef?: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
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
 * @param props Accessible name, placeholder, value, callback, and text-field options.
 * @returns The text field.
 */
export function Input(
  {
    accessibleName,
    autoFocus = false,
    elementRef,
    placeholder,
    value,
    onChange,
    mono = false,
    multiline = false,
    rows = 4,
  }: InputProps,
): JSX.Element {
  const resolvedAccessibleName = accessibleName ??
    placeholder ??
    (mono ? "Technical value" : "Text input");
  if (multiline) {
    return (
      <textarea
        aria-label={resolvedAccessibleName}
        autoFocus={autoFocus}
        className="ps-input"
        data-mono={mono}
        onInput={(event) => onChange?.(event.currentTarget.value)}
        placeholder={placeholder}
        {...(elementRef === undefined ? {} : { ref: elementRef })}
        rows={rows}
        value={value}
      />
    );
  }
  return (
    <input
      aria-label={resolvedAccessibleName}
      autoFocus={autoFocus}
      className="ps-input"
      data-mono={mono}
      onInput={(event) => onChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      {...(elementRef === undefined ? {} : { ref: elementRef })}
      type="text"
      value={value}
    />
  );
}
