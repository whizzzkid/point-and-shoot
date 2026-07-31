/**
 * Bounded retry policy for Firefox's Marionette port handoff.
 *
 * @module
 */

/**
 * Marks a Firefox startup failure caused by the reserve-then-bind Marionette port handoff.
 */
export class MarionettePortHandoffError extends Error {
  override readonly name = "MarionettePortHandoffError";
}

/**
 * Retries a Firefox launch only when its Marionette port handoff failed.
 *
 * @param operation Launch attempt, numbered from one.
 * @param maximumAttempts Maximum number of process launches.
 * @param onRetry Optional observer called before another process launch.
 * @returns The first successful launch result.
 */
export async function retryMarionettePortHandoff<T>(
  operation: (attempt: number) => Promise<T>,
  maximumAttempts: number,
  onRetry: (error: MarionettePortHandoffError, nextAttempt: number) => void = () => {},
): Promise<T> {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!(error instanceof MarionettePortHandoffError) || attempt === maximumAttempts) {
        throw error;
      }
      onRetry(error, attempt + 1);
    }
  }

  throw new Error("Firefox startup retry loop ended without a result");
}
