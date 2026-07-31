/**
 * Vendors the three UI fonts and the Lucide icon sprite so the shipped extension makes zero
 * runtime network requests, per ADR-0009 — a remote font or icon request from an overlay injected
 * into someone's page would leak which page they're annotating.
 *
 * This script itself fetches from Google Fonts and unpkg at **build time only**; its output
 * (`src/shared/design/fonts/*.woff2`, `src/shared/design/icons.svg`) is committed and is the only
 * thing that ships. Re-run with `deno run -A build/vendor-assets.ts` to refresh either.
 */
import { Buffer } from "node:buffer";
import subsetFont from "npm:subset-font@2.5.0";

/** Weights actually requested by `.claude-design/point-and-shoot/tokens/fonts.css`. */
export const FONT_SPECS = [
  {
    family: "Space Grotesk",
    cssName: "Space+Grotesk",
    weights: [400, 500, 600, 700],
    slug: "space-grotesk",
  },
  { family: "Inter", cssName: "Inter", weights: [400, 500, 600, 700], slug: "inter" },
  {
    family: "JetBrains Mono",
    cssName: "JetBrains+Mono",
    weights: [400, 500, 600],
    slug: "jetbrains-mono",
  },
] as const;

/**
 * Latin, punctuation, and symbols actually used by the UI: printable Basic Latin plus Latin-1
 * Supplement punctuation. Subsetting to this range instead of the font's full Unicode coverage is
 * what keeps the vendored payload in the 60-120KB range instead of shipping every script the
 * upstream font supports.
 */
function latinSubsetText(): string {
  const codepoints: number[] = [];
  for (let cp = 0x20; cp <= 0x7e; cp++) codepoints.push(cp); // Basic Latin + punctuation
  for (let cp = 0xa0; cp <= 0xff; cp++) codepoints.push(cp); // Latin-1 Supplement
  return String.fromCodePoint(...codepoints);
}

/** Downloads the CSS2 stylesheet for one family and returns each weight's TTF source URL. */
async function fetchFontFaceUrls(
  cssName: string,
  weights: readonly number[],
): Promise<Map<number, string>> {
  const wght = weights.join(";");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${cssName}:wght@${wght}&display=swap`;
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const byWeight = new Map<number, string>();
  const faceRe = /font-weight:\s*(\d+);[^}]*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g;
  for (const match of css.matchAll(faceRe)) {
    const weight = Number(match[1]);
    const url = match[2];
    if (weight !== undefined && url !== undefined) byWeight.set(weight, url);
  }
  return byWeight;
}

/** Fetches, subsets to the Latin range above, and writes one WOFF2 file per requested weight. */
async function vendorFonts(): Promise<void> {
  const outDir = new URL("../src/shared/design/fonts/", import.meta.url);
  await Deno.mkdir(outDir, { recursive: true });
  const subsetChars = latinSubsetText();
  let totalBytes = 0;

  for (const spec of FONT_SPECS) {
    const urls = await fetchFontFaceUrls(spec.cssName, spec.weights);
    for (const weight of spec.weights) {
      const ttfUrl = urls.get(weight);
      if (ttfUrl === undefined) {
        throw new Error(`vendor-assets: no TTF source found for ${spec.family} weight ${weight}`);
      }
      const ttf = Buffer.from(await (await fetch(ttfUrl)).arrayBuffer());
      const woff2 = await subsetFont(ttf, subsetChars, { targetFormat: "woff2" });
      const outPath = new URL(`${spec.slug}-${weight}.woff2`, outDir);
      await Deno.writeFile(outPath, woff2);
      totalBytes += woff2.byteLength;
      console.log(`wrote ${spec.slug}-${weight}.woff2 (${woff2.byteLength} bytes)`);
    }
  }

  console.log(`total vendored font payload: ${totalBytes} bytes`);
}

/**
 * Icon names actually referenced via `<Icon name="...">` in
 * `.claude-design/point-and-shoot/ui_kits/` and `components/` — not the broader guidelines
 * showcase list, which includes names the shipped UI never uses.
 */
const ICON_NAMES = [
  "arrow-down",
  "arrow-up",
  "camera",
  "crosshair",
  "list-checks",
  "message-square-plus",
  "pencil",
  "settings",
  "trash-2",
] as const;

/** Inner markup (everything between `<svg ...>` and `</svg>`) for each vendored Lucide icon. */
const ICON_BODIES: Record<(typeof ICON_NAMES)[number], string> = {
  "arrow-down": '<path d="M12 5v14" /><path d="m19 12-7 7-7-7" />',
  "arrow-up": '<path d="m5 12 7-7 7 7" /><path d="M12 19V5" />',
  camera:
    '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /><circle cx="12" cy="13" r="3" />',
  crosshair:
    '<circle cx="12" cy="12" r="10" /><line x1="22" x2="18" y1="12" y2="12" /><line x1="6" x2="2" y1="12" y2="12" /><line x1="12" x2="12" y1="6" y2="2" /><line x1="12" x2="12" y1="22" y2="18" />',
  "list-checks":
    '<path d="M13 5h8" /><path d="M13 12h8" /><path d="M13 19h8" /><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" />',
  "message-square-plus":
    '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /><path d="M12 8v6" /><path d="M9 11h6" />',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
  settings:
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" />',
  "trash-2":
    '<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
};

/**
 * Assembles the vendored Lucide icons into one `<symbol>`-based sprite and its typed name union.
 *
 * @returns A promise that resolves after both generated files are written.
 */
export async function vendorIcons(): Promise<void> {
  const symbols = ICON_NAMES.map((name) =>
    `  <symbol id="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${ICON_BODIES[name]}
  </symbol>`
  ).join("\n");
  const sprite = `<!-- @license lucide-static v1.27.0 - ISC -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbols}
</svg>
`;
  const outPath = new URL("../src/shared/design/icons.svg", import.meta.url);
  await Deno.writeTextFile(outPath, sprite);
  console.log(`wrote icons.svg (${sprite.length} bytes, ${ICON_NAMES.length} icons)`);

  const union = ICON_NAMES.map((name) => `  | "${name}"`).join("\n");
  const iconTypesSrc = `/**
 * Generated by \`build/vendor-assets.ts\` from the Lucide icons actually referenced under
 * \`.claude-design/point-and-shoot/ui_kits/\` and \`components/\`. Each name maps to a
 * \`#icon-<name>\` symbol id in \`src/shared/design/icons.svg\`.
 */
export type IconName =
${union};
`;
  const typesPath = new URL("../src/shared/design/icon-names.ts", import.meta.url);
  await Deno.writeTextFile(typesPath, iconTypesSrc);
  console.log("wrote icon-names.ts");
}

if (import.meta.main) {
  await vendorFonts();
  await vendorIcons();
}
