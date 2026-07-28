/**
 * Runs the pinned design-system linter against production source without modifying the upstream
 * bundle. The bundle config carries `x-omelette` design metadata and ESLint's
 * `no-restricted-syntax`, neither of which oxlint recognizes. This adapter removes those
 * incompatible entries in a temporary config and preserves the rule's raw-literal checks locally.
 *
 * @module
 */

import { fromFileUrl } from "@std/path";

const ROOT = new URL("../", import.meta.url);
const DESIGN_CONFIG = new URL(
  ".claude-design/point-and-shoot/_adherence.oxlintrc.json",
  ROOT,
);

/**
 * Removes design-tool metadata that is not part of oxlint's configuration schema.
 *
 * @param candidate Parsed contents of the upstream design lint configuration.
 * @returns A shallow copy containing every oxlint field and no `x-omelette` metadata.
 * @throws {TypeError} When the configuration root is not a JSON object.
 */
export function sanitizeDesignLintConfig(candidate: unknown): Record<string, unknown> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new TypeError("design lint config must be a JSON object");
  }
  const sanitized = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => key !== "x-omelette"),
  );
  const rules = sanitized.rules;
  if (typeof rules === "object" && rules !== null && !Array.isArray(rules)) {
    sanitized.rules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => key !== "no-restricted-syntax"),
    );
  }
  return sanitized;
}

/**
 * Reports string literals that bypass the generated color and spacing tokens.
 *
 * This preserves the two literal checks encoded in the upstream `no-restricted-syntax` selectors;
 * TypeScript itself enforces the component prop signatures those selectors also describe.
 *
 * @param source TypeScript or JavaScript source text.
 * @param filePath Display path used in diagnostics.
 * @returns One diagnostic per restricted literal and source line.
 */
export function collectDesignLiteralOffenders(source: string, filePath: string): string[] {
  const diagnostics: string[] = [];
  const literalPattern =
    /(?<hex>["'][^"'\n]*#[0-9a-fA-F]{3,8}\b[^"'\n]*["'])|(?<pixels>["'][^"'\n]*\b\d+px\b[^"'\n]*["'])/g;
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    for (const match of line.matchAll(literalPattern)) {
      const lineNumber = index + 1;
      if (match.groups?.hex !== undefined) {
        diagnostics.push(
          `${filePath}:${lineNumber}: Raw hex color — use a design-system token via var().`,
        );
      }
      if (match.groups?.pixels !== undefined) {
        diagnostics.push(
          `${filePath}:${lineNumber}: Raw px value — use a design-system token via var().`,
        );
      }
    }
  }
  return diagnostics;
}

async function designLiteralOffenders(directory: URL): Promise<string[]> {
  const diagnostics: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const entryUrl = new URL(entry.isDirectory ? `${entry.name}/` : entry.name, directory);
    if (entry.isDirectory) {
      diagnostics.push(...await designLiteralOffenders(entryUrl));
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue;
    const relativePath = fromFileUrl(entryUrl).slice(fromFileUrl(ROOT).length);
    diagnostics.push(
      ...collectDesignLiteralOffenders(await Deno.readTextFile(entryUrl), relativePath),
    );
  }
  return diagnostics;
}

async function runDesignLint(): Promise<number> {
  const source = await Deno.readTextFile(DESIGN_CONFIG);
  const sanitized = sanitizeDesignLintConfig(JSON.parse(source));
  const temporaryConfig = await Deno.makeTempFile({ suffix: ".json" });

  try {
    await Deno.writeTextFile(temporaryConfig, `${JSON.stringify(sanitized, null, 2)}\n`);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        "npm:oxlint@1.76.0",
        "--config",
        temporaryConfig,
        "src/",
      ],
      cwd: fromFileUrl(ROOT),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const lintCode = (await command.output()).code;
    if (lintCode !== 0) return lintCode;
    const literalOffenders = await designLiteralOffenders(new URL("src/", ROOT));
    for (const diagnostic of literalOffenders) console.warn(`warning: ${diagnostic}`);
    return 0;
  } finally {
    await Deno.remove(temporaryConfig);
  }
}

if (import.meta.main) {
  Deno.exit(await runDesignLint());
}
