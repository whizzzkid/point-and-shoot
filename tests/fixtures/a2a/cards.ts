import type { AgentCard } from "../../../src/shared/a2a/client/mod.ts";

/** Public card route exposed by the A2A network fixture. */
export const AGENT_CARD_PATH = "/.well-known/agent-card.json";

/** Alternate cards used to prove failure handling. */
export const AGENT_CARD_VARIANTS = {
  grpcOnly: "/cards/grpc-only.json",
  malformed: "/cards/malformed.json",
  oversized: "/cards/oversized.json",
} as const;

/**
 * Creates the valid multi-transport Agent Card served by the fixture.
 *
 * @param interfaceOrigin - Separately granted A2A interface origin.
 * @returns A browser-compatible A2A v1 card.
 */
export function createFixtureAgentCard(interfaceOrigin: string): AgentCard {
  return {
    name: "Phase 0 fixture agent",
    description: "Deterministic browser network proof",
    version: "1.0.0",
    capabilities: { streaming: true },
    supportedInterfaces: [
      {
        url: `${interfaceOrigin}/rpc`,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
      {
        url: `${interfaceOrigin}/http`,
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0",
      },
    ],
    securitySchemes: {
      bearer: { httpAuthSecurityScheme: { scheme: "bearer", bearerFormat: "opaque" } },
    },
    securityRequirements: [{ schemes: { bearer: { list: [] } } }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [],
  };
}

/**
 * Creates an otherwise valid card advertising no browser transport.
 *
 * @param interfaceOrigin - Fixture interface origin.
 * @returns A gRPC-only A2A v1 card.
 */
export function createGrpcOnlyAgentCard(interfaceOrigin: string): AgentCard {
  return {
    ...createFixtureAgentCard(interfaceOrigin),
    supportedInterfaces: [{
      url: `${interfaceOrigin}/grpc`,
      protocolBinding: "GRPC",
      protocolVersion: "1.0",
    }],
  };
}
