/// <reference lib="dom" />

import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

/** Props accepted by {@link Toast}. */
export interface ToastProps {
  readonly tone?: "neutral" | "success" | "danger";
  readonly children?: ComponentChildren;
  readonly onClose?: () => void;
}

/** Functional visibility timeout; separate from the design system's motion-duration tokens. */
const TOAST_DISMISS_DELAY_MS = 5_000;

/**
 * Renders a transient status message and removes it after its visibility timer.
 *
 * @param props Status tone, message, and optional close notification.
 * @returns The toast while visible, or `null` after dismissal.
 */
export function Toast(
  { tone = "neutral", children, onClose }: ToastProps,
): JSX.Element | null {
  const [visible, setVisible] = useState(true);
  const dismissed = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    setVisible(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (onClose === undefined) return;
    dismissed.current = false;
    setVisible(true);
    const timeout = globalThis.setTimeout(dismiss, TOAST_DISMISS_DELAY_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [children, dismiss, onClose, tone]);

  if (!visible) return null;

  const urgent = tone === "danger";
  return (
    <div
      aria-live={urgent ? "assertive" : "polite"}
      className="ps-toast"
      data-tone={tone}
      role={urgent ? "alert" : "status"}
    >
      <span aria-hidden="true" className="ps-toast__status" />
      <span className="ps-toast__message">{children}</span>
      {onClose === undefined ? null : (
        <button
          aria-label="Dismiss notification"
          className="ps-icon-action"
          onClick={dismiss}
          type="button"
        >
          <span aria-hidden="true" className="ps-close-mark" />
        </button>
      )}
    </div>
  );
}
