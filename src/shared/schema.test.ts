import { assert, assertEquals } from "@std/assert";
import { SCHEMA_VERSION, type Session, validateSession } from "./schema.ts";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "session-1",
    name: "Checkout flow",
    createdAt: "2026-07-27T00:00:00.000Z",
    endedAt: null,
    notes: [
      {
        id: "note-1",
        createdAt: "2026-07-27T00:01:00.000Z",
        pageUrl: "https://example.com/checkout",
        pageTitle: "Checkout",
        region: {
          screenshot: "data:image/webp;base64,AAAA",
          viewport: { width: 1280, height: 720 },
          box: { x: 0, y: 0, width: 100, height: 50 },
          truncated: false,
        },
        elements: [],
        text: "Button is misaligned",
      },
    ],
    ...overrides,
  };
}

Deno.test("validateSession - a well-formed session round-trips through JSON", () => {
  const session = makeSession();
  const result = validateSession(JSON.parse(JSON.stringify(session)));
  assert(result.valid, `expected valid, got ${JSON.stringify(result)}`);
  assertEquals(result.valid && result.session.id, "session-1");
});

Deno.test("validateSession - rejects a non-object", () => {
  const result = validateSession("not a session");
  assertEquals(result.valid, false);
  assert(!result.valid && result.error.reason === "not-an-object");
});

Deno.test("validateSession - rejects an unsupported schema version", () => {
  const result = validateSession({ ...makeSession(), schemaVersion: 999 });
  assertEquals(result.valid, false);
  assert(!result.valid && result.error.reason === "unsupported-schema-version");
});

Deno.test("validateSession - rejects a missing required field", () => {
  const broken = makeSession() as unknown as Record<string, unknown>;
  delete broken.name;
  const result = validateSession(broken);
  assertEquals(result.valid, false);
  assert(!result.valid && result.error.reason === "missing-field" && result.error.field === "name");
});

Deno.test("validateSession - rejects a note missing region.truncated", () => {
  const broken = makeSession();
  const badRegion: Record<string, unknown> = { ...broken.notes[0]?.region };
  delete badRegion.truncated;
  const badNote = { ...broken.notes[0], region: badRegion };
  const result = validateSession({ ...broken, notes: [badNote] });
  assertEquals(result.valid, false);
  assert(!result.valid && result.error.reason === "invalid-field");
});

/**
 * Each of these malformed records passed validation before the deep field checks landed — the
 * validator only reached `region.truncated` and `Array.isArray(elements)`, then cast the rest. The
 * cast is the whole risk: a `null` screenshot or a `NaN` box reaches the export path as valid data
 * and fails there, far from the record that caused it.
 */
Deno.test("validateSession - rejects malformed region and element fields", async (t) => {
  const base = makeSession();
  const note = base.notes[0];
  assert(note !== undefined);

  function expectRejected(region: unknown, elements: unknown = []): void {
    const result = validateSession({ ...base, notes: [{ ...note, region, elements }] });
    assertEquals(result.valid, false);
    assert(!result.valid && result.error.reason === "invalid-field");
  }

  await t.step("a non-string screenshot", () => {
    expectRejected({ ...note.region, screenshot: null });
  });

  await t.step("a viewport missing a dimension", () => {
    expectRejected({ ...note.region, viewport: { width: 1280 } });
  });

  await t.step("a non-numeric box coordinate", () => {
    expectRejected({ ...note.region, box: { ...note.region.box, x: "0" } });
  });

  await t.step("a non-finite box dimension", () => {
    // `NaN` survives `JSON.stringify` as `null`, so a record can arrive holding one either way.
    expectRejected({ ...note.region, box: { ...note.region.box, width: Number.NaN } });
  });

  await t.step("an element that is not an object", () => {
    expectRejected(note.region, ["button"]);
  });

  await t.step("an element whose selectors lack the reachable discriminant", () => {
    expectRejected(note.region, [{ selectors: {}, styleDigest: null }]);
  });

  await t.step("an element missing styleDigest entirely", () => {
    expectRejected(note.region, [{ selectors: { reachable: false } }]);
  });
});

Deno.test("validateSession - accepts a fully populated element", () => {
  const base = makeSession();
  const note = base.notes[0];
  assert(note !== undefined);
  const result = validateSession({
    ...base,
    notes: [{
      ...note,
      elements: [{
        selectors: { reachable: false, unreachable: "detached", testIds: [] },
        styleDigest: null,
        componentHint: { framework: "react", name: "CheckoutButton" },
      }],
    }],
  });
  assert(result.valid, `expected valid, got ${JSON.stringify(result)}`);
});

Deno.test("validateSession - accepts endedAt as either a string or null", () => {
  assert(validateSession(makeSession({ endedAt: null })).valid);
  assert(validateSession(makeSession({ endedAt: "2026-07-27T01:00:00.000Z" })).valid);
});

Deno.test("validateSession - accepts a boolean stripQuery preference and rejects other values", () => {
  const base = makeSession();
  const note = base.notes[0];
  assert(note !== undefined);

  assert(validateSession({ ...base, notes: [{ ...note, stripQuery: true }] }).valid);
  const invalid = validateSession({ ...base, notes: [{ ...note, stripQuery: "yes" }] });
  assertEquals(invalid.valid, false);
});

Deno.test("validateSession - rejects endedAt of the wrong type", () => {
  const result = validateSession({ ...makeSession(), endedAt: 12345 });
  assertEquals(result.valid, false);
  assert(
    !result.valid && result.error.reason === "invalid-field" && result.error.field === "endedAt",
  );
});
