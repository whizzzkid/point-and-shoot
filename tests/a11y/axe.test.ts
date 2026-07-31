import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  blockingAxeViolations,
  formatAxeViolations,
  type SerializableAxeViolation,
} from "./axe.ts";

function violation(
  id: string,
  impact: SerializableAxeViolation["impact"],
): SerializableAxeViolation {
  return {
    help: `${id} help`,
    helpUrl: `https://example.test/${id}`,
    id,
    impact,
    nodes: [{
      failureSummary: `${id} failed`,
      target: [`#${id}`],
    }],
  };
}

Deno.test("axe filtering blocks only serious and critical findings", () => {
  const violations = [
    violation("minor-rule", "minor"),
    violation("moderate-rule", "moderate"),
    violation("serious-rule", "serious"),
    violation("critical-rule", "critical"),
    violation("unknown-rule", null),
  ];

  assertEquals(
    blockingAxeViolations(violations).map(({ id }) => id),
    ["serious-rule", "critical-rule"],
  );
});

Deno.test("axe formatter includes the surface, rule, target, and remediation", () => {
  const message = formatAxeViolations("options", [violation("button-name", "critical")]);

  assertStringIncludes(message, "options");
  assertStringIncludes(message, "button-name");
  assertStringIncludes(message, "#button-name");
  assertStringIncludes(message, "button-name failed");
});
