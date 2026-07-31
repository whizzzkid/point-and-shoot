import { assertAlmostEquals, assertEquals } from "@std/assert";
import { compositeColors, contrastRatio, parseCssColor } from "./contrast.ts";

Deno.test("contrast utilities parse browser colors and composite alpha independently", () => {
  const foreground = parseCssColor("rgba(255, 255, 255, 0.5)");
  const background = parseCssColor("rgb(0, 0, 0)");

  assertEquals(foreground, { alpha: 0.5, blue: 255, green: 255, red: 255 });
  assertEquals(background, { alpha: 1, blue: 0, green: 0, red: 0 });
  assertEquals(compositeColors(foreground, background), {
    alpha: 1,
    blue: 127.5,
    green: 127.5,
    red: 127.5,
  });
});

Deno.test("contrast ratio matches the WCAG black-to-white reference value", () => {
  const black = parseCssColor("#000000");
  const white = parseCssColor("#ffffff");

  assertAlmostEquals(contrastRatio(black, white), 21, 0.000_001);
  assertAlmostEquals(contrastRatio(white, black), 21, 0.000_001);
});

Deno.test("contrast utilities reject unsupported browser color syntax", () => {
  let thrown: unknown;
  try {
    parseCssColor("transparent");
  } catch (error) {
    thrown = error;
  }

  assertEquals(thrown instanceof Error, true);
  assertEquals((thrown as Error).message, 'unsupported CSS color: "transparent"');
});
