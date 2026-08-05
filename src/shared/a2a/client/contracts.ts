/// <reference lib="dom" />

/** Browser transports implemented by the portable A2A client. */
export type A2ATransportBinding = "JSONRPC" | "HTTP+JSON";

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
