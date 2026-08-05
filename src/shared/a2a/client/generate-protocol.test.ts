import { assertEquals, assertFalse, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { A2A_PROTOCOL_METADATA, generateProtocolArtifacts } from "./generate-protocol.ts";

const CLIENT_DIRECTORY = new URL(".", import.meta.url).pathname;
const SCHEMA_PATH = join(CLIENT_DIRECTORY, "protocol.schema.json");

Deno.test("generateProtocolArtifacts reproduces the committed protocol artifacts", async () => {
  const outputDirectory = await Deno.makeTempDir();

  try {
    await generateProtocolArtifacts({
      schemaPath: SCHEMA_PATH,
      outputDirectory,
    });

    for (const filename of ["protocol.generated.ts", "validation.generated.ts"]) {
      const expected = await Deno.readTextFile(join(CLIENT_DIRECTORY, filename));
      const actual = await Deno.readTextFile(join(outputDirectory, filename));
      assertEquals(actual, expected);
    }
  } finally {
    await Deno.remove(outputDirectory, { recursive: true });
  }
});

Deno.test("generateProtocolArtifacts rejects a schema without definitions", async () => {
  await assertSchemaRejected(
    JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema" }),
    "definitions",
  );
});

Deno.test("generateProtocolArtifacts rejects a non-object schema", async () => {
  await assertSchemaRejected("[]", "root must be an object");
});

Deno.test("generateProtocolArtifacts rejects a changed schema snapshot", async () => {
  const schema = await Deno.readTextFile(SCHEMA_PATH);
  await assertSchemaRejected(`${schema}\n`, "does not match the pinned source");
});

Deno.test("the committed schema matches its pinned source digest", async () => {
  const schema = await Deno.readFile(SCHEMA_PATH);
  const digestInput = new Uint8Array(schema.byteLength);
  digestInput.set(schema);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  assertEquals(actual, A2A_PROTOCOL_METADATA.schemaSha256);
  assertEquals(A2A_PROTOCOL_METADATA.protocolVersion, "1.0");
  assertEquals(A2A_PROTOCOL_METADATA.sourceTag, "v1.0.0");
});

Deno.test("generated browser contracts contain no Node or gRPC dependencies", async () => {
  const generatedSource = await Promise.all(
    ["protocol.generated.ts", "validation.generated.ts"].map((filename) =>
      Deno.readTextFile(join(CLIENT_DIRECTORY, filename))
    ),
  );
  const forbiddenRuntimeReferences =
    /(?:node:|from\s+["'](?:buffer|process|stream|util)["']|\bBuffer\b|\bprocess\.|\brequire\s*\(|@grpc|grpc-js)/;

  for (const source of generatedSource) {
    assertFalse(forbiddenRuntimeReferences.test(source));
  }
});

async function assertSchemaRejected(schema: string, expectedMessage: string): Promise<void> {
  const fixtureDirectory = await Deno.makeTempDir();
  const outputDirectory = await Deno.makeTempDir();
  const schemaPath = join(fixtureDirectory, "schema.json");

  try {
    await Deno.writeTextFile(schemaPath, schema);
    await assertRejects(
      () => generateProtocolArtifacts({ schemaPath, outputDirectory }),
      Error,
      expectedMessage,
    );
  } finally {
    await Promise.all([
      Deno.remove(fixtureDirectory, { recursive: true }),
      Deno.remove(outputDirectory, { recursive: true }),
    ]);
  }
}
