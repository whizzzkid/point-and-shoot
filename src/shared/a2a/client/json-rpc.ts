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
  SendMessageRequest,
  SendMessageResponse,
  StreamResponse,
  SubscribeToTaskRequest,
  Task,
} from "./protocol.generated.ts";
import { readBoundedJson } from "./response.ts";
import { parseSseJson } from "./sse.ts";
import {
  validateSendMessageResponse,
  validateStreamResponse,
  validateTask,
} from "./validation.generated.ts";

type Validator = (value: unknown) => boolean;

/**
 * Creates a portable client bound to one validated JSON-RPC interface.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param target - Selected JSON-RPC v1 interface.
 * @param limits - Explicit remote-input and timeout limits.
 * @returns A portable A2A client.
 */
export function createJsonRpcClient(
  fetchImpl: typeof fetch,
  target: A2AClientTarget,
  limits: A2AClientLimits,
): A2AClient {
  if (target.transport !== "JSONRPC") {
    throw new A2AClientError("JSON-RPC client requires a JSONRPC target", {
      code: "unsupported",
      transport: target.transport,
    });
  }

  let requestIdentifier = 0;

  const unary = async <T>(
    method: string,
    params: object,
    requestOptions: A2ARequestOptions,
    validator: Validator,
    responseName: string,
  ): Promise<T> => {
    const id = ++requestIdentifier;
    const request = createRequest(target.url, method, id, params, requestOptions, false);
    const value = await readBoundedJson(fetchImpl, request, {
      signal: requestOptions.signal,
      maxBytes: limits.jsonBytes,
      requestMs: limits.requestMs,
      firstByteMs: limits.firstByteMs,
      streamIdleMs: limits.streamIdleMs,
      transport: "JSONRPC",
    });
    return parseEnvelope<T>(value, id, validator, responseName);
  };

  const streaming = async function* <T>(
    method: string,
    params: object,
    requestOptions: A2ARequestOptions,
    validator: Validator,
    responseName: string,
  ): AsyncIterable<T> {
    const id = ++requestIdentifier;
    const request = createRequest(target.url, method, id, params, requestOptions, true);
    for await (
      const value of parseSseJson(fetchImpl, request, {
        signal: requestOptions.signal,
        maxBytes: limits.sseFrameBytes,
        requestMs: limits.requestMs,
        firstByteMs: limits.firstByteMs,
        streamIdleMs: limits.streamIdleMs,
        transport: "JSONRPC",
      })
    ) {
      yield parseEnvelope<T>(value, id, validator, responseName);
    }
  };

  return {
    target,
    sendMessage(request, requestOptions) {
      return unary<SendMessageResponse>(
        "SendMessage",
        withTenant(request, target.tenant),
        requestOptions,
        validateSendMessageResponse,
        "SendMessageResponse",
      );
    },
    sendMessageStream(request, requestOptions) {
      return streaming<StreamResponse>(
        "SendStreamingMessage",
        withTenant(request, target.tenant),
        requestOptions,
        validateStreamResponse,
        "StreamResponse",
      );
    },
    getTask(request, requestOptions) {
      return unary<Task>(
        "GetTask",
        withTenant(request, target.tenant),
        requestOptions,
        validateTask,
        "Task",
      );
    },
    subscribeToTask(request, requestOptions) {
      return streaming<StreamResponse>(
        "SubscribeToTask",
        withTenant(request, target.tenant),
        requestOptions,
        validateStreamResponse,
        "StreamResponse",
      );
    },
  };
}

function createRequest(
  endpoint: URL,
  method: string,
  id: number,
  params: SendMessageRequest | GetTaskRequest | SubscribeToTaskRequest | object,
  options: A2ARequestOptions,
  streaming: boolean,
): Request {
  const headers = new Headers(options.serviceParameters);
  headers.set("A2A-Version", "1.0");
  headers.set("Accept", streaming ? "text/event-stream" : "application/json");
  headers.set("Content-Type", "application/json");
  let body: string;
  try {
    body = JSON.stringify({ jsonrpc: "2.0", method, params, id });
  } catch (cause) {
    throw new A2AClientError("A2A JSON-RPC request is not serializable", {
      code: "invalid-response",
      transport: "JSONRPC",
      cause,
    });
  }
  return new Request(endpoint, { method: "POST", headers, body });
}

function parseEnvelope<T>(
  value: unknown,
  expectedIdentifier: number,
  validator: Validator,
  responseName: string,
): T {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || value.id !== expectedIdentifier) {
    throw new A2AClientError("A2A JSON-RPC response envelope is malformed or mismatched", {
      code: "invalid-response",
      transport: "JSONRPC",
    });
  }
  if (isRecord(value.error)) {
    const protocolCode = value.error.code;
    if (typeof protocolCode !== "number") {
      throw new A2AClientError("A2A JSON-RPC error envelope is malformed", {
        code: "invalid-response",
        transport: "JSONRPC",
      });
    }
    throw new A2AClientError("A2A endpoint returned a protocol error", {
      code: "protocol-error",
      retryable: protocolCode === -32603,
      protocolCode,
      transport: "JSONRPC",
    });
  }
  if (!("result" in value) || !validator(value.result)) {
    throw new A2AClientError(`A2A JSON-RPC ${responseName} failed schema validation`, {
      code: "invalid-response",
      transport: "JSONRPC",
    });
  }
  return value.result as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
