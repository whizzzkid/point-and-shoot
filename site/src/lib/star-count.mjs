/**
 * Formats the repository star count resolved at build time by `site/scripts/run-astro.mjs`.
 *
 * Kept DOM-free and separate from the layout so the rounding and rejection rules are unit-testable
 * without rendering Astro. The count arrives from a network call that is allowed to fail, so every
 * shape other than a usable positive integer collapses to `null` and the header renders a plain
 * repository link instead of a badge.
 */

/** Counts at or above this collapse to thousands, keeping the badge a stable width. */
const THOUSAND = 1000;

/** Counts at or above this collapse to millions rather than reading as a four-digit `k` value. */
const MILLION = 1000 * THOUSAND;

/**
 * Truncates rather than rounds so the badge never claims a milestone the repository has not reached.
 *
 * @param {number} value Count scaled into its unit.
 * @param {string} unit Unit suffix to append.
 * @returns {string} One-decimal string with a trailing zero trimmed.
 */
function scaled(value, unit) {
  const truncated = Math.floor(value * 10) / 10;
  return `${Number.isInteger(truncated) ? truncated.toFixed(0) : truncated.toFixed(1)}${unit}`;
}

/**
 * @param {unknown} count Raw `stargazers_count` from the build-time projection, or anything at all
 *   if the projection failed.
 * @returns {string | null} Display string, or `null` when there is no count worth showing. Zero
 *   returns `null` too: an empty badge is noise, not social proof.
 */
export function formatStarCount(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;

  const whole = Math.floor(count);
  if (whole < 1) return null;
  if (whole < THOUSAND) return String(whole);
  if (whole < MILLION) return scaled(whole / THOUSAND, "k");
  return scaled(whole / MILLION, "m");
}
