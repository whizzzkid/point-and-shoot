import { assertEquals } from "@std/assert";
import { parseBootLine } from "./boot-firefox.ts";

Deno.test("parseBootLine - extracts quoted boot and closed-shadow font markers", () => {
  assertEquals(
    parseBootLine('console.log: "point-and-shoot: background ready"'),
    {
      backgroundReady: true,
      shadowFontStatus: null,
      unexpectedError: null,
      woff2Status: null,
    },
  );
  assertEquals(
    parseBootLine('console.log: "firefox-boot: woff2-status=200"'),
    {
      backgroundReady: false,
      shadowFontStatus: null,
      unexpectedError: null,
      woff2Status: "200",
    },
  );
  assertEquals(
    parseBootLine('console.log: "firefox-boot: shadow-font=ready"'),
    {
      backgroundReady: false,
      shadowFontStatus: "ready",
      unexpectedError: null,
      woff2Status: null,
    },
  );
});

Deno.test("parseBootLine - preserves unexpected errors and failed font status", () => {
  assertEquals(
    parseBootLine('console.log: "firefox-boot: shadow-font=error"'),
    {
      backgroundReady: false,
      shadowFontStatus: "error",
      unexpectedError: null,
      woff2Status: null,
    },
  );
  assertEquals(
    parseBootLine('console.error: "shadow font failed"'),
    {
      backgroundReady: false,
      shadowFontStatus: null,
      unexpectedError: 'console.error: "shadow font failed"',
      woff2Status: null,
    },
  );
});

Deno.test("parseBootLine - ignores Firefox's empty font-loader console object", () => {
  const ignoredConsoleObject = {
    backgroundReady: false,
    shadowFontStatus: null,
    unexpectedError: null,
    woff2Status: null,
  };
  for (
    const line of [
      "[web-ext/firefox/index.js][debug] Firefox stdout: console.error: ({})",
      "console.error: ({})",
    ]
  ) {
    assertEquals(parseBootLine(line), ignoredConsoleObject);
  }
});
