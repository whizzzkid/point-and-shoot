import type { A2ATransportBinding } from "./contracts.ts";

/** Stable failure categories returned by the portable A2A client boundary. */
export type A2AClientErrorCode =
  | "aborted"
  | "http-error"
  | "invalid-request"
  | "invalid-response"
  | "protocol-error"
  | "response-too-large"
  | "timeout"
  | "transport-error"
  | "unsupported";

/** Timeout stage that stopped an A2A request. */
export type A2ATimeoutStage = "request" | "first-byte" | "stream-idle";

/** Structured, credential-free metadata for an A2A client failure. */
export interface A2AClientErrorOptions {
  /** Stable failure category. */
  readonly code?: A2AClientErrorCode;
  /** Whether repeating the operation may succeed without changing the request. */
  readonly retryable?: boolean;
  /** Safe HTTP response status, when available. */
  readonly status?: number | undefined;
  /** A2A or JSON-RPC protocol error code, when available. */
  readonly protocolCode?: number | undefined;
  /** Selected A2A transport binding, when available. */
  readonly transport?: A2ATransportBinding | undefined;
  /** Timeout stage, for timeout failures. */
  readonly timeout?: A2ATimeoutStage | undefined;
  /** Local underlying error. Remote response bodies must not be supplied. */
  readonly cause?: unknown;
}

/** Typed failure returned by the portable A2A client boundary. */
export class A2AClientError extends Error {
  /** Stable failure category. */
  readonly code: A2AClientErrorCode;
  /** Whether repeating the operation may succeed without changing the request. */
  readonly retryable: boolean;
  /** Safe HTTP response status, when available. */
  readonly status: number | undefined;
  /** A2A or JSON-RPC protocol error code, when available. */
  readonly protocolCode: number | undefined;
  /** Selected A2A transport binding, when available. */
  readonly transport: A2ATransportBinding | undefined;
  /** Timeout stage, for timeout failures. */
  readonly timeout: A2ATimeoutStage | undefined;

  /**
   * Creates a portable client error.
   *
   * @param message - Safe diagnostic text that excludes remote response bodies and credentials.
   * @param options - Structured failure metadata.
   */
  constructor(message: string, options: A2AClientErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "A2AClientError";
    this.code = options.code ?? "invalid-response";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
    this.protocolCode = options.protocolCode;
    this.transport = options.transport;
    this.timeout = options.timeout;
  }
}
