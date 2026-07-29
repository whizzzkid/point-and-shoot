import { assertEquals, assertStringIncludes } from "@std/assert";
import { EXPORT_FIXTURE_SESSION } from "./fixture.ts";
import { shotPath, toJson, toMarkdown } from "./index.ts";

const EXPECTED_JSON = new URL("session.golden.json", import.meta.url);
const EXPECTED_MARKDOWN = new URL("plan.golden.md", import.meta.url);

Deno.test("toJson matches the canonical golden record and strips sensitive query data", async () => {
  const actual = toJson(EXPORT_FIXTURE_SESSION);

  assertEquals(actual, await Deno.readTextFile(EXPECTED_JSON));
  assertEquals(
    EXPORT_FIXTURE_SESSION.notes[0]?.pageUrl,
    "https://example.com/checkout?access_token=secret&step=payment",
    "serialization must not mutate the stored record",
  );
  assertEquals(actual.includes("secret"), false);
  assertStringIncludes(actual, "data:image/webp;base64,UklGRiIAAABXRUJQ");
});

Deno.test("toMarkdown matches the agent-ready golden projection", async () => {
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION);

  assertEquals(actual, await Deno.readTextFile(EXPECTED_MARKDOWN));
  assertStringIncludes(actual, "Framework hint");
  assertEquals(actual.match(/Framework hint/g)?.length, 1);
  assertStringIncludes(actual, "./shots/note-01.webp");
  assertStringIncludes(actual, "./shots/note-02.webp");
});

Deno.test("toMarkdown can select notes and omit image references for clipboard output", () => {
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION, {
    includeImageReferences: false,
    includedNoteIds: new Set(["note-summary"]),
  });

  assertStringIncludes(actual, "The total wraps onto a second line");
  assertStringIncludes(actual, "This image-free prompt is a convenience projection.");
  assertEquals(actual.includes("primary action"), false);
  assertEquals(actual.includes("shots/"), false);
  assertEquals(actual.includes("Framework hint"), false);
});

Deno.test("serializers handle an empty inclusion set without leaking excluded note data", () => {
  const includedNoteIds = new Set<string>();

  assertEquals(JSON.parse(toJson(EXPORT_FIXTURE_SESSION, { includedNoteIds })).notes, []);
  assertEquals(toMarkdown(EXPORT_FIXTURE_SESSION, { includedNoteIds }).includes("secret"), false);
});

Deno.test("shotPath keeps lexical order when a session reaches three digits", () => {
  assertEquals(shotPath(0, 100), "shots/note-001.webp");
  assertEquals(shotPath(98, 100), "shots/note-099.webp");
  assertEquals(shotPath(99, 100), "shots/note-100.webp");
});
