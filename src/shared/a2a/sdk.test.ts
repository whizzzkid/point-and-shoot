import { assertEquals, assertRejects } from "@std/assert";
import {
  type AgentCard,
  canonicalizeAgentCard,
  generateAgentCardSignature,
  verifyAgentCardSignature,
} from "@a2a-js/sdk";
import { createAuthenticatingFetchWithRetry } from "@a2a-js/sdk/client";
import { createA2ASdkFactory } from "./sdk.ts";

const CARD_ORIGIN = "https://card.example/";
const CARD_URL = `${CARD_ORIGIN}.well-known/agent-card.json`;
const JSONRPC_URL = "https://jsonrpc.example/a2a";
const REST_URL = "https://rest.example/a2a";

interface AgentInterfaceFixture {
  readonly url: string;
  readonly protocolBinding: string;
  readonly protocolVersion: string;
  readonly tenant: string;
}

function agentCard(supportedInterfaces: AgentInterfaceFixture[]): AgentCard {
  return {
    name: "Fixture agent",
    description: "Exercises browser-safe A2A client behavior.",
    supportedInterfaces,
    provider: {
      organization: "Fixture provider",
      url: "https://provider.example/",
    },
    version: "1.0.0",
    capabilities: { streaming: true, extensions: [] },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [],
    signatures: [],
  };
}

function browserInterfaces(): AgentInterfaceFixture[] {
  return [
    {
      url: JSONRPC_URL,
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
      tenant: "",
    },
    {
      url: REST_URL,
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
      tenant: "",
    },
  ];
}

Deno.test("createA2ASdkFactory - injects fetch for discovery and the preferred browser transport", async () => {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    if (request.url === CARD_URL) {
      return Promise.resolve(Response.json(agentCard(browserInterfaces())));
    }
    if (request.url === `${REST_URL}/tasks/task-1?historyLength=0`) {
      return Promise.resolve(Response.json({
        id: "task-1",
        contextId: "context-1",
        status: {
          state: "TASK_STATE_WORKING",
          timestamp: "2026-08-04T12:00:00.000Z",
        },
        artifacts: [],
        history: [],
        metadata: {},
      }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  const factory = createA2ASdkFactory({
    fetch: fetchImpl,
    preferredTransports: ["HTTP+JSON", "JSONRPC"],
  });

  const client = await factory.createFromUrl(CARD_ORIGIN);
  const task = await client.getTask({ tenant: "", id: "task-1", historyLength: 0 });

  assertEquals(client.transport.protocolName, "HTTP+JSON");
  assertEquals(task.id, "task-1");
  assertEquals(requests.map((request) => request.url), [
    CARD_URL,
    `${REST_URL}/tasks/task-1?historyLength=0`,
  ]);
});

Deno.test("createA2ASdkFactory - injects fetch into the JSON-RPC transport", async () => {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const body: unknown = await request.clone().json();
    assertEquals(body, {
      jsonrpc: "2.0",
      method: "GetTask",
      params: { id: "task-jsonrpc", historyLength: 0 },
      id: 1,
    });
    return Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: {
        id: "task-jsonrpc",
        contextId: "context-jsonrpc",
        status: {
          state: "TASK_STATE_WORKING",
          timestamp: "2026-08-04T12:00:00.000Z",
        },
        artifacts: [],
        history: [],
        metadata: {},
      },
    });
  };
  const jsonRpcInterfaces = browserInterfaces().filter(({ protocolBinding }) =>
    protocolBinding === "JSONRPC"
  );
  const factory = createA2ASdkFactory({
    fetch: fetchImpl,
    preferredTransports: ["JSONRPC", "HTTP+JSON"],
  });

  const client = await factory.createFromAgentCard(agentCard(jsonRpcInterfaces));
  const task = await client.getTask({ tenant: "", id: "task-jsonrpc", historyLength: 0 });

  assertEquals(client.transport.protocolName, "JSONRPC");
  assertEquals(task.id, "task-jsonrpc");
  assertEquals(requests.map(({ url, method }) => ({ url, method })), [
    { url: JSONRPC_URL, method: "POST" },
  ]);
});

Deno.test("createA2ASdkFactory - exposes streaming, lookup, and recovery on the created client", async () => {
  const factory = createA2ASdkFactory({
    fetch,
    preferredTransports: ["JSONRPC", "HTTP+JSON"],
  });
  const client = await factory.createFromAgentCard(agentCard(browserInterfaces()));

  // Structural: P0.3 owns network semantics; this inventory locks the pinned SDK surface it needs.
  assertEquals(typeof client.sendMessageStream, "function");
  assertEquals(typeof client.getTask, "function");
  assertEquals(typeof client.resubscribeTask, "function");
});

Deno.test("createA2ASdkFactory - rejects an Agent Card that advertises only gRPC", async () => {
  const factory = createA2ASdkFactory({
    fetch,
    preferredTransports: ["JSONRPC", "HTTP+JSON"],
  });
  const grpcOnlyCard = agentCard([
    {
      url: "https://grpc.example/a2a",
      protocolBinding: "GRPC",
      protocolVersion: "1.0",
      tenant: "",
    },
  ]);

  await assertRejects(
    () => factory.createFromAgentCard(grpcOnlyCard),
    Error,
    "No compatible transport found",
  );
});

Deno.test("SDK authentication - preserves credentials and retries a 401 at most once", async () => {
  const authorizations: Array<string | null> = [];
  const credentials: Array<RequestCredentials | undefined> = [];
  const requestUrls: string[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    requestUrls.push(new Request(input).url);
    authorizations.push(new Headers(init?.headers).get("Authorization"));
    credentials.push(init?.credentials);
    return Promise.resolve(new Response(null, { status: 401 }));
  };
  const authenticatedFetch = createAuthenticatingFetchWithRetry(fetchImpl, {
    headers: () => Promise.resolve({ Authorization: "Bearer stale" }),
    shouldRetryWithHeaders: (_request, response) =>
      Promise.resolve(response.status === 401 ? { Authorization: "Bearer refreshed" } : undefined),
  });

  const response = await authenticatedFetch("https://agent.example/tasks?cursor=next", {
    credentials: "include",
  });

  assertEquals(response.status, 401);
  assertEquals(authorizations, ["Bearer stale", "Bearer refreshed"]);
  assertEquals(credentials, ["include", "include"]);
  assertEquals(requestUrls, [
    "https://agent.example/tasks?cursor=next",
    "https://agent.example/tasks?cursor=next",
  ]);
});

Deno.test("SDK authentication - does not retry a 403 when the handler declines", async () => {
  let requestCount = 0;
  const authenticatedFetch = createAuthenticatingFetchWithRetry(
    () => {
      requestCount += 1;
      return Promise.resolve(new Response(null, { status: 403 }));
    },
    {
      headers: () => Promise.resolve({ Authorization: "Bearer token" }),
      shouldRetryWithHeaders: () => Promise.resolve(undefined),
    },
  );

  const response = await authenticatedFetch("https://agent.example/tasks");

  assertEquals(response.status, 403);
  assertEquals(requestCount, 1);
});

Deno.test("SDK signatures - sign and verify an Agent Card with browser Web Crypto", async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const card = agentCard(browserInterfaces());
  const signer = generateAgentCardSignature(keyPair.privateKey, {
    alg: "ES256",
    kid: "fixture-key",
    typ: "JOSE",
  });
  const signedCard = await signer(card);
  const verifier = verifyAgentCardSignature((keyId) => {
    assertEquals(keyId, "fixture-key");
    return Promise.resolve(keyPair.publicKey);
  });

  await verifier(signedCard);

  assertEquals(signedCard.signatures.length, 1);
  assertEquals(canonicalizeAgentCard(signedCard), canonicalizeAgentCard(card));
});
