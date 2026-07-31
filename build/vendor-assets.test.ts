import { assertEquals, assertStringIncludes } from "@std/assert";

const FONTS_DIR = new URL("../src/shared/design/fonts/", import.meta.url);
const ICONS_SVG = new URL("../src/shared/design/icons.svg", import.meta.url);
const ICON_NAMES_TS = new URL("../src/shared/design/icon-names.ts", import.meta.url);

const EXPECTED_FONT_FILES = [
  "space-grotesk-400.woff2",
  "space-grotesk-500.woff2",
  "space-grotesk-600.woff2",
  "space-grotesk-700.woff2",
  "inter-400.woff2",
  "inter-500.woff2",
  "inter-600.woff2",
  "inter-700.woff2",
  "jetbrains-mono-400.woff2",
  "jetbrains-mono-500.woff2",
  "jetbrains-mono-600.woff2",
];

const EXPECTED_ICON_NAMES = [
  "arrow-down",
  "arrow-up",
  "camera",
  "crosshair",
  "list-checks",
  "message-square-plus",
  "pencil",
  "settings",
  "trash-2",
];

Deno.test("vendor-assets - every expected font weight was vendored", async () => {
  for (const fileName of EXPECTED_FONT_FILES) {
    const stat = await Deno.stat(new URL(fileName, FONTS_DIR));
    assertEquals(stat.isFile, true);
  }
});

Deno.test("vendor-assets - vendored fonts carry the WOFF2 magic signature", async () => {
  for (const fileName of EXPECTED_FONT_FILES) {
    const bytes = await Deno.readFile(new URL(fileName, FONTS_DIR));
    const magic = new TextDecoder().decode(bytes.slice(0, 4));
    assertEquals(magic, "wOF2");
  }
});

Deno.test("vendor-assets - icons.svg defines a symbol for every referenced icon name", async () => {
  const sprite = await Deno.readFile(ICONS_SVG);
  const text = new TextDecoder().decode(sprite);
  for (const name of EXPECTED_ICON_NAMES) {
    assertStringIncludes(text, `id="icon-${name}"`);
  }
});

Deno.test("vendor-assets - every external symbol carries Lucide presentation attributes", async () => {
  const text = await Deno.readTextFile(ICONS_SVG);
  for (const name of EXPECTED_ICON_NAMES) {
    assertStringIncludes(
      text,
      `<symbol id="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor"`,
    );
  }
});

Deno.test("vendor-assets - icons.svg has no remote asset references", async () => {
  const sprite = await Deno.readFile(ICONS_SVG);
  const text = new TextDecoder().decode(sprite);
  // A negative lookahead anchored at `^` only inspects the first line — `.` does not cross a
  // newline without the `s` flag, so a remote URL on line 2 passed. Assert the absence directly.
  const remote = [...text.matchAll(/https?:\/\/[^\s"'<>)]+/g)]
    .map((m) => m[0])
    .filter((url) => !url.startsWith("http://www.w3.org/"));
  assertEquals(remote, []);
});

Deno.test("vendor-assets - IconName union matches the vendored sprite exactly", async () => {
  const iconNamesSrc = await Deno.readTextFile(ICON_NAMES_TS);
  const matches = [...iconNamesSrc.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
  assertEquals(matches, EXPECTED_ICON_NAMES);
});
