import type { BrowserShim } from "../browser.ts";

/** Exact origin plus each browser's narrowest supported runtime permission pattern. */
export interface RemoteOriginGrant {
  readonly origin: string;
  readonly chromePattern: string;
  readonly firefoxPattern: string;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Normalizes a user-provided remote-agent URL into exact and browser-specific grant forms.
 *
 * @param candidate The Agent Card or interface URL entered by the user.
 * @returns The exact allowlist origin and runtime permission patterns.
 * @throws {TypeError} When the URL is malformed, embeds credentials or a fragment, uses an
 * unsupported scheme, or sends plaintext HTTP beyond an explicitly supported loopback host.
 */
export function normalizeRemoteOrigin(candidate: string): RemoteOriginGrant {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError("Remote agent URL must be an absolute URL");
  }

  if (url.username !== "" || url.password !== "") {
    throw new TypeError("Remote agent URL must not contain credentials");
  }
  if (url.hash !== "") {
    throw new TypeError("Remote agent URL must not contain a fragment");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Remote agent URL must use HTTPS or supported loopback HTTP");
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new TypeError("Plaintext HTTP is allowed only for supported loopback hosts");
  }

  const chromePattern = `${url.protocol}//${url.host}/*`;
  const firefoxPattern = `${url.protocol}//${url.hostname}/*`;
  return { origin: url.origin, chromePattern, firefoxPattern };
}

/**
 * Requests an exact remote-agent origin after checking for a prior runtime grant.
 *
 * @param permissions The normalized browser permission adapter.
 * @param grant The origin grant returned by {@link normalizeRemoteOrigin}.
 * @returns Whether the origin was already granted or the user accepted the browser prompt.
 */
export async function requestRemoteOrigin(
  permissions: BrowserShim["permissions"],
  grant: RemoteOriginGrant,
): Promise<boolean> {
  const pattern = permissions.engine === "chrome" ? grant.chromePattern : grant.firefoxPattern;
  const request = { origins: [pattern] } as const;
  if (await permissions.contains(request)) {
    return true;
  }
  return await permissions.request(request);
}
