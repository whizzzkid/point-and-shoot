/** Controls the mounted state of one overlay within a content-script realm. */
export interface OverlayLifecycle {
  /** Returns whether this lifecycle currently owns a mounted overlay. */
  isMounted(): boolean;
  /** Toggles the overlay and returns its new mounted state. */
  toggle(): boolean;
  /** Tears down the overlay if it is mounted. Safe to call repeatedly. */
  destroy(): void;
}

/**
 * Creates a retryable single-mount lifecycle around an overlay factory.
 *
 * @param mount Creates the overlay and returns its teardown callback.
 * @returns A lifecycle that never retains more than one live mount.
 */
export function createOverlayLifecycle(mount: () => () => void): OverlayLifecycle {
  let teardown: (() => void) | undefined;

  return {
    isMounted(): boolean {
      return teardown !== undefined;
    },
    toggle(): boolean {
      if (teardown !== undefined) {
        const currentTeardown = teardown;
        teardown = undefined;
        currentTeardown();
        return false;
      }

      teardown = mount();
      return true;
    },
    destroy(): void {
      if (teardown === undefined) return;
      const currentTeardown = teardown;
      teardown = undefined;
      currentTeardown();
    },
  };
}
