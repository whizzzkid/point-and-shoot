/// <reference lib="dom" />

import type {
  AgentCard,
  GetTaskRequest,
  SendMessageRequest,
  SendMessageResponse,
  StreamResponse,
  SubscribeToTaskRequest,
  Task,
} from "./protocol.generated.ts";

/** Browser transports implemented by the portable A2A client. */
export type A2ATransportBinding = "JSONRPC" | "HTTP+JSON";

/** Explicit remote-input and timeout limits supplied by the embedding application. */
export interface A2AClientLimits {
  /** Maximum bytes accepted for a public Agent Card. */
  readonly cardBytes: number;
  /** Maximum bytes accepted for one JSON response. */
  readonly jsonBytes: number;
  /** Maximum raw bytes accepted for one SSE frame. */
  readonly sseFrameBytes: number;
  /** Maximum milliseconds to receive response headers. */
  readonly requestMs: number;
  /** Maximum milliseconds from response headers to first body bytes. */
  readonly firstByteMs: number;
  /** Maximum milliseconds between later streaming body chunks. */
  readonly streamIdleMs: number;
}

/** Dependencies and policy-free limits used to construct a portable A2A client factory. */
export interface A2AClientFactoryOptions {
  /** Injected Web Fetch implementation, composed by the embedding application. */
  readonly fetch: typeof fetch;
  /** Ordered browser transport preference. */
  readonly preferredTransports: readonly A2ATransportBinding[];
  /** Explicit remote-input and timeout limits. */
  readonly limits: A2AClientLimits;
}

/** Per-operation headers and caller-owned cancellation. */
export interface A2ARequestOptions {
  /** Caller-owned signal required for every operation. */
  readonly signal: AbortSignal;
  /** Headers contributed by the embedding application, such as authentication. */
  readonly serviceParameters?: Readonly<Record<string, string>>;
}

/** A validated A2A v1 interface selected from an Agent Card. */
export interface A2AClientTarget {
  /** Absolute interface URL. */
  readonly url: URL;
  /** Protocol binding used at the interface URL. */
  readonly transport: A2ATransportBinding;
  /** A2A protocol version supported by this client. */
  readonly protocolVersion: "1.0";
  /** Optional tenant identifier contributed by the Agent Card. */
  readonly tenant?: string;
}

/** Portable operations shared by the JSON-RPC and HTTP+JSON bindings. */
export interface A2AClient {
  /** Validated interface selected from the Agent Card. */
  readonly target: A2AClientTarget;
  /**
   * Sends one non-streaming message request.
   *
   * @param request - A2A v1 send request.
   * @param options - Per-request headers and cancellation.
   * @returns The validated A2A send response.
   */
  sendMessage(
    request: SendMessageRequest,
    options: A2ARequestOptions,
  ): Promise<SendMessageResponse>;
  /**
   * Sends a message and consumes its streamed responses.
   *
   * @param request - A2A v1 send request.
   * @param options - Per-request headers and cancellation.
   * @returns Validated A2A stream events.
   */
  sendMessageStream(
    request: SendMessageRequest,
    options: A2ARequestOptions,
  ): AsyncIterable<StreamResponse>;
  /**
   * Retrieves one existing task.
   *
   * @param request - A2A v1 task lookup request.
   * @param options - Per-request headers and cancellation.
   * @returns The validated task.
   */
  getTask(request: GetTaskRequest, options: A2ARequestOptions): Promise<Task>;
  /**
   * Reconnects to an existing task's update stream.
   *
   * @param request - A2A v1 task subscription request.
   * @param options - Per-request headers and cancellation.
   * @returns Validated A2A stream events.
   */
  subscribeToTask(
    request: SubscribeToTaskRequest,
    options: A2ARequestOptions,
  ): AsyncIterable<StreamResponse>;
}

/** Discovery, interface selection, and client creation boundary. */
export interface A2AClientFactory {
  /**
   * Fetches and validates a public Agent Card from an already-approved URL.
   *
   * @param cardUrl - Exact public card URL.
   * @param signal - Caller-owned cancellation signal.
   * @returns The validated Agent Card.
   */
  resolve(cardUrl: URL, signal: AbortSignal): Promise<AgentCard>;
  /**
   * Selects a supported interface without performing I/O.
   *
   * @param agentCard - Validated or untrusted Agent Card value.
   * @returns The selected v1 browser interface.
   */
  select(agentCard: AgentCard): A2AClientTarget;
  /**
   * Creates a transport client without performing I/O.
   *
   * @param target - Previously selected v1 browser interface.
   * @returns A portable client bound to that target.
   */
  create(target: A2AClientTarget): A2AClient;
}
