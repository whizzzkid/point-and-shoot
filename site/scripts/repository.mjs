/**
 * Projects the repository's public star count into `site/.generated/repository.json` at build time.
 *
 * A visitor-side widget — a shields.io image or GitHub's buttons iframe — would turn every
 * documentation page view into a third-party request that reveals what the reader is reading.
 * ADR-0009 rules that out, so the count is resolved once during the build, exactly like the vendored
 * fonts and icon sprite, and ships as static markup.
 *
 * The build must not depend on that call succeeding. Offline development, the unauthenticated
 * rate limit, and a GitHub outage all resolve to `stars: null`, which renders the header repository
 * link with no badge rather than failing the build over decoration.
 */
import { writeFile } from "node:fs/promises";

/** @typedef {{ slug: string, url: string, stars: number | null }} RepositoryProjection */

export const REPOSITORY_SLUG = "whizzzkid/point-and-shoot";
export const REPOSITORY_URL = `https://github.com/${REPOSITORY_SLUG}`;

/** Long enough for a cold API response, short enough that an unreachable host cannot stall CI. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Reads `stargazers_count` for one repository, reporting rather than throwing on every failure.
 *
 * @param {object} [options] Injection seams; every one has a production default.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation, replaced in tests.
 * @param {string} [options.slug] `owner/name` of the repository to query.
 * @param {number} [options.timeoutMs] Abort budget for the request.
 * @param {(message: string) => void} [options.warn] Sink for the reason a count is unavailable.
 * @returns {Promise<number | null>} The count, or `null` when it could not be established.
 */
export async function readStarCount(options = {}) {
  const {
    fetchImpl = fetch,
    slug = REPOSITORY_SLUG,
    timeoutMs = REQUEST_TIMEOUT_MS,
    warn = console.warn,
  } = options;

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${slug}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "point-and-shoot-site-build",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      warn(`Star count unavailable: GitHub responded ${response.status}.`);
      return null;
    }

    const payload = await response.json();
    const stars = payload?.stargazers_count;

    if (typeof stars !== "number" || !Number.isFinite(stars)) {
      warn("Star count unavailable: response carried no numeric stargazers_count.");
      return null;
    }

    return stars;
  } catch (cause) {
    warn(`Star count unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    return null;
  }
}

/**
 * Writes the projection the site layout imports.
 *
 * @param {string} outputPath Absolute path of the JSON file to write.
 * @param {object} [options] Same seams as {@link readStarCount}, plus `enabled`.
 * @param {boolean} [options.enabled] When `false`, skip the network call and project `null`.
 * @returns {Promise<RepositoryProjection>} The projection that was written.
 */
export async function writeRepositoryProjection(outputPath, options = {}) {
  const { enabled = true, ...readOptions } = options;
  const slug = readOptions.slug ?? REPOSITORY_SLUG;
  const stars = enabled ? await readStarCount({ ...readOptions, slug }) : null;
  /** @type {RepositoryProjection} */
  const projection = { slug, url: `https://github.com/${slug}`, stars };

  await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`);
  return projection;
}
