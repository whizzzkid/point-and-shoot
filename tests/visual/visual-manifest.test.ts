import { assertEquals } from "@std/assert";

const EXPECTED_BASELINES = [
  "gallery-dark.png",
  "gallery-light.png",
  "notes-dark.png",
  "notes-light.png",
  "options-dark.png",
  "options-light.png",
  "plan-dark.png",
  "plan-light.png",
  "popup-dark.png",
  "popup-light.png",
  "toolbar-dark.png",
  "toolbar-light.png",
] as const;

Deno.test("visual baselines cover every surface in both forced themes", async () => {
  const actual: string[] = [];
  try {
    for await (const entry of Deno.readDir("tests/visual/baselines")) {
      if (entry.isFile && entry.name.endsWith(".png")) actual.push(entry.name);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  assertEquals(actual.sort(), [...EXPECTED_BASELINES]);
});
