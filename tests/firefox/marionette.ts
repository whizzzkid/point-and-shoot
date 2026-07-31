/**
 * Minimal Marionette protocol client for the Firefox smoke tier.
 *
 * Firefox exposes the WebDriver command set as length-prefixed JSON over a local TCP connection.
 * Keeping this client local avoids adding a second browser-test framework solely for one smoke
 * flow.
 *
 * @module
 */

const RETRY_INTERVAL_MILLISECONDS = 50;
const MAX_FRAME_LENGTH_BYTES = 16 * 1024 * 1024;

interface FrameReader {
  read(buffer: Uint8Array): Promise<number | null>;
}

interface FrameWriter {
  write(buffer: Uint8Array): Promise<number>;
}

/**
 * Encodes one value using Marionette's byte-length-prefixed JSON framing.
 *
 * @param value JSON-serializable command or response value.
 * @returns The complete framed payload.
 */
export function encodeMarionetteFrame(value: unknown): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(JSON.stringify(value));
  const prefix = encoder.encode(`${payload.length}:`);
  const framed = new Uint8Array(prefix.length + payload.length);
  framed.set(prefix);
  framed.set(payload, prefix.length);
  return framed;
}

async function readExactly(reader: FrameReader, buffer: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) {
    const count = await reader.read(buffer.subarray(offset));
    if (count === null) throw new Error("Marionette connection closed inside a frame");
    if (count === 0) continue;
    offset += count;
  }
}

/**
 * Reads and decodes one Marionette frame.
 *
 * @param reader TCP-like byte reader.
 * @returns The decoded JSON value.
 */
export async function readMarionetteFrame(reader: FrameReader): Promise<unknown> {
  const decoder = new TextDecoder();
  const byte = new Uint8Array(1);
  let lengthText = "";

  while (true) {
    const count = await reader.read(byte);
    if (count === null) throw new Error("Marionette connection closed before a frame");
    if (count === 0) continue;
    const character = String.fromCharCode(byte[0] ?? 0);
    if (character === ":") break;
    if (!/^\d$/.test(character) || lengthText.length >= 10) {
      throw new Error(`Invalid Marionette frame length prefix: ${lengthText}${character}`);
    }
    lengthText += character;
  }

  const length = Number.parseInt(lengthText, 10);
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_FRAME_LENGTH_BYTES) {
    throw new Error(`Invalid Marionette frame length: ${lengthText}`);
  }
  const payload = new Uint8Array(length);
  await readExactly(reader, payload);
  return JSON.parse(decoder.decode(payload));
}

async function writeAll(writer: FrameWriter, buffer: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) {
    const count = await writer.write(buffer.subarray(offset));
    if (count === 0) throw new Error("Marionette connection accepted no command bytes");
    offset += count;
  }
}

/**
 * Validates one Marionette response and extracts its result.
 *
 * @param response Decoded response frame.
 * @param expectedId Command id the response must match.
 * @returns The command result.
 */
export function unwrapMarionetteResponse(response: unknown, expectedId: number): unknown {
  if (
    !Array.isArray(response) ||
    response.length < 4 ||
    response[0] !== 1 ||
    response[1] !== expectedId
  ) {
    throw new Error(`Unexpected Marionette response: ${JSON.stringify(response)}`);
  }
  const remoteError = response[2];
  if (remoteError !== null) {
    if (typeof remoteError === "object" && remoteError !== null) {
      const record = remoteError as Record<string, unknown>;
      const name = typeof record.error === "string" ? record.error : "remote error";
      const message = typeof record.message === "string" ? record.message : JSON.stringify(record);
      throw new Error(`${name}: ${message}`);
    }
    throw new Error(`Marionette remote error: ${JSON.stringify(remoteError)}`);
  }
  return response[3];
}

/**
 * One connected Marionette WebDriver session.
 */
export class MarionetteClient {
  readonly #connection: Deno.TcpConn;
  #nextId = 1;
  #sessionStarted = false;

  private constructor(connection: Deno.TcpConn) {
    this.#connection = connection;
  }

  /**
   * Connects to a listening Firefox Marionette server and validates its greeting.
   *
   * @param port Local Marionette TCP port.
   * @param timeoutMilliseconds Maximum time to retry while Firefox starts.
   * @returns A connected client before a WebDriver session has started.
   */
  static async connect(
    port: number,
    timeoutMilliseconds: number,
  ): Promise<MarionetteClient> {
    const deadline = Date.now() + timeoutMilliseconds;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const connection = await Deno.connect({ hostname: "127.0.0.1", port });
        const greeting = await readMarionetteFrame(connection);
        if (
          typeof greeting !== "object" ||
          greeting === null ||
          (greeting as Record<string, unknown>).applicationType !== "gecko" ||
          (greeting as Record<string, unknown>).marionetteProtocol !== 3
        ) {
          connection.close();
          throw new Error(`Unexpected Marionette greeting: ${JSON.stringify(greeting)}`);
        }
        return new MarionetteClient(connection);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MILLISECONDS));
      }
    }

    throw new Error(
      `Firefox Marionette did not listen on port ${port} within ${timeoutMilliseconds}ms`,
      { cause: lastError },
    );
  }

  /**
   * Starts the WebDriver session.
   *
   * @returns Firefox's negotiated session and capabilities.
   */
  async startSession(): Promise<unknown> {
    const result = await this.command("WebDriver:NewSession", {
      capabilities: {
        alwaysMatch: { acceptInsecureCerts: true },
        firstMatch: [{}],
      },
    });
    this.#sessionStarted = true;
    return result;
  }

  /**
   * Sends one Marionette/WebDriver command.
   *
   * @param name Marionette command name.
   * @param parameters Command parameters.
   * @returns The decoded command result.
   */
  async command(name: string, parameters: Record<string, unknown>): Promise<unknown> {
    const id = this.#nextId++;
    await writeAll(this.#connection, encodeMarionetteFrame([0, id, name, parameters]));
    return unwrapMarionetteResponse(await readMarionetteFrame(this.#connection), id);
  }

  /**
   * Ends the WebDriver session and closes its TCP connection.
   *
   * @returns Nothing after local cleanup.
   */
  async close(): Promise<void> {
    try {
      if (this.#sessionStarted) await this.command("WebDriver:DeleteSession", {});
    } finally {
      this.#connection.close();
    }
  }
}
