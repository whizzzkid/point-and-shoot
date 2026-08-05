/// <reference lib="dom" />

import type { A2ATransportBinding } from "./contracts.ts";
import { A2AClientError, type A2ATimeoutStage } from "./errors.ts";

/** Limits and cancellation applied while reading one remote response. */
export interface BoundedResponseOptions {
  /** Caller-owned cancellation signal. */
  readonly signal: AbortSignal;
  /** Maximum number of response bytes accepted before parsing. */
  readonly maxBytes: number;
  /** Maximum time to receive response headers. */
  readonly requestMs: number;
  /** Maximum time from headers to the first body bytes. */
  readonly firstByteMs: number;
  /** Maximum time between later body chunks. */
  readonly streamIdleMs: number;
  /** Selected binding for error metadata. */
  readonly transport?: A2ATransportBinding | undefined;
}

/** Bounded parsed JSON plus safe HTTP response metadata. */
export interface BoundedJsonResponse {
  /** Whether the HTTP status is in the successful range. */
  readonly ok: boolean;
  /** Numeric HTTP response status. */
  readonly status: number;
  /** Parsed but not yet protocol-validated JSON value. */
  readonly value: unknown;
}

/**
 * Fetches, bounds, and parses one JSON response without exposing remote body text in errors.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param request - Fully constructed request.
 * @param options - Cancellation, byte, and timeout limits.
 * @returns The parsed but not yet protocol-validated JSON value.
 */
export async function readBoundedJson(
  fetchImpl: typeof fetch,
  request: Request,
  options: BoundedResponseOptions,
): Promise<unknown> {
  return (await readBoundedJsonResponse(fetchImpl, request, options)).value;
}

/**
 * Fetches, bounds, and parses JSON while optionally returning non-success protocol bodies.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param request - Fully constructed request.
 * @param options - Cancellation, byte, and timeout limits.
 * @param acceptHttpErrors - Whether a bounded non-success body should be returned for protocol
 * error inspection.
 * @returns Parsed JSON and safe HTTP metadata.
 */
export async function readBoundedJsonResponse(
  fetchImpl: typeof fetch,
  request: Request,
  options: BoundedResponseOptions,
  acceptHttpErrors = false,
): Promise<BoundedJsonResponse> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal.reason);
  options.signal.addEventListener("abort", abortFromCaller, { once: true });

  try {
    if (options.signal.aborted) {
      throw abortedError(options.transport);
    }
    const response = await fetchWithTimeout(fetchImpl, request, controller, options);
    assertAcceptableResponse(response, options, acceptHttpErrors);
    const bytes = await readResponseBytes(response, controller, options);
    try {
      return {
        ok: response.ok,
        status: response.status,
        value: JSON.parse(new TextDecoder().decode(bytes)),
      };
    } catch (cause) {
      throw new A2AClientError("Remote response is not valid JSON", {
        code: "invalid-response",
        transport: options.transport,
        cause,
      });
    }
  } finally {
    options.signal.removeEventListener("abort", abortFromCaller);
  }
}

/**
 * Fetches a response and yields its body chunks under request and read timeouts.
 *
 * The declared length is bounded before reading. The caller must additionally bound its semantic
 * streaming units, such as individual SSE frames, before parsing them.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param request - Fully constructed request.
 * @param options - Cancellation, declared-byte, and timeout limits.
 * @param inspectResponse - Optional synchronous header inspection performed before body reads.
 * @returns An asynchronous iterable of response bytes.
 */
export async function* streamBoundedResponse(
  fetchImpl: typeof fetch,
  request: Request,
  options: BoundedResponseOptions,
  inspectResponse?: (response: Response) => void,
): AsyncIterable<Uint8Array> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const abortFromCaller = () => {
    controller.abort(options.signal.reason);
  };
  options.signal.addEventListener("abort", abortFromCaller, { once: true });

  try {
    if (options.signal.aborted) {
      throw abortedError(options.transport);
    }
    const response = await fetchWithTimeout(fetchImpl, request, controller, options);
    assertAcceptableResponse(response, options);
    inspectResponse?.(response);
    if (response.body === null) {
      throw new A2AClientError("A2A endpoint returned an empty response body", {
        code: "invalid-response",
        transport: options.transport,
      });
    }

    reader = response.body.getReader();
    let firstRead = true;
    while (true) {
      const stage: A2ATimeoutStage = firstRead ? "first-byte" : "stream-idle";
      const timeoutMs = firstRead ? options.firstByteMs : options.streamIdleMs;
      const result = await readWithTimeout(
        reader,
        controller,
        options.signal,
        timeoutMs,
        stage,
        options.transport,
      );
      if (result.done) {
        break;
      }
      firstRead = false;
      yield result.value;
    }
  } catch (cause) {
    if (cause instanceof A2AClientError) {
      throw cause;
    }
    if (options.signal.aborted) {
      throw abortedError(options.transport);
    }
    throw new A2AClientError("Failed while reading the A2A response stream", {
      code: "transport-error",
      retryable: true,
      transport: options.transport,
      cause,
    });
  } finally {
    options.signal.removeEventListener("abort", abortFromCaller);
    if (reader !== undefined) {
      try {
        await reader.cancel();
      } catch {
        // The source may already be errored or aborted; the original failure remains authoritative.
      }
      reader.releaseLock();
    }
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  request: Request,
  controller: AbortController,
  options: BoundedResponseOptions,
): Promise<Response> {
  let timeoutIdentifier: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutIdentifier = setTimeout(() => {
      reject(timeoutError("request", options.transport));
      controller.abort();
    }, options.requestMs);
  });
  const cancellation = new Promise<never>((_, reject) => {
    abortListener = () => reject(abortedError(options.transport));
    options.signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    return await Promise.race([
      fetchImpl(request, { signal: controller.signal }),
      timeout,
      cancellation,
    ]);
  } catch (cause) {
    if (cause instanceof A2AClientError) {
      throw cause;
    }
    if (options.signal.aborted) {
      throw abortedError(options.transport);
    }
    throw new A2AClientError("A2A transport request failed", {
      code: "transport-error",
      retryable: true,
      transport: options.transport,
      cause,
    });
  } finally {
    clearTimeout(timeoutIdentifier);
    if (abortListener !== undefined) {
      options.signal.removeEventListener("abort", abortListener);
    }
  }
}

function assertAcceptableResponse(
  response: Response,
  options: BoundedResponseOptions,
  acceptHttpErrors = false,
): void {
  if (!response.ok && !acceptHttpErrors) {
    void response.body?.cancel();
    throw new A2AClientError(`A2A endpoint returned HTTP ${response.status}`, {
      code: "http-error",
      retryable: isRetryableHttpStatus(response.status),
      status: response.status,
      transport: options.transport,
    });
  }

  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength === null) {
    return;
  }
  const parsedLength = Number(declaredLength);
  if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
    void response.body?.cancel();
    throw new A2AClientError("A2A endpoint returned an invalid Content-Length", {
      code: "invalid-response",
      transport: options.transport,
    });
  }
  if (parsedLength > options.maxBytes) {
    void response.body?.cancel();
    throw responseTooLargeError(options.transport);
  }
}

async function readResponseBytes(
  response: Response,
  controller: AbortController,
  options: BoundedResponseOptions,
): Promise<Uint8Array> {
  if (response.body === null) {
    throw new A2AClientError("A2A endpoint returned an empty response body", {
      code: "invalid-response",
      transport: options.transport,
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let firstRead = true;
  try {
    while (true) {
      const stage: A2ATimeoutStage = firstRead ? "first-byte" : "stream-idle";
      const timeoutMs = firstRead ? options.firstByteMs : options.streamIdleMs;
      const result = await readWithTimeout(
        reader,
        controller,
        options.signal,
        timeoutMs,
        stage,
        options.transport,
      );
      if (result.done) {
        break;
      }
      firstRead = false;
      totalBytes += result.value.byteLength;
      if (totalBytes > options.maxBytes) {
        controller.abort();
        throw responseTooLargeError(options.transport);
      }
      chunks.push(result.value);
    }
  } catch (cause) {
    if (cause instanceof A2AClientError) {
      throw cause;
    }
    if (options.signal.aborted) {
      throw abortedError(options.transport);
    }
    throw new A2AClientError("Failed while reading the A2A response", {
      code: "transport-error",
      retryable: true,
      transport: options.transport,
      cause,
    });
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: AbortController,
  signal: AbortSignal,
  timeoutMs: number,
  stage: A2ATimeoutStage,
  transport?: A2ATransportBinding,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) {
    throw abortedError(transport);
  }
  let timeoutIdentifier: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutIdentifier = setTimeout(() => {
      reject(timeoutError(stage, transport));
      controller.abort();
      void reader.cancel().catch(() => {
        // A fetch-backed reader may reject cancellation after its signal aborts. The typed timeout
        // is authoritative; contain the redundant transport rejection instead of leaking it.
      });
    }, timeoutMs);
  });
  const cancellation = new Promise<never>((_, reject) => {
    abortListener = () => {
      reject(abortedError(transport));
      controller.abort(signal.reason);
      void reader.cancel(signal.reason).catch(() => {
        // The caller-owned cancellation is authoritative when the transport is already closing.
      });
    };
    signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    return await Promise.race([reader.read(), timeout, cancellation]);
  } finally {
    clearTimeout(timeoutIdentifier);
    if (abortListener !== undefined) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}

function timeoutError(
  timeout: A2ATimeoutStage,
  transport?: A2ATransportBinding,
): A2AClientError {
  return new A2AClientError(`A2A ${timeout} timeout expired`, {
    code: "timeout",
    retryable: true,
    timeout,
    transport,
  });
}

function abortedError(transport?: A2ATransportBinding): A2AClientError {
  return new A2AClientError("A2A request was aborted", {
    code: "aborted",
    transport,
  });
}

function responseTooLargeError(transport?: A2ATransportBinding): A2AClientError {
  return new A2AClientError("A2A response exceeds the configured byte limit", {
    code: "response-too-large",
    transport,
  });
}

/**
 * Classifies HTTP statuses that may succeed when repeated unchanged.
 *
 * @param status - HTTP response status.
 * @returns Whether retrying may be useful.
 */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
