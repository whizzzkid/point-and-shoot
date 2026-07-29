import { assertEquals } from "@std/assert";
import { shotOutputPath, WAVE_3_SHOT_SURFACES, WAVE_3_SHOT_THEMES } from "./wave-3-shots.ts";

Deno.test("wave 3 screenshots cover every extension surface in both forced themes", () => {
  assertEquals(WAVE_3_SHOT_SURFACES, ["toolbar", "notes", "plan", "popup", "options"]);
  assertEquals(WAVE_3_SHOT_THEMES, ["dark", "light"]);
  assertEquals(
    WAVE_3_SHOT_SURFACES.flatMap((surface) =>
      WAVE_3_SHOT_THEMES.map((theme) => shotOutputPath(surface, theme))
    ),
    [
      "docs/assets/wave-3/toolbar-dark.png",
      "docs/assets/wave-3/toolbar-light.png",
      "docs/assets/wave-3/notes-dark.png",
      "docs/assets/wave-3/notes-light.png",
      "docs/assets/wave-3/plan-dark.png",
      "docs/assets/wave-3/plan-light.png",
      "docs/assets/wave-3/popup-dark.png",
      "docs/assets/wave-3/popup-light.png",
      "docs/assets/wave-3/options-dark.png",
      "docs/assets/wave-3/options-light.png",
    ],
  );
});
