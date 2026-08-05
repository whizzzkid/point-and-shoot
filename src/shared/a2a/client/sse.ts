/// <reference lib="dom" />

import { A2AClientError } from "./errors.ts";
import { type BoundedResponseOptions, streamBoundedResponse } from "./response.ts";

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/**
 * Incrementally parses JSON-valued Server-Sent Events under a per-frame byte limit.
 *
 * @param fetchImpl - Injected Web Fetch implementation.
 * @param request - Fully constructed streaming request.
 * @param options - Cancellation, frame-byte, and timeout limits.
 * @returns Parsed JSON values, one per SSE frame containing data.
 */
export async function* parseSseJson(
  fetchImpl: typeof fetch,
  request: Request,
  options: BoundedResponseOptions,
): AsyncIterable<unknown> {
  let frameBytes = 0;
  let lineBytes: number[] = [];
  let dataLines: string[] = [];

  const dispatch = (): unknown | undefined => {
    if (dataLines.length === 0) {
      return undefined;
    }
    const data = dataLines.join("\n");
    dataLines = [];
    try {
      return JSON.parse(data);
    } catch (cause) {
      throw new A2AClientError("SSE frame does not contain valid JSON", {
        code: "invalid-response",
        transport: options.transport,
        cause,
      });
    }
  };

  const acceptSse = (response: Response): void => {
    const contentType = response.headers.get("Content-Type")?.toLowerCase();
    if (contentType?.startsWith("text/event-stream") !== true) {
      void response.body?.cancel();
      throw new A2AClientError("A2A stream did not return text/event-stream", {
        code: "invalid-response",
        transport: options.transport,
      });
    }
  };

  for await (const chunk of streamBoundedResponse(fetchImpl, request, options, acceptSse)) {
    for (const byte of chunk) {
      frameBytes += 1;
      if (frameBytes > options.maxBytes) {
        throw new A2AClientError("SSE frame exceeds the configured byte limit", {
          code: "response-too-large",
          transport: options.transport,
        });
      }
      if (byte !== LINE_FEED) {
        lineBytes.push(byte);
        continue;
      }

      const line = decodeLine(lineBytes);
      lineBytes = [];
      if (line === "") {
        const event = dispatch();
        frameBytes = 0;
        if (event !== undefined) {
          yield event;
        }
        continue;
      }
      if (line.startsWith(":")) {
        continue;
      }
      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      let value = separator === -1 ? "" : line.slice(separator + 1);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
      if (field === "data") {
        dataLines.push(value);
      }
    }
  }

  if (lineBytes.length > 0) {
    const line = decodeLine(lineBytes);
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  const finalEvent = dispatch();
  if (finalEvent !== undefined) {
    yield finalEvent;
  }
}

function decodeLine(bytes: readonly number[]): string {
  const end = bytes.at(-1) === CARRIAGE_RETURN ? -1 : undefined;
  return new TextDecoder().decode(new Uint8Array(end === undefined ? bytes : bytes.slice(0, end)));
}
