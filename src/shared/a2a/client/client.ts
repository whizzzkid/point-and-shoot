/// <reference lib="dom" />

import { selectAgentInterface } from "./card.ts";
import type {
  A2AClient,
  A2AClientFactory,
  A2AClientFactoryOptions,
  A2AClientLimits,
  A2AClientTarget,
} from "./contracts.ts";
import { A2AClientError } from "./errors.ts";
import { createHttpJsonClient } from "./http-json.ts";
import { createJsonRpcClient } from "./json-rpc.ts";
import type { AgentCard } from "./protocol.generated.ts";
import { readBoundedJson } from "./response.ts";
import { validateAgentCard } from "./validation.generated.ts";

/**
 * Creates the portable A2A discovery and transport factory.
 *
 * @param options - Injected fetch, ordered transport preference, and explicit limits.
 * @returns A policy-free A2A client factory.
 */
export function createA2AClientFactory(options: A2AClientFactoryOptions): A2AClientFactory {
  validateFactoryOptions(options);

  return {
    async resolve(cardUrl, signal) {
      const headers = new Headers({
        Accept: "application/json",
        "A2A-Version": "1.0",
      });
      const value = await readBoundedJson(
        options.fetch,
        new Request(cardUrl, { method: "GET", headers }),
        {
          signal,
          maxBytes: options.limits.cardBytes,
          requestMs: options.limits.requestMs,
          firstByteMs: options.limits.firstByteMs,
          streamIdleMs: options.limits.streamIdleMs,
        },
      );
      if (!validateAgentCard(value)) {
        throw new A2AClientError("Agent Card does not match the A2A v1 schema", {
          code: "invalid-response",
        });
      }
      return value as AgentCard;
    },
    select(agentCard) {
      return selectAgentInterface(agentCard, options.preferredTransports);
    },
    create(target) {
      validateTarget(target);
      return createTransportClient(options.fetch, target, options.limits);
    },
  };
}

function validateFactoryOptions(options: A2AClientFactoryOptions): void {
  if (options.preferredTransports.length === 0) {
    throw new A2AClientError("A2A client requires at least one preferred transport", {
      code: "invalid-request",
    });
  }
  const uniqueTransports = new Set(options.preferredTransports);
  if (uniqueTransports.size !== options.preferredTransports.length) {
    throw new A2AClientError("A2A preferred transports must not contain duplicates", {
      code: "invalid-request",
    });
  }
  for (const [name, value] of Object.entries(options.limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new A2AClientError(`A2A client limit ${name} must be a positive safe integer`, {
        code: "invalid-request",
      });
    }
  }
}

function validateTarget(target: A2AClientTarget): void {
  if (target.protocolVersion !== "1.0") {
    throw new A2AClientError("A2A client target must use protocol v1", {
      code: "unsupported",
      transport: target.transport,
    });
  }
  if (target.url.protocol !== "https:" && target.url.protocol !== "http:") {
    throw new A2AClientError("A2A client target must use an HTTP(S) URL", {
      code: "invalid-request",
      transport: target.transport,
    });
  }
}

function createTransportClient(
  fetchImpl: typeof fetch,
  target: A2AClientTarget,
  limits: A2AClientLimits,
): A2AClient {
  switch (target.transport) {
    case "JSONRPC":
      return createJsonRpcClient(fetchImpl, target, limits);
    case "HTTP+JSON":
      return createHttpJsonClient(fetchImpl, target, limits);
  }
}
