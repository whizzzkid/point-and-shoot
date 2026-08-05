import {
  ClientFactory,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
  RestTransportFactory,
} from "@a2a-js/sdk/client";

/** Browser-safe inputs for constructing the official A2A client factory. */
export interface A2ASdkFactoryOptions {
  readonly fetch: typeof fetch;
  readonly preferredTransports: readonly ("JSONRPC" | "HTTP+JSON")[];
}

/**
 * Constructs an official A2A client factory without registering the Node-only gRPC transport.
 *
 * @param options Browser fetch implementation and ordered transport preference.
 * @returns A client factory restricted to JSON-RPC and HTTP+JSON.
 */
export function createA2ASdkFactory(options: A2ASdkFactoryOptions): ClientFactory {
  return new ClientFactory({
    transports: [
      new JsonRpcTransportFactory({ fetchImpl: options.fetch }),
      new RestTransportFactory({ fetchImpl: options.fetch }),
    ],
    preferredTransports: [...options.preferredTransports],
    cardResolver: new DefaultAgentCardResolver({ fetchImpl: options.fetch }),
  });
}
