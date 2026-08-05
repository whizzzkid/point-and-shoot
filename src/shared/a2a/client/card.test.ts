import { assertEquals, assertThrows } from "@std/assert";
import type { AgentCard, AgentInterface } from "./protocol.generated.ts";
import { selectAgentInterface } from "./card.ts";
import { A2AClientError } from "./errors.ts";

function agentCard(supportedInterfaces: AgentInterface[]): AgentCard {
  return {
    name: "Fixture agent",
    description: "Exercises portable A2A interface selection.",
    supportedInterfaces,
    version: "1.0.0",
    capabilities: { streaming: true },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [],
  };
}

Deno.test("selectAgentInterface honors configured transport preference", () => {
  const card = agentCard([
    {
      url: "https://jsonrpc.example/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    },
    {
      url: "https://http-json.example/a2a",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
      tenant: "tenant-1",
    },
  ]);

  const target = selectAgentInterface(card, ["HTTP+JSON", "JSONRPC"]);

  assertEquals(target, {
    url: new URL("https://http-json.example/a2a"),
    transport: "HTTP+JSON",
    protocolVersion: "1.0",
    tenant: "tenant-1",
  });
});

Deno.test("selectAgentInterface accepts protobuf JSON aliases", () => {
  const card = agentCard([]);
  delete card.supportedInterfaces;
  card.supported_interfaces = [{
    url: "https://jsonrpc.example/a2a",
    protocol_binding: "JSONRPC",
    protocol_version: "1.0",
  }];

  assertEquals(selectAgentInterface(card, ["JSONRPC"]), {
    url: new URL("https://jsonrpc.example/a2a"),
    transport: "JSONRPC",
    protocolVersion: "1.0",
  });
});

Deno.test("selectAgentInterface skips unsupported versions and bindings", () => {
  const card = agentCard([
    {
      url: "https://legacy.example/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: "0.3",
    },
    {
      url: "https://grpc.example/a2a",
      protocolBinding: "GRPC",
      protocolVersion: "1.0",
    },
    {
      url: "https://jsonrpc.example/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    },
  ]);

  assertEquals(
    selectAgentInterface(card, ["JSONRPC", "HTTP+JSON"]).url.href,
    "https://jsonrpc.example/a2a",
  );
});

Deno.test("selectAgentInterface rejects a malformed card", () => {
  assertThrows(
    () => selectAgentInterface({ name: 42 } as unknown as AgentCard, ["JSONRPC"]),
    A2AClientError,
    "Agent Card",
  );
});

Deno.test("selectAgentInterface rejects a gRPC-only card", () => {
  assertThrows(
    () =>
      selectAgentInterface(
        agentCard([{
          url: "https://grpc.example/a2a",
          protocolBinding: "GRPC",
          protocolVersion: "1.0",
        }]),
        ["JSONRPC", "HTTP+JSON"],
      ),
    A2AClientError,
    "supported v1 browser interface",
  );
});

Deno.test("selectAgentInterface rejects conflicting field aliases", () => {
  assertThrows(
    () =>
      selectAgentInterface(
        agentCard([{
          url: "https://agent.example/a2a",
          protocolBinding: "JSONRPC",
          protocol_binding: "HTTP+JSON",
          protocolVersion: "1.0",
        }]),
        ["JSONRPC", "HTTP+JSON"],
      ),
    A2AClientError,
    "conflicting",
  );
});

Deno.test("selectAgentInterface rejects a non-HTTP interface URL", () => {
  assertThrows(
    () =>
      selectAgentInterface(
        agentCard([{
          url: "file:///tmp/agent",
          protocolBinding: "JSONRPC",
          protocolVersion: "1.0",
        }]),
        ["JSONRPC"],
      ),
    A2AClientError,
    "HTTP(S)",
  );
});
