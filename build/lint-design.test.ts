import { assertEquals, assertThrows } from "@std/assert";
import { collectDesignLiteralOffenders, sanitizeDesignLintConfig } from "./lint-design.ts";

Deno.test("sanitizeDesignLintConfig - removes upstream metadata and preserves lint rules", () => {
  assertEquals(
    sanitizeDesignLintConfig({
      plugins: ["react"],
      rules: {
        "no-restricted-imports": "warn",
        "no-restricted-syntax": "warn",
      },
      "x-omelette": { tokens: ["--accent"] },
    }),
    {
      plugins: ["react"],
      rules: { "no-restricted-imports": "warn" },
    },
  );
});

Deno.test("collectDesignLiteralOffenders - flags raw hex and px literals with source lines", () => {
  assertEquals(
    collectDesignLiteralOffenders(
      [
        'const color = "' + '#ff00aa";',
        'const padding = "' + '12px";',
        'const token = "var(--accent)";',
      ].join("\n"),
      "src/example.tsx",
    ),
    [
      "src/example.tsx:1: Raw hex color — use a design-system token via var().",
      "src/example.tsx:2: Raw px value — use a design-system token via var().",
    ],
  );
});

Deno.test("sanitizeDesignLintConfig - rejects a non-object root", () => {
  assertThrows(
    () => sanitizeDesignLintConfig([]),
    TypeError,
    "design lint config must be a JSON object",
  );
});
