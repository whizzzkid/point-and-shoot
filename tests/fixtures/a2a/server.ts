import type { A2AClientLimits, StreamResponse, Task } from "../../../src/shared/a2a/client/mod.ts";
import {
  AGENT_CARD_PATH,
  AGENT_CARD_VARIANTS,
  createFixtureAgentCard,
  createGrpcOnlyAgentCard,
} from "./cards.ts";

/** Bearer credential accepted by the isolated test agent. */
export const A2A_FIXTURE_TOKEN = "phase-0-browser-token";

/** Stable task identifier used across stream interruption and recovery. */
export const A2A_FIXTURE_TASK_ID = "phase-0-task";

/** Stable context identifier used by fixture events. */
export const A2A_FIXTURE_CONTEXT_ID = "phase-0-context";

/** Measured Phase 0 byte budgets enforced before parsing or whole-body buffering. */
export const A2A_REMOTE_INPUT_LIMITS = {
  cardBytes: 64 * 1024,
  metadataBytes: 64 * 1024,
  keySetBytes: 64 * 1024,
  jsonBytes: 2 * 1024 * 1024,
  sseFrameBytes: 256 * 1024,
} as const;

/** Measured Phase 0 remote-input and network budgets exercised by both browser lanes. */
export const A2A_PROOF_LIMITS: A2AClientLimits = {
  cardBytes: A2A_REMOTE_INPUT_LIMITS.cardBytes,
  jsonBytes: A2A_REMOTE_INPUT_LIMITS.jsonBytes,
  sseFrameBytes: A2A_REMOTE_INPUT_LIMITS.sseFrameBytes,
  requestMs: 10_000,
  firstByteMs: 5_000,
  streamIdleMs: 30_000,
};

const OVERSIZED_PAYLOAD_BYTES = 256 * 1024;
const OVERSIZED_JSON_PAYLOAD_BYTES = A2A_REMOTE_INPUT_LIMITS.jsonBytes + 1;
const DELAY_MILLISECONDS = 250;
const encoder = new TextEncoder();

/** URLs and lifecycle controls for the running two-origin A2A fixture. */
export interface A2AFixtureServer {
  /** Origin serving only public Agent Cards. */
  readonly cardOrigin: string;
  /** Canonical public Agent Card URL. */
  readonly cardUrl: string;
  /** Separately granted origin serving authenticated interfaces. */
  readonly interfaceOrigin: string;
  /** JSON-RPC endpoint. */
  readonly jsonRpcUrl: string;
  /** HTTP+JSON base endpoint. */
  readonly httpJsonUrl: string;
  /** Stops both listeners. */
  close(): Promise<void>;
}

/**
 * Starts public-card and protected-interface origins on OS-assigned ports.
 *
 * @returns A reusable A2A fixture and both distinct origins.
 */
export function startA2AFixtureServer(): A2AFixtureServer {
  let interfaceOrigin = "";
  const interfaceServer = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => handleInterfaceRequest(request),
  );
  interfaceOrigin = `http://127.0.0.1:${interfaceServer.addr.port}`;

  const cardServer = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => handleCardRequest(request, interfaceOrigin),
  );
  const cardOrigin = `http://127.0.0.1:${cardServer.addr.port}`;

  return {
    cardOrigin,
    cardUrl: `${cardOrigin}${AGENT_CARD_PATH}`,
    interfaceOrigin,
    jsonRpcUrl: `${interfaceOrigin}/rpc`,
    httpJsonUrl: `${interfaceOrigin}/http`,
    async close(): Promise<void> {
      await Promise.all([cardServer.shutdown(), interfaceServer.shutdown()]);
    },
  };
}

function handleCardRequest(request: Request, interfaceOrigin: string): Response {
  const { pathname } = new URL(request.url);
  const headers = corsHeaders(request, "application/json; charset=utf-8");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  switch (pathname) {
    case AGENT_CARD_PATH:
      return Response.json(createFixtureAgentCard(interfaceOrigin), { headers });
    case AGENT_CARD_VARIANTS.grpcOnly:
      return Response.json(createGrpcOnlyAgentCard(interfaceOrigin), { headers });
    case AGENT_CARD_VARIANTS.malformed:
      return new Response('{"name":42}', { headers });
    case AGENT_CARD_VARIANTS.oversized:
      return Response.json({
        ...createFixtureAgentCard(interfaceOrigin),
        description: "x".repeat(OVERSIZED_PAYLOAD_BYTES),
      }, { headers });
    default:
      return new Response("Not found\n", { status: 404, headers });
  }
}

async function handleInterfaceRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = corsHeaders(request, "application/json; charset=utf-8");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.headers.get("Authorization") !== `Bearer ${A2A_FIXTURE_TOKEN}`) {
    headers.set("WWW-Authenticate", 'Bearer realm="phase-0-a2a"');
    return Response.json({ error: { code: 401, message: "Bearer token required" } }, {
      status: 401,
      headers,
    });
  }

  if (url.pathname === "/limits/declared-json") {
    const body = JSON.stringify({ payload: "x".repeat(OVERSIZED_JSON_PAYLOAD_BYTES) });
    headers.set("Content-Length", String(encoder.encode(body).byteLength));
    return new Response(body, { headers });
  }
  if (url.pathname === "/limits/chunked-json") {
    return chunkedResponse("x".repeat(OVERSIZED_JSON_PAYLOAD_BYTES), headers);
  }
  if (url.pathname === "/limits/metadata" || url.pathname === "/limits/jwk-set") {
    const body = JSON.stringify({ payload: "x".repeat(OVERSIZED_PAYLOAD_BYTES) });
    headers.set("Content-Length", String(encoder.encode(body).byteLength));
    return new Response(body, { headers });
  }
  if (url.pathname === "/limits/delayed-headers") {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MILLISECONDS));
    return Response.json({ task: workingTask() }, { headers });
  }
  if (url.pathname === "/limits/delayed-first-byte") {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    return delayedResponse(sseFrame({ task: workingTask() }), headers);
  }
  if (url.pathname === "/limits/oversized-sse") {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    return new Response(sseFrame({ metadata: { padding: "x".repeat(OVERSIZED_PAYLOAD_BYTES) } }), {
      headers,
    });
  }
  if (url.pathname === "/limits/idle-sse") {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    return idleResponse(sseFrame({ task: workingTask() }), headers);
  }

  if (url.pathname === "/rpc") return await handleJsonRpc(request, headers);
  if (url.pathname.startsWith("/http")) return handleHttpJson(request, url, headers);
  return new Response("Not found\n", { status: 404, headers });
}

async function handleJsonRpc(request: Request, headers: Headers): Promise<Response> {
  const envelope = await readJsonObject(request);
  const id = envelope.id;
  const method = envelope.method;
  if (typeof id !== "number" || typeof method !== "string") {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600 } }, { headers });
  }
  if (method === "SendStreamingMessage" || method === "SubscribeToTask") {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    const events = method === "SubscribeToTask"
      ? streamEvents().slice(2)
      : request.headers.get("X-Fixture-Disconnect") === "after-status"
      ? streamEvents().slice(0, 2)
      : streamEvents();
    return new Response(
      events.map((event) => sseFrame({ jsonrpc: "2.0", id, result: event })).join(""),
      {
        headers,
      },
    );
  }
  const result = method === "GetTask" ? completedTask() : { task: workingTask() };
  return Response.json({ jsonrpc: "2.0", id, result }, { headers });
}

function handleHttpJson(request: Request, url: URL, headers: Headers): Response {
  if (url.pathname.endsWith("/message:stream")) {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    const events = request.headers.get("X-Fixture-Disconnect") === "after-status"
      ? streamEvents().slice(0, 2)
      : streamEvents();
    return new Response(events.map(sseFrame).join(""), { headers });
  }
  if (url.pathname.endsWith(`/${A2A_FIXTURE_TASK_ID}:subscribe`)) {
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    return new Response(streamEvents().slice(2).map(sseFrame).join(""), { headers });
  }
  if (request.method === "GET" && url.pathname.endsWith(`/tasks/${A2A_FIXTURE_TASK_ID}`)) {
    return Response.json(completedTask(), { headers });
  }
  if (url.pathname.endsWith("/message:send")) {
    return Response.json({ task: workingTask() }, { headers });
  }
  return new Response("Not found\n", { status: 404, headers });
}

function streamEvents(): StreamResponse[] {
  return [
    { task: submittedTask() },
    {
      statusUpdate: {
        taskId: A2A_FIXTURE_TASK_ID,
        contextId: A2A_FIXTURE_CONTEXT_ID,
        status: { state: "TASK_STATE_WORKING", timestamp: "2026-08-05T00:00:01Z" },
      },
    },
    {
      artifactUpdate: {
        taskId: A2A_FIXTURE_TASK_ID,
        contextId: A2A_FIXTURE_CONTEXT_ID,
        artifact: {
          artifactId: "artifact-1",
          name: "proof.txt",
          parts: [{ text: "browser stream delivered" }],
        },
        lastChunk: true,
      },
    },
    {
      statusUpdate: {
        taskId: A2A_FIXTURE_TASK_ID,
        contextId: A2A_FIXTURE_CONTEXT_ID,
        status: { state: "TASK_STATE_COMPLETED", timestamp: "2026-08-05T00:00:02Z" },
      },
    },
  ];
}

function submittedTask(): Task {
  return {
    id: A2A_FIXTURE_TASK_ID,
    contextId: A2A_FIXTURE_CONTEXT_ID,
    status: { state: "TASK_STATE_SUBMITTED", timestamp: "2026-08-05T00:00:00Z" },
  };
}

function workingTask(): Task {
  return {
    ...submittedTask(),
    status: { state: "TASK_STATE_WORKING", timestamp: "2026-08-05T00:00:01Z" },
  };
}

function completedTask(): Task {
  return {
    ...submittedTask(),
    status: { state: "TASK_STATE_COMPLETED", timestamp: "2026-08-05T00:00:02Z" },
    artifacts: [{ artifactId: "artifact-1", parts: [{ text: "browser stream delivered" }] }],
  };
}

function corsHeaders(request: Request, contentType: string): Headers {
  return new Headers({
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ??
      "Authorization, A2A-Version, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sseFrame(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function chunkedResponse(payload: string, headers: Headers): Response {
  const bytes = encoder.encode(JSON.stringify({ payload }));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 1024) {
          controller.enqueue(bytes.slice(offset, offset + 1024));
        }
        controller.close();
      },
    }),
    { headers },
  );
}

function delayedResponse(payload: string, headers: Headers): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MILLISECONDS));
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    }),
    { headers },
  );
}

function idleResponse(payload: string, headers: Headers): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(payload));
        await new Promise((resolve) => setTimeout(resolve, DELAY_MILLISECONDS));
        controller.enqueue(encoder.encode(sseFrame({ task: completedTask() })));
        controller.close();
      },
    }),
    { headers },
  );
}

if (import.meta.main) {
  const fixture = startA2AFixtureServer();
  console.log(`A2A card:      ${fixture.cardUrl}`);
  console.log(`A2A JSON-RPC:  ${fixture.jsonRpcUrl}`);
  console.log(`A2A HTTP+JSON: ${fixture.httpJsonUrl}`);
}
