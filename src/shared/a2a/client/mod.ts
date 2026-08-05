/// <reference lib="dom" />

export { createA2AClientFactory } from "./client.ts";
export type {
  A2AClient,
  A2AClientFactory,
  A2AClientFactoryOptions,
  A2AClientLimits,
  A2AClientTarget,
  A2ARequestOptions,
  A2ATransportBinding,
} from "./contracts.ts";
export {
  A2AClientError,
  type A2AClientErrorCode,
  type A2AClientErrorOptions,
  type A2ATimeoutStage,
} from "./errors.ts";
export type * from "./protocol.generated.ts";
