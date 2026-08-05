import { assert, assertFalse } from "@std/assert";
import { validateAgentCard, validatePart } from "./validation.generated.ts";

Deno.test("generated Agent Card validator accepts a browser transport card", () => {
  const card = {
    name: "Recipe Agent",
    version: "1.0.0",
    supportedInterfaces: [{
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
      url: "https://agent.example/a2a",
    }],
  };

  assert(validateAgentCard(card));
});

Deno.test("generated validators reject invalid field shapes and unknown properties", () => {
  assertFalse(validateAgentCard({ name: 42 }));
  assertFalse(validateAgentCard({ unrecognized: true }));
  assertFalse(validatePart({ raw: 42 }));
});

Deno.test("generated Part validator keeps binary content browser-native", () => {
  assert(validatePart({ mediaType: "image/png", raw: "iVBORw0KGgo=" }));
});
