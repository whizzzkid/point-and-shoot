import { assertEquals } from "@std/assert";
import { forceTheme, resolveTheme } from "./theme.ts";

Deno.test("resolveTheme - contrasts dark and light backdrop samples", () => {
  assertEquals(
    resolveTheme({
      sample: () => [{ red: 10, green: 11, blue: 13 }],
    }),
    "light",
  );
  assertEquals(
    resolveTheme({
      sample: () => [{ red: 255, green: 255, blue: 255 }],
    }),
    "dark",
  );
});

Deno.test("resolveTheme - options and test overrides win without sampling", () => {
  let sampleCalls = 0;
  const sample = () => {
    sampleCalls += 1;
    return [{ red: 255, green: 255, blue: 255 }];
  };

  assertEquals(resolveTheme({ override: "dark", sample }), "dark");
  assertEquals(sampleCalls, 0);

  forceTheme("light");
  try {
    assertEquals(resolveTheme({ override: "dark", sample }), "light");
    assertEquals(sampleCalls, 0);
  } finally {
    forceTheme(null);
  }
});

Deno.test("resolveTheme - hysteresis stabilizes mid-luminance and empty samples", () => {
  const middleGray = () => [{ red: 188, green: 188, blue: 188 }];
  const noSamples = () => [];

  assertEquals(resolveTheme({ previousTheme: "dark", sample: middleGray }), "dark");
  assertEquals(resolveTheme({ previousTheme: "light", sample: middleGray }), "light");
  assertEquals(resolveTheme({ previousTheme: "light", sample: noSamples }), "light");
  assertEquals(resolveTheme({ sample: noSamples }), "dark");
});
