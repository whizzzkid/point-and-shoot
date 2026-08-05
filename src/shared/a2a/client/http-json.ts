/// <reference lib="dom" />

import type {
  A2AClient,
  A2AClientLimits,
  A2AClientTarget,
  A2ARequestOptions,
} from "./contracts.ts";
import { A2AClientError } from "./errors.ts";
import type {
  GetTaskRequest,
  SendMessageResponse,
  StreamResponse,
  Task,
} from "./protocol.generated.ts";
import { isRetryableHttpStatus, readBoundedJsonResponse } from "./response.ts";
import { parseSseJson } from "./sse.ts";
import {
  validateSendMessageResponse,
  validateStreamResponse,
  validateTask,
} from "./validation.generated.ts";

type Validator = (value: unknown) => boolean;

/**
 * Creates a portable client bound to one validated HTTP+JSON interface.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param target - Selected HTTP+JSON v1 interface.
 * @param limits - Explicit remote-input and timeout limits.
 * @returns A portable A2A client.
 */
export function createHttpJsonClient(
  fetchImpl: typeof fetch,
  target: A2AClientTarget,
  limits: A2AClientLimits,
): A2AClient {
  if (target.transport !== "HTTP+JSON") {
    throw new A2AClientError("HTTP+JSON client requires an HTTP+JSON target", {
      code: "unsupported",
      transport: target.transport,
    });
  }
  const endpoint = target.url.href.replace(/\/+$/, "");

  const unary = async <T>(
    method: "GET" | "POST",
    path: string,
    body: object | undefined,
    requestOptions: A2ARequestOptions,
    validator: Validator,
    responseName: string,
  ): Promise<T> => {
    const request = createRequest(endpoint + path, method, body, requestOptions, false);
    const response = await readBoundedJsonResponse(fetchImpl, request, {
      signal: requestOptions.signal,
      maxBytes: limits.jsonBytes,
      requestMs: limits.requestMs,
      firstByteMs: limits.firstByteMs,
      streamIdleMs: limits.streamIdleMs,
      transport: "HTTP+JSON",
    }, true);
    if (!response.ok) {
      throw parseHttpError(response.value, response.status);
    }
    return validateResponse<T>(response.value, validator, responseName);
  };

  const streaming = async function* <T>(
    path: string,
    body: object | undefined,
    requestOptions: A2ARequestOptions,
    validator: Validator,
    responseName: string,
  ): AsyncIterable<T> {
    const request = createRequest(endpoint + path, "POST", body, requestOptions, true);
    for await (
      const value of parseSseJson(fetchImpl, request, {
        signal: requestOptions.signal,
        maxBytes: limits.sseFrameBytes,
        requestMs: limits.requestMs,
        firstByteMs: limits.firstByteMs,
        streamIdleMs: limits.streamIdleMs,
        transport: "HTTP+JSON",
      })
    ) {
      yield validateResponse<T>(value, validator, responseName);
    }
  };

  return {
    target,
    sendMessage(request, requestOptions) {
      const requestWithTenant = withTenant(request, target.tenant);
      return unary<SendMessageResponse>(
        "POST",
        tenantPath(requestWithTenant.tenant, "/message:send"),
        requestWithTenant,
        requestOptions,
        validateSendMessageResponse,
        "SendMessageResponse",
      );
    },
    sendMessageStream(request, requestOptions) {
      const requestWithTenant = withTenant(request, target.tenant);
      return streaming<StreamResponse>(
        tenantPath(requestWithTenant.tenant, "/message:stream"),
        requestWithTenant,
        requestOptions,
        validateStreamResponse,
        "StreamResponse",
      );
    },
    getTask(request, requestOptions) {
      const identifier = requireIdentifier(request.id, "GetTask");
      const tenant = request.tenant ?? target.tenant;
      const historyLength = aliasedHistoryLength(request);
      const query = historyLength === undefined
        ? ""
        : `?historyLength=${encodeURIComponent(String(historyLength))}`;
      return unary<Task>(
        "GET",
        tenantPath(tenant, `/tasks/${encodeURIComponent(identifier)}${query}`),
        undefined,
        requestOptions,
        validateTask,
        "Task",
      );
    },
    subscribeToTask(request, requestOptions) {
      const identifier = requireIdentifier(request.id, "SubscribeToTask");
      return streaming<StreamResponse>(
        tenantPath(
          request.tenant ?? target.tenant,
          `/tasks/${encodeURIComponent(identifier)}:subscribe`,
        ),
        undefined,
        requestOptions,
        validateStreamResponse,
        "StreamResponse",
      );
    },
  };
}

function createRequest(
  url: string,
  method: "GET" | "POST",
  body: object | undefined,
  options: A2ARequestOptions,
  streaming: boolean,
): Request {
  const headers = new Headers(options.serviceParameters);
  headers.set("A2A-Version", "1.0");
  headers.set("Accept", streaming ? "text/event-stream" : "application/json");
  headers.set("Content-Type", "application/json");
  if (body === undefined) {
    return new Request(url, { method, headers });
  }
  let serializedBody: string;
  try {
    serializedBody = JSON.stringify(body);
  } catch (cause) {
    throw new A2AClientError("A2A HTTP+JSON request is not serializable", {
      code: "invalid-request",
      transport: "HTTP+JSON",
      cause,
    });
  }
  return new Request(url, { method, headers, body: serializedBody });
}

function validateResponse<T>(value: unknown, validator: Validator, responseName: string): T {
  if (!validator(value)) {
    throw new A2AClientError(`A2A HTTP+JSON ${responseName} failed schema validation`, {
      code: "invalid-response",
      transport: "HTTP+JSON",
    });
  }
  return value as T;
}

function parseHttpError(value: unknown, status: number): A2AClientError {
  const error = isRecord(value) && isRecord(value.error) ? value.error : undefined;
  if (typeof error?.code === "number") {
    return new A2AClientError("A2A endpoint returned a protocol error", {
      code: "protocol-error",
      retryable: isRetryableHttpStatus(status),
      status,
      protocolCode: error.code,
      transport: "HTTP+JSON",
    });
  }
  return new A2AClientError(`A2A endpoint returned HTTP ${status}`, {
    code: "http-error",
    retryable: isRetryableHttpStatus(status),
    status,
    transport: "HTTP+JSON",
  });
}

function tenantPath(tenant: string | undefined, path: string): string {
  return tenant === undefined || tenant === "" ? path : `/${encodeURIComponent(tenant)}${path}`;
}

function withTenant<T extends { readonly tenant?: string | undefined }>(
  request: T,
  tenant: string | undefined,
): T {
  if (request.tenant !== undefined || tenant === undefined) {
    return request;
  }
  return { ...request, tenant };
}

function aliasedHistoryLength(request: GetTaskRequest): number | string | undefined {
  if (
    request.historyLength !== undefined && request.history_length !== undefined &&
    request.historyLength !== request.history_length
  ) {
    throw new A2AClientError("GetTask request has conflicting history length aliases", {
      code: "invalid-request",
      transport: "HTTP+JSON",
    });
  }
  return request.historyLength ?? request.history_length;
}

function requireIdentifier(identifier: string | undefined, operation: string): string {
  if (identifier === undefined || identifier === "") {
    throw new A2AClientError(`${operation} requires a task identifier`, {
      code: "invalid-request",
      transport: "HTTP+JSON",
    });
  }
  return identifier;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
