/// <reference lib="dom" />

import { assertEquals } from "@std/assert";
import type {
  AgentCard as OfficialAgentCard,
  CancelTaskRequest as OfficialCancelTaskRequest,
  DeleteTaskPushNotificationConfigRequest as OfficialDeletePushRequest,
  GetExtendedAgentCardRequest as OfficialExtendedCardRequest,
  GetTaskPushNotificationConfigRequest as OfficialGetPushRequest,
  GetTaskRequest as OfficialGetTaskRequest,
  ListTaskPushNotificationConfigsRequest as OfficialListPushRequest,
  ListTaskPushNotificationConfigsResponse as OfficialListPushResponse,
  ListTasksRequest as OfficialListTasksRequest,
  ListTasksResponse as OfficialListTasksResponse,
  Message as OfficialMessage,
  SendMessageRequest as OfficialSendMessageRequest,
  StreamResponse as OfficialStreamResponse,
  SubscribeToTaskRequest as OfficialSubscribeRequest,
  Task as OfficialTask,
  TaskPushNotificationConfig as OfficialPushConfig,
} from "@a2a-js/sdk";
import type { A2ARequestHandler, ServerCallContext } from "@a2a-js/sdk/server";
import { jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
// @deno-types="@types/express"
import express from "express";
import type { A2AClient, A2AClientLimits, A2AClientTarget } from "./contracts.ts";
import { createHttpJsonClient } from "./http-json.ts";
import { createJsonRpcClient } from "./json-rpc.ts";
import type { SendMessageRequest } from "./protocol.generated.ts";

const LIMITS: A2AClientLimits = {
  cardBytes: 8_192,
  jsonBytes: 8_192,
  sseFrameBytes: 8_192,
  requestMs: 2_000,
  firstByteMs: 2_000,
  streamIdleMs: 2_000,
};

const REQUEST: SendMessageRequest = {
  message: {
    messageId: "message-1",
    role: "ROLE_USER",
    parts: [{ text: "hello" }, { raw: "AQID", mediaType: "application/octet-stream" }],
  },
};

const TASK: OfficialTask = {
  id: "task-1",
  contextId: "context-1",
  status: { state: 3, message: undefined, timestamp: undefined },
  artifacts: [],
  history: [],
  metadata: {},
};

Deno.test({
  name: "portable transports conform to the exact-pinned official v1 server",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const handler = new ConformanceHandler();
    const app = express();
    app.use(express.json());
    app.use(
      "/rpc",
      jsonRpcHandler({
        requestHandler: handler,
        userBuilder: UserBuilder.noAuthentication,
      }),
    );
    app.use(
      "/http",
      restHandler({
        requestHandler: handler,
        userBuilder: UserBuilder.noAuthentication,
      }),
    );
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
    });

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Official conformance server did not expose an assigned TCP port");
      }
      const origin = `http://127.0.0.1:${address.port}`;
      await exercise(createJsonRpcClient(fetch, target(`${origin}/rpc`, "JSONRPC"), LIMITS));
      await exercise(createHttpJsonClient(fetch, target(`${origin}/http`, "HTTP+JSON"), LIMITS));
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => error === undefined ? resolve() : reject(error));
      });
    }

    assertEquals(handler.operations, [
      "send:tenant-1",
      "stream:tenant-1",
      "get:tenant-1",
      "subscribe:tenant-1",
      "send:tenant-1",
      "stream:tenant-1",
      "get:tenant-1",
      "subscribe:tenant-1",
    ]);
  },
});

async function exercise(client: A2AClient): Promise<void> {
  const requestOptions = { signal: new AbortController().signal };
  assertEquals((await client.sendMessage(REQUEST, requestOptions)).task?.id, "task-1");
  assertEquals(
    (await collect(client.sendMessageStream(REQUEST, requestOptions))).map((event) =>
      event.task?.id
    ),
    ["task-1"],
  );
  assertEquals(
    (await client.getTask({ id: "task-1", historyLength: 0 }, requestOptions)).id,
    "task-1",
  );
  assertEquals(
    (await collect(client.subscribeToTask({ id: "task-1" }, requestOptions))).map((event) =>
      event.task?.id
    ),
    ["task-1"],
  );
}

function target(url: string, transport: A2AClientTarget["transport"]): A2AClientTarget {
  return { url: new URL(url), transport, protocolVersion: "1.0", tenant: "tenant-1" };
}

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const event of events) {
    values.push(event);
  }
  return values;
}

class ConformanceHandler implements A2ARequestHandler {
  readonly operations: string[] = [];

  getAgentCard(): Promise<OfficialAgentCard> {
    return Promise.resolve({
      name: "Conformance agent",
      description: "Official v1 transport conformance oracle.",
      supportedInterfaces: [
        {
          url: "https://unused.example/rpc",
          protocolBinding: "JSONRPC",
          protocolVersion: "1.0",
          tenant: "",
        },
        {
          url: "https://unused.example/http",
          protocolBinding: "HTTP+JSON",
          protocolVersion: "1.0",
          tenant: "",
        },
      ],
      provider: { organization: "Fixture provider", url: "https://provider.example" },
      version: "1.0.0",
      capabilities: { streaming: true, extensions: [] },
      securitySchemes: {},
      securityRequirements: [],
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [],
      signatures: [],
    });
  }

  getAuthenticatedExtendedAgentCard(
    _params: OfficialExtendedCardRequest,
    _context: ServerCallContext,
  ): Promise<OfficialAgentCard> {
    return this.getAgentCard();
  }

  sendMessage(
    _params: OfficialSendMessageRequest,
    context: ServerCallContext,
  ): Promise<OfficialMessage | OfficialTask> {
    this.operations.push(`send:${context.tenant}`);
    return Promise.resolve(TASK);
  }

  async *sendMessageStream(
    _params: OfficialSendMessageRequest,
    context: ServerCallContext,
  ): AsyncGenerator<OfficialStreamResponse, void, undefined> {
    this.operations.push(`stream:${context.tenant}`);
    yield { payload: { $case: "task", value: TASK } };
  }

  getTask(
    _params: OfficialGetTaskRequest,
    context: ServerCallContext,
  ): Promise<OfficialTask> {
    this.operations.push(`get:${context.tenant}`);
    return Promise.resolve(TASK);
  }

  async *resubscribe(
    _params: OfficialSubscribeRequest,
    context: ServerCallContext,
  ): AsyncGenerator<OfficialStreamResponse, void, undefined> {
    this.operations.push(`subscribe:${context.tenant}`);
    yield { payload: { $case: "task", value: TASK } };
  }

  cancelTask(
    _params: OfficialCancelTaskRequest,
    _context: ServerCallContext,
  ): Promise<OfficialTask> {
    return Promise.resolve(TASK);
  }

  createTaskPushNotificationConfig(
    params: OfficialPushConfig,
    _context: ServerCallContext,
  ): Promise<OfficialPushConfig> {
    return Promise.resolve(params);
  }

  getTaskPushNotificationConfig(
    _params: OfficialGetPushRequest,
    _context: ServerCallContext,
  ): Promise<OfficialPushConfig> {
    return Promise.reject(new Error("Unused conformance operation"));
  }

  listTaskPushNotificationConfigs(
    _params: OfficialListPushRequest,
    _context: ServerCallContext,
  ): Promise<OfficialListPushResponse> {
    return Promise.reject(new Error("Unused conformance operation"));
  }

  deleteTaskPushNotificationConfig(
    _params: OfficialDeletePushRequest,
    _context: ServerCallContext,
  ): Promise<void> {
    return Promise.resolve();
  }

  listTasks(
    _params: OfficialListTasksRequest,
    _context: ServerCallContext,
  ): Promise<OfficialListTasksResponse> {
    return Promise.reject(new Error("Unused conformance operation"));
  }
}
