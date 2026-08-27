import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { Session } from "../schema.ts";
import type { StyleDigestBundle } from "../style-digest.ts";
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

Deno.test("toMarkdown tersely projects uniform, mixed, and zero computed styles", () => {
  const originalDigest = EXPORT_FIXTURE_SESSION.notes[0]?.elements[0]?.styleDigest;
  if (originalDigest === null || originalDigest === undefined) {
    throw new Error("export fixture must include computed style evidence");
  }
  const digest: StyleDigestBundle = {
    ...originalDigest,
    self: {
      ...originalDigest.self,
      box: {
        ...originalDigest.self.box,
        paddingTop: 0,
        paddingRight: 8,
        paddingBottom: 16,
        paddingLeft: 24,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        marginLeft: 8,
      },
      color: {
        ...originalDigest.self.color,
        borderTopColor: "#111111",
        borderRightColor: "#222222",
        borderBottomColor: "#333333",
        borderLeftColor: "#444444",
      },
    },
  };
  const session: Session = {
    ...EXPORT_FIXTURE_SESSION,
    notes: [{
      ...EXPORT_FIXTURE_SESSION.notes[0]!,
      elements: [{
        ...EXPORT_FIXTURE_SESSION.notes[0]!.elements[0]!,
        styleDigest: digest,
      }],
    }],
  };
  const actual = toMarkdown(session);

  assertStringIncludes(actual, `"padding": "0 8px 16px 24px"`);
  assertStringIncludes(actual, `"margin": "4px 8px"`);
  assertStringIncludes(actual, `"borderWidth": "1px"`);
  assertStringIncludes(actual, `"borderTopColor": "#111111"`);
  assertEquals(actual.includes('"paddingTop"'), false);
  assertEquals(actual.includes('"borderColor"'), false);
});

Deno.test("Markdown style projection does not mutate or replace canonical session JSON", () => {
  const before = toJson(EXPORT_FIXTURE_SESSION);

  const markdown = toMarkdown(EXPORT_FIXTURE_SESSION);

  assertStringIncludes(markdown, `"padding": "12px 16px"`);
  assertStringIncludes(markdown, `"margin": "0"`);
  assertStringIncludes(markdown, `"borderColor": "#4f7cff"`);
  assertEquals(markdown.includes('"paddingTop"'), false);
  assertEquals(toJson(EXPORT_FIXTURE_SESSION), before);
});

Deno.test("serializers handle an empty inclusion set without leaking excluded note data", () => {
  const includedNoteIds = new Set<string>();

  assertEquals(JSON.parse(toJson(EXPORT_FIXTURE_SESSION, { includedNoteIds })).notes, []);
  assertEquals(toMarkdown(EXPORT_FIXTURE_SESSION, { includedNoteIds }).includes("secret"), false);
});

Deno.test("toMarkdown wraps the generated plan with header and footer prompt parts", () => {
  const header = "// Use my custom skills to plan and execute on this.";
  const footer = "// Work hard, don't make mistakes.";
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION, { headerPrompt: header, footerPrompt: footer });

  assertStringIncludes(actual, header);
  assertStringIncludes(actual, footer);
  assertEquals(actual.indexOf(header), 0);
  assertEquals(actual.trimEnd().endsWith(footer), true);
  // The header leads the generated plan, and the footer trails it.
  const titleIndex = actual.indexOf("# ");
  assert(actual.indexOf(header) < titleIndex);
  assert(titleIndex < actual.indexOf(footer));
  // The body already ends with a newline, so the footer is separated by exactly one blank line,
  // and the output still ends with a trailing newline like every other export.
  assertEquals(actual.includes("\n\n\n"), false);
  assert(actual.endsWith(`\n\n${footer}\n`));
});

Deno.test("toMarkdown wraps the generated plan with a header-only prompt part", () => {
  const header = "// Use my custom skills to plan and execute on this.";
  const without = toMarkdown(EXPORT_FIXTURE_SESSION);
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION, { headerPrompt: header });

  assert(actual.startsWith(`${header}\n\n`));
  assertEquals(actual, `${header}\n\n${without}`);
});

Deno.test("toMarkdown wraps the generated plan with a footer-only prompt part", () => {
  const footer = "// Work hard, don't make mistakes.";
  const without = toMarkdown(EXPORT_FIXTURE_SESSION);
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION, { footerPrompt: footer });

  assertEquals(actual, `${without}\n${footer}\n`);
});

Deno.test("toMarkdown trims and ignores blank header and footer prompt parts", () => {
  const without = toMarkdown(EXPORT_FIXTURE_SESSION);
  const withBlank = toMarkdown(EXPORT_FIXTURE_SESSION, {
    headerPrompt: "   \n",
    footerPrompt: "\t",
  });
  assertEquals(withBlank, without);
});

Deno.test("toMarkdown numbers evidence by note and elements as note-number.letter", () => {
  const firstNote = EXPORT_FIXTURE_SESSION.notes[0]!;
  const session: Session = {
    ...EXPORT_FIXTURE_SESSION,
    notes: [
      { ...firstNote, elements: [firstNote.elements[0]!, firstNote.elements[0]!] },
      EXPORT_FIXTURE_SESSION.notes[1]!,
    ],
  };

  const actual = toMarkdown(session);

  assertStringIncludes(actual, "### Evidence 1");
  assertStringIncludes(actual, "#### Element 1.a");
  assertStringIncludes(actual, "#### Element 1.b");
  assertStringIncludes(actual, "### Evidence 2");
  assertStringIncludes(actual, "#### Element 2.a");
});

Deno.test("toMarkdown labels a 27th element with a spreadsheet-style aa suffix", () => {
  const firstNote = EXPORT_FIXTURE_SESSION.notes[0]!;
  const element = firstNote.elements[0]!;
  const session: Session = {
    ...EXPORT_FIXTURE_SESSION,
    notes: [{ ...firstNote, elements: Array.from({ length: 27 }, () => element) }],
  };

  const actual = toMarkdown(session);

  assertStringIncludes(actual, "#### Element 1.z");
  assertStringIncludes(actual, "#### Element 1.aa");
});

Deno.test("toMarkdown leads with Goal/Location headings and default planning guidance", () => {
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION);

  assertStringIncludes(actual, "### Goal");
  assertStringIncludes(actual, "### Location on Live page");
  assertStringIncludes(actual, "These are raw notes captured from live changes");
  assertStringIncludes(actual, "After planning, confirm every ask");
  assertEquals(actual.includes("### Problem"), false);
});

Deno.test("toMarkdown omits planning guidance when no notes are selected", () => {
  const actual = toMarkdown(EXPORT_FIXTURE_SESSION, { includedNoteIds: new Set() });

  assertStringIncludes(actual, "0 notes captured.");
  assertEquals(actual.includes("These are raw notes captured"), false);
  assertEquals(actual.includes("After planning, confirm"), false);
  assertEquals(actual.includes("\n\n\n"), false);
});

Deno.test("shotPath keeps lexical order when a session reaches three digits", () => {
  assertEquals(shotPath(0, 100), "shots/note-001.webp");
  assertEquals(shotPath(98, 100), "shots/note-099.webp");
  assertEquals(shotPath(99, 100), "shots/note-100.webp");
});
