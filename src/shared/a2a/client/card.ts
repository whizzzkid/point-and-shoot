/// <reference lib="dom" />

import type { AgentCard } from "./protocol.generated.ts";
import type { A2AClientTarget, A2ATransportBinding } from "./contracts.ts";
import { A2AClientError } from "./errors.ts";
import { validateAgentCard } from "./validation.generated.ts";

/**
 * Selects a supported A2A v1 interface from an Agent Card.
 *
 * @param card - Agent Card to validate and inspect.
 * @param preferredTransports - Ordered browser transport preference.
 * @returns The selected interface target.
 * @throws {A2AClientError} When the card is malformed or has no supported v1 interface.
 */
export function selectAgentInterface(
  card: AgentCard,
  preferredTransports: readonly A2ATransportBinding[],
): A2AClientTarget {
  if (!validateAgentCard(card)) {
    throw new A2AClientError("Agent Card does not match the A2A v1 schema");
  }
  const interfaces = aliasedValue(
    card.supportedInterfaces,
    card.supported_interfaces,
    "supported interfaces",
  );
  if (interfaces === undefined || interfaces.length === 0) {
    throw new A2AClientError("Agent Card does not advertise a supported v1 browser interface");
  }

  for (const preferredTransport of preferredTransports) {
    const target = selectPreferredInterface(interfaces, preferredTransport);
    if (target !== undefined) {
      return target;
    }
  }

  throw new A2AClientError("Agent Card does not advertise a supported v1 browser interface");
}

function selectPreferredInterface(
  interfaces: NonNullable<AgentCard["supportedInterfaces"]>,
  preferredTransport: A2ATransportBinding,
): A2AClientTarget | undefined {
  for (const advertisedInterface of interfaces) {
    const binding = aliasedValue(
      advertisedInterface.protocolBinding,
      advertisedInterface.protocol_binding,
      "protocol binding",
    );
    const version = aliasedValue(
      advertisedInterface.protocolVersion,
      advertisedInterface.protocol_version,
      "protocol version",
    );
    if (binding !== preferredTransport || version !== "1.0") {
      continue;
    }
    if (advertisedInterface.url === undefined) {
      throw new A2AClientError("A supported Agent Card interface must include a URL");
    }
    const url = parseInterfaceUrl(advertisedInterface.url);
    const tenant = advertisedInterface.tenant?.trim();
    return tenant === undefined || tenant === ""
      ? { url, transport: preferredTransport, protocolVersion: "1.0" }
      : { url, transport: preferredTransport, protocolVersion: "1.0", tenant };
  }
  return undefined;
}

function aliasedValue<T>(
  canonicalValue: T | undefined,
  aliasValue: T | undefined,
  fieldName: string,
): T | undefined {
  if (
    canonicalValue !== undefined && aliasValue !== undefined &&
    JSON.stringify(canonicalValue) !== JSON.stringify(aliasValue)
  ) {
    throw new A2AClientError(`Agent Card has conflicting ${fieldName} aliases`);
  }
  return canonicalValue ?? aliasValue;
}

function parseInterfaceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new A2AClientError("A supported Agent Card interface must use an absolute HTTP(S) URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new A2AClientError("A supported Agent Card interface must use an absolute HTTP(S) URL");
  }
  return url;
}
