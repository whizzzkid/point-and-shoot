/**
 * Generates `src/shared/design/tokens.css` and `src/shared/design/tokens.ts` from the design
 * bundle under `.claude-design/point-and-shoot/tokens/`, per ADR-0011.
 *
 * Hand-copying a token drifts silently from the design source; generating both files from the
 * bundle plus `deno task tokens:check` (a regenerate-and-diff) makes that drift a CI failure
 * instead of a UI bug nobody notices.
 */
import { FONT_SPECS } from "./vendor-assets.ts";

/**
 * The committed bundle's identity, from `docs/design.md`. `_ds_manifest.json` carries no version
 * field, so these two values together are how a red `tokens-drift` check is told apart from a
 * legitimate re-export: a re-export updates both here and in `docs/design.md` in the same commit.
 */
const DESIGN_BUNDLE = {
  namespace: "PointShootDesignSystem_5498d1",
  contentHash: "2ed2f2a9a1d9f5a67189eb42cdef0c16192474f4",
} as const;

/**
 * `styles.css`'s `@import` order. `base.css` consumes variables the five files before it define,
 * so this is not alphabetical and not directory order — reordering produces undefined properties
 * at the point of use.
 */
const TOKEN_FILE_ORDER = ["fonts", "colors", "typography", "spacing", "effects", "base"] as const;

const GENERATED_HEADER = `/*
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`deno task tokens\`. Edits belong upstream in
 * .claude-design/point-and-shoot/tokens/, re-exported as a whole bundle (see docs/design.md).
 *
 * Design bundle: namespace=${DESIGN_BUNDLE.namespace} contentHash=${DESIGN_BUNDLE.contentHash}
 */
`;

/** Reads one token file from the design bundle. */
function readTokenFile(name: (typeof TOKEN_FILE_ORDER)[number]): Promise<string> {
  const path = new URL(
    `../.claude-design/point-and-shoot/tokens/${name}.css`,
    import.meta.url,
  );
  return Deno.readTextFile(path);
}

/**
 * Replaces `fonts.css`'s line 1 (the upstream Google Fonts `@import`) with local `@font-face`
 * rules pointing at the W2.5-vendored WOFF2 files. The rest of `fonts.css` — the `:root` font-stack
 * block — is kept verbatim; it defines the font-family tokens, not the remote dependency.
 */
function substituteFontImport(fontsCss: string): string {
  const lines = fontsCss.split("\n");
  const withoutImport = lines.slice(1).join("\n");
  const faces = FONT_SPECS.flatMap((spec) =>
    spec.weights.map((weight) =>
      `@font-face{font-family:'${spec.family}';font-weight:${weight};font-style:normal;` +
      `font-display:swap;src:url('./fonts/${spec.slug}-${weight}.woff2') format('woff2')}`
    )
  ).join("\n");
  return `${faces}\n${withoutImport}`;
}

/** Concatenates the six token files in `styles.css`'s order, substituting the font import. */
async function buildTokensCss(): Promise<string> {
  const parts: string[] = [];
  for (const name of TOKEN_FILE_ORDER) {
    const css = await readTokenFile(name);
    parts.push(name === "fonts" ? substituteFontImport(css) : css);
  }
  return GENERATED_HEADER + parts.join("\n");
}

/** Every `--custom-property:` definition in the generated CSS, in first-seen order, deduplicated. */
function extractTokenNames(css: string): string[] {
  const seen = new Set<string>();
  for (const match of css.matchAll(/--([a-z0-9-]+):/g)) {
    const name = match[1];
    if (name !== undefined) seen.add(name);
  }
  return [...seen];
}

/** Builds the typed `TokenName` union plus a `token()` helper from the generated CSS. */
function buildTokensTs(css: string): string {
  const names = extractTokenNames(css);
  const union = names.map((name) => `  | "${name}"`).join("\n");
  return `${GENERATED_HEADER}
/** Every custom-property token name defined in \`tokens.css\`. */
export type TokenName =
${union};

/**
 * Returns the \`var(--token)\` reference for a token name, so a typo is a type error instead of a
 * silently-empty CSS variable.
 *
 * @param name - A token name, without the leading \`--\`.
 * @returns The \`var(--name)\` CSS value.
 * @example token("accent") // => "var(--accent)"
 */
export function token(name: TokenName): string {
  return \`var(--${"$"}{name})\`;
}
`;
}

/** Regenerates `tokens.css` and `tokens.ts` into `src/shared/design/`. */
async function generateTokens(): Promise<{ css: string; ts: string }> {
  const css = await buildTokensCss();
  const ts = buildTokensTs(css);
  return { css, ts };
}

if (import.meta.main) {
  const targetDir = Deno.args.includes("--check")
    ? await Deno.makeTempDir()
    : new URL("../src/shared/design/", import.meta.url).pathname;

  const { css, ts } = await generateTokens();
  await Deno.writeTextFile(`${targetDir}/tokens.css`, css);
  await Deno.writeTextFile(`${targetDir}/tokens.ts`, ts);

  if (Deno.args.includes("--check")) {
    // `deno fmt` reformats both generated files (e.g. expanding minified CSS onto
    // multiple lines), so the temp copy must go through the same formatter as the
    // committed one before diffing — otherwise every check run reports drift.
    await new Deno.Command("deno", { args: ["fmt", targetDir] }).output();
    const committedDir = new URL("../src/shared/design/", import.meta.url).pathname;
    const diff = await new Deno.Command("diff", {
      args: [
        "-u",
        "-r",
        committedDir,
        targetDir,
        "--exclude=fonts",
        "--exclude=icons.svg",
        "--exclude=icon-names.ts",
      ],
    }).output();
    if (!diff.success) {
      console.error(new TextDecoder().decode(diff.stdout));
      console.error("tokens:check — generated tokens differ from the committed files");
      Deno.exit(1);
    }
    console.log("tokens:check — up to date");
  } else {
    console.log("wrote tokens.css and tokens.ts");
  }
}
