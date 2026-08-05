import { Ajv2020 } from "ajv/2020";
import standaloneModule from "ajv/standalone";
import { join } from "@std/path";
import { compile } from "json-schema-to-typescript";

const CLIENT_DIRECTORY = new URL(".", import.meta.url).pathname;
const DENO_CONFIG_PATH = new URL("../../../../deno.json", import.meta.url).pathname;
const REFERENCE_SUFFIX = ".jsonschema.json";
const SCHEMA_IDENTIFIER = "https://point-and-shoot.invalid/schemas/a2a/v1";
const STANDALONE_CODE = standaloneModule.default;

const VALIDATORS = {
  validateAgentCard: "Agent Card",
  validateArtifact: "Artifact",
  validateMessage: "Message",
  validatePart: "Part",
  validateSendMessageResponse: "Send Message Response",
  validateStreamResponse: "Stream Response",
  validateTask: "Task",
  validateTaskArtifactUpdateEvent: "Task Artifact Update Event",
  validateTaskStatusUpdateEvent: "Task Status Update Event",
} as const;

/** Metadata that pins the generated protocol contract to its official A2A v1 sources. */
export const A2A_PROTOCOL_METADATA = {
  protocolVersion: "1.0",
  sourceTag: "v1.0.0",
  protoUrl: "https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto",
  schemaUrl: "https://a2a-protocol.org/v1.0.0/spec/a2a.json",
  schemaSha256: "6b6560c726289734799b7d5883be84e4cc0452600736db0f811341bac43b8d62",
  schemaGenerator: "github.com/bufbuild/protoschema-plugins@v0.6.0",
  typeGenerator: "json-schema-to-typescript@15.0.4",
  validatorGenerator: "ajv@8.20.0",
  upstreamLicense: "Apache-2.0",
} as const;

/** Options for deterministic generation of the portable client's protocol artifacts. */
export interface GenerateProtocolArtifactsOptions {
  /** Path to the byte-pinned official JSON Schema snapshot. */
  readonly schemaPath: string;
  /** Directory that receives the generated TypeScript files. */
  readonly outputDirectory: string;
}

/**
 * Generates TypeScript protocol types and standalone runtime validators.
 *
 * @param options - Source schema and destination directory.
 * @returns A promise that resolves after both formatted artifacts are written.
 */
export async function generateProtocolArtifacts(
  options: GenerateProtocolArtifactsOptions,
): Promise<void> {
  const schemaBytes = await Deno.readFile(options.schemaPath);
  const parsedSchema = parseSchema(schemaBytes);
  const normalizedSchema = normalizeSchemaReferences(parsedSchema);
  // Protobuf's snake_case aliases must stay valid on the wire but become conflicting TS indexes.
  const typeSchema = omitPatternProperties(normalizedSchema);
  await assertPinnedDigest(schemaBytes);
  await Deno.mkdir(options.outputDirectory, { recursive: true });

  const protocolPath = join(options.outputDirectory, "protocol.generated.ts");
  const validationPath = join(options.outputDirectory, "validation.generated.ts");
  const protocolTypes = await compile(typeSchema, "A2AProtocolSchemas", {
    bannerComment: generatedBanner("TypeScript protocol contracts"),
    style: {
      printWidth: 100,
      semi: true,
      singleQuote: false,
      tabWidth: 2,
    },
    unreachableDefinitions: true,
  });

  await Deno.writeTextFile(protocolPath, protocolTypes);
  await Deno.writeTextFile(validationPath, generateStandaloneValidators(normalizedSchema));
  await formatGeneratedFiles([protocolPath, validationPath]);
}

function omitPatternProperties(value: unknown): Record<string, unknown> {
  const visit = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(visit);
    }
    if (!isRecord(item)) {
      return item;
    }
    return Object.fromEntries(
      Object.entries(item)
        .filter(([key]) => key !== "patternProperties")
        .map(([key, nestedItem]) => [key, visit(nestedItem)]),
    );
  };

  const schema = visit(value);
  if (!isRecord(schema)) {
    throw new Error("The TypeScript protocol schema must remain an object");
  }
  return schema;
}

function parseSchema(schemaBytes: Uint8Array): Record<string, unknown> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(schemaBytes));
  if (!isRecord(parsed)) {
    throw new Error("The protocol schema root must be an object");
  }
  if (!isRecord(parsed.definitions) || Object.keys(parsed.definitions).length === 0) {
    throw new Error("The protocol schema must contain definitions");
  }
  return parsed;
}

async function assertPinnedDigest(schemaBytes: Uint8Array): Promise<void> {
  const digestInput = new Uint8Array(schemaBytes.byteLength);
  digestInput.set(schemaBytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  const actual = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== A2A_PROTOCOL_METADATA.schemaSha256) {
    throw new Error(
      `The protocol schema digest ${actual} does not match the pinned source ${A2A_PROTOCOL_METADATA.schemaSha256}`,
    );
  }
}

function normalizeSchemaReferences(schema: Record<string, unknown>): Record<string, unknown> {
  const definitions = schema.definitions;
  if (!isRecord(definitions)) {
    throw new Error("The protocol schema must contain definitions");
  }

  const definitionNames = new Map(
    Object.keys(definitions).map((name) => [normalizedDefinitionName(name), name]),
  );

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (!isRecord(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (key !== "$ref" || typeof item !== "string" || !item.endsWith(REFERENCE_SUFFIX)) {
          return [key, visit(item)];
        }

        const qualifiedName = item.slice(0, -REFERENCE_SUFFIX.length);
        const leafName = qualifiedName.split(".").at(-1);
        const definitionName = leafName === undefined ? undefined : definitionNames.get(leafName);
        if (definitionName === undefined) {
          throw new Error(`Unknown external schema reference: ${item}`);
        }
        return [key, `#/definitions/${escapeJsonPointer(definitionName)}`];
      }),
    );
  };

  const normalized = visit(schema);
  if (!isRecord(normalized)) {
    throw new Error("Normalized protocol schema must remain an object");
  }
  return normalized;
}

function generateStandaloneValidators(schema: Record<string, unknown>): string {
  const ajv = new Ajv2020({
    allErrors: true,
    code: { esm: true, lines: true, optimize: true, source: true },
    strict: false,
    validateFormats: false,
  });
  ajv.addSchema({ ...schema, $id: SCHEMA_IDENTIFIER });

  const validatorIdentifiers: Record<string, string> = {};
  for (const [exportName, definitionName] of Object.entries(VALIDATORS)) {
    const identifier = `${SCHEMA_IDENTIFIER}/${exportName}`;
    ajv.addSchema({
      $id: identifier,
      $ref: `${SCHEMA_IDENTIFIER}#/definitions/${escapeJsonPointer(definitionName)}`,
    });
    validatorIdentifiers[exportName] = identifier;
  }

  return `// @ts-nocheck -- generated standalone validators intentionally contain untyped locals.\n` +
    `// deno-lint-ignore-file\n` +
    `${generatedBanner("Standalone runtime validators")}\n` +
    `${STANDALONE_CODE(ajv, validatorIdentifiers)}\n`;
}

async function formatGeneratedFiles(paths: readonly string[]): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "--config", DENO_CONFIG_PATH, ...paths],
    stderr: "piped",
    stdout: "piped",
  });
  const result = await command.output();
  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`Failed to format generated protocol artifacts: ${stderr}`);
  }
}

function generatedBanner(artifact: string): string {
  return `/**
 * @generated ${artifact}. Do not edit by hand.
 *
 * A2A protocol: ${A2A_PROTOCOL_METADATA.protocolVersion} (${A2A_PROTOCOL_METADATA.sourceTag})
 * Normative proto: ${A2A_PROTOCOL_METADATA.protoUrl}
 * Published schema: ${A2A_PROTOCOL_METADATA.schemaUrl}
 * Schema SHA-256: ${A2A_PROTOCOL_METADATA.schemaSha256}
 * Schema generator: ${A2A_PROTOCOL_METADATA.schemaGenerator}
 * Artifact generator: ${A2A_PROTOCOL_METADATA.typeGenerator}; ${A2A_PROTOCOL_METADATA.validatorGenerator}
 * Upstream license: ${A2A_PROTOCOL_METADATA.upstreamLicense}
 */`;
}

function normalizedDefinitionName(name: string): string {
  return name.replaceAll(/[^A-Za-z0-9]/g, "");
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.main) {
  await generateProtocolArtifacts({
    schemaPath: join(CLIENT_DIRECTORY, "protocol.schema.json"),
    outputDirectory: Deno.args[0] ?? CLIENT_DIRECTORY,
  });
}
