/// <reference lib="dom" />

import type { ComponentChildren, JSX } from "preact";
import { useId, useLayoutEffect, useRef } from "preact/hooks";

/** Props accepted by {@link Dialog}. */
export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children?: ComponentChildren;
  readonly onClose?: () => void;
  readonly footer?: ComponentChildren;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
}

/**
 * Renders a modal dialog that traps keyboard focus while open and restores the opener on close.
 *
 * @param props Controlled visibility, content, footer actions, and close callback.
 * @returns The modal while open, or `null` while closed.
 */
export function Dialog(
  { open, title, children, onClose, footer }: DialogProps,
): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open || dialogRef.current === null) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const firstFocusable = focusableElements(dialogRef.current)[0];
    firstFocusable?.focus();

    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab" || dialogRef.current === null) return;

    const focusable = focusableElements(dialogRef.current);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="ps-dialog-backdrop">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="ps-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="ps-dialog__header">
          <h3 id={titleId}>{title}</h3>
          {onClose === undefined ? null : (
            <button
              aria-label="Close dialog"
              className="ps-icon-action"
              onClick={onClose}
              type="button"
            >
              <span aria-hidden="true" className="ps-close-mark" />
            </button>
          )}
        </header>
        <div className="ps-dialog__body">{children}</div>
        {footer === undefined ? null : <footer className="ps-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}
