import { fromFileUrl, relative, toFileUrl } from "@std/path";
import { PNG } from "pngjs";
import { parseStoreListing } from "./store-listing.ts";

const STORE_ASSET_DIRECTORY = "docs/assets/store";
const STORE_ASSET_MANIFEST = `${STORE_ASSET_DIRECTORY}/manifest.json`;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_HEADER_LENGTH = 29;
const SOURCE_ROOTS = [
  "deno.json",
  "deno.lock",
  "build/build.ts",
  "build/icons.ts",
  "build/manifest.ts",
  "build/preact.ts",
  "build/store-assets.ts",
  "build/store-screenshots.ts",
  "store-listing.json",
  "src/",
  "tests/e2e/note-preview-harness.ts",
  "tests/fixtures/app/",
  "tests/visual/baselines/toolbar-dark.png",
] as const;

type PromoKind = "small" | "marquee";

/** One vendor-facing artwork file generated and validated by the repository. */
export interface StoreArtworkSpecification {
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly promoKind?: PromoKind;
}

/** One actionable generated-asset contract violation. */
export interface StoreAssetIssue {
  readonly path: string;
  readonly message: string;
}

/** Structural fields from a PNG image's IHDR chunk. */
export interface PngInformation {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
}

interface BadgeSpecification {
  readonly fileName: string;
  readonly height: number;
  readonly sha256: string;
  readonly sourceUrl: string;
  readonly width: number;
}

interface StoreAssetManifest {
  readonly schemaVersion: 1;
  readonly currentVersionSummary: string;
  readonly sourceDigest: string;
  readonly sourcePaths: readonly string[];
  readonly assets: readonly {
    readonly fileName: string;
    readonly sha256: string;
  }[];
}

/** Function that captures the five ordered store screenshots into one output directory. */
export type StoreScreenshotCapture = (root: URL, outputDirectory: URL) => Promise<void>;

interface RgbColor {
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

interface PromoPalette {
  readonly accent: RgbColor;
  readonly background: RgbColor;
  readonly border: RgbColor;
  readonly evidence: RgbColor;
  readonly surface: RgbColor;
}

/** Ordered launch artwork: exactly five screenshots followed by the two promotional tiles. */
export const STORE_ARTWORK: readonly StoreArtworkSpecification[] = [
  { fileName: "01-capture-toolbar.png", height: 800, width: 1_280 },
  { fileName: "02-notes-review.png", height: 800, width: 1_280 },
  { fileName: "03-note-hover-highlight.png", height: 800, width: 1_280 },
  { fileName: "04-compiled-plan.png", height: 800, width: 1_280 },
  { fileName: "05-privacy-settings.png", height: 800, width: 1_280 },
  { fileName: "small-promo.png", height: 280, promoKind: "small", width: 440 },
  { fileName: "marquee-promo.png", height: 560, promoKind: "marquee", width: 1_400 },
] as const;

const STORE_BADGES: readonly BadgeSpecification[] = [
  {
    fileName: "chrome-web-store-badge.png",
    height: 150,
    sha256: "98ac999ce8b3550b3ced5ce7692cd90b3938675cf2a5126617999ea6fda1376c",
    sourceUrl:
      "https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png",
    width: 496,
  },
  {
    fileName: "firefox-add-ons-badge.png",
    height: 60,
    sha256: "5a0f222e5f9f0ef025f969c38bee064dd05206bde1ccaca978ae136bf441b74e",
    sourceUrl:
      "https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png",
    width: 172,
  },
] as const;

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stringsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readUnsigned32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

/**
 * Reads the dimensions and encoding mode from a PNG's mandatory IHDR chunk.
 *
 * @param bytes - Complete PNG bytes.
 * @returns Width, height, bit depth, and PNG color type.
 * @throws {Error} When the signature or IHDR chunk is missing.
 */
export function inspectPng(bytes: Uint8Array): PngInformation {
  if (bytes.length < PNG_SIGNATURE.length || !bytesEqual(bytes.slice(0, 8), PNG_SIGNATURE)) {
    throw new Error("PNG signature is missing or invalid");
  }
  if (
    bytes.length < PNG_HEADER_LENGTH ||
    new TextDecoder().decode(bytes.slice(12, 16)) !== "IHDR"
  ) {
    throw new Error("PNG IHDR chunk is missing or truncated");
  }
  return {
    width: readUnsigned32(bytes, 16),
    height: readUnsigned32(bytes, 20),
    bitDepth: bytes[24] ?? 0,
    colorType: bytes[25] ?? 0,
  };
}

function parseHexColor(value: string): RgbColor {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (match === null) throw new Error(`unsupported design-token color: ${value}`);
  return {
    red: Number.parseInt(match[1] ?? "", 16),
    green: Number.parseInt(match[2] ?? "", 16),
    blue: Number.parseInt(match[3] ?? "", 16),
  };
}

function tokenValue(css: string, token: string): string {
  const match = new RegExp(`--${token}:\\s*([^;]+);`).exec(css);
  if (match?.[1] === undefined) throw new Error(`design token --${token} is missing`);
  const value = match[1].trim();
  if (!value.startsWith("var(")) return value;
  const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1];
  if (reference === undefined) throw new Error(`unsupported design-token reference: ${value}`);
  return tokenValue(css, reference);
}

async function readPromoPalette(root: URL): Promise<PromoPalette> {
  const css = await Deno.readTextFile(new URL("src/shared/design/tokens.css", root));
  return {
    accent: parseHexColor(tokenValue(css, "accent")),
    background: parseHexColor(tokenValue(css, "bg-canvas")),
    border: parseHexColor(tokenValue(css, "border-strong")),
    evidence: parseHexColor(tokenValue(css, "text-secondary")),
    surface: parseHexColor(tokenValue(css, "bg-surface-raised")),
  };
}

function setPixel(image: PNG, x: number, y: number, color: RgbColor): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  image.data[offset] = color.red;
  image.data[offset + 1] = color.green;
  image.data[offset + 2] = color.blue;
  image.data[offset + 3] = 255;
}

function fillRectangle(
  image: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  color: RgbColor,
): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) setPixel(image, x, y, color);
  }
}

function strokeRectangle(
  image: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  thickness: number,
  color: RgbColor,
): void {
  fillRectangle(image, left, top, width, thickness, color);
  fillRectangle(image, left, top + height - thickness, width, thickness, color);
  fillRectangle(image, left, top, thickness, height, color);
  fillRectangle(image, left + width - thickness, top, thickness, height, color);
}

function drawCrosshair(
  image: PNG,
  centerX: number,
  centerY: number,
  radius: number,
  thickness: number,
  color: RgbColor,
): void {
  const corner = Math.round(radius * 0.55);
  const size = radius * 2;
  strokeRectangle(image, centerX - radius, centerY - radius, size, size, thickness, color);
  fillRectangle(
    image,
    centerX - thickness,
    centerY - radius - corner,
    thickness * 2,
    corner,
    color,
  );
  fillRectangle(image, centerX - thickness, centerY + radius, thickness * 2, corner, color);
  fillRectangle(
    image,
    centerX - radius - corner,
    centerY - thickness,
    corner,
    thickness * 2,
    color,
  );
  fillRectangle(image, centerX + radius, centerY - thickness, corner, thickness * 2, color);
}

function drawEvidenceCard(
  image: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  palette: PromoPalette,
): void {
  fillRectangle(image, left, top, width, height, palette.surface);
  strokeRectangle(image, left, top, width, height, 2, palette.border);
  const inset = Math.round(width * 0.1);
  const lineHeight = Math.max(3, Math.round(height * 0.035));
  const gap = Math.round(height * 0.12);
  for (let index = 0; index < 4; index += 1) {
    const lineWidth = index === 0 ? Math.round(width * 0.48) : Math.round(width * 0.72);
    fillRectangle(
      image,
      left + inset,
      top + gap + index * Math.round(height * 0.16),
      lineWidth,
      lineHeight,
      index === 0 ? palette.accent : palette.evidence,
    );
  }
}

function drawConnector(
  image: PNG,
  startX: number,
  endX: number,
  centerY: number,
  thickness: number,
  color: RgbColor,
): void {
  fillRectangle(image, startX, centerY - thickness, endX - startX, thickness * 2, color);
  const arrowSize = thickness * 5;
  for (let step = 0; step < arrowSize; step += 1) {
    fillRectangle(
      image,
      endX - arrowSize + step,
      centerY - step,
      1,
      step * 2 + 1,
      color,
    );
  }
}

function encodeRgbPng(image: PNG): Uint8Array {
  return PNG.sync.write(image, {
    colorType: 2,
    inputColorType: 6,
    inputHasAlpha: true,
  });
}

/**
 * Renders one text-free promotional tile from generated product design tokens.
 *
 * @param kind - Vendor tile size and composition to render.
 * @param root - Repository root used to read generated design tokens.
 * @returns Deterministic opaque 24-bit PNG bytes.
 */
export async function renderPromoTile(
  kind: PromoKind,
  root = new URL("../", import.meta.url),
): Promise<Uint8Array> {
  const specification = STORE_ARTWORK.find(({ promoKind }) => promoKind === kind);
  if (specification === undefined) throw new Error(`unknown promo kind: ${kind}`);
  const palette = await readPromoPalette(root);
  const image = new PNG({ height: specification.height, width: specification.width });
  fillRectangle(image, 0, 0, image.width, image.height, palette.background);

  if (kind === "small") {
    drawCrosshair(image, 126, 140, 54, 5, palette.accent);
    drawEvidenceCard(image, 228, 62, 160, 156, palette);
    drawConnector(image, 180, 228, 140, 3, palette.accent);
  } else {
    drawCrosshair(image, 280, 280, 104, 8, palette.accent);
    drawEvidenceCard(image, 820, 112, 360, 336, palette);
    drawConnector(image, 420, 820, 280, 5, palette.accent);
    drawEvidenceCard(image, 510, 196, 190, 168, palette);
  }
  return encodeRgbPng(image);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function pathInformation(url: URL): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(url);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

async function collectFiles(root: URL, paths: readonly string[]): Promise<readonly string[]> {
  const files: string[] = [];
  async function visit(path: string): Promise<void> {
    const url = new URL(path.endsWith("/") ? path : path, root);
    const information = await pathInformation(url);
    if (information === null) return;
    if (information.isFile) {
      files.push(path);
      return;
    }
    if (!information.isDirectory) return;
    const entries = [];
    for await (const entry of Deno.readDir(url)) entries.push(entry);
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      await visit(`${path.replace(/\/$/, "")}/${entry.name}${entry.isDirectory ? "/" : ""}`);
    }
  }
  for (const path of paths) await visit(path);
  return files.sort();
}

async function calculateSourceDigest(root: URL, sourcePaths: readonly string[]): Promise<string> {
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const path of sourcePaths) {
    parts.push(encoder.encode(`${path}\0`), await Deno.readFile(new URL(path, root)));
  }
  const length = parts.reduce((total, part) => total + part.length, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return await sha256(joined);
}

function expectedAssetPaths(): readonly string[] {
  return [
    ...STORE_ARTWORK.map(({ fileName }) => `${STORE_ASSET_DIRECTORY}/${fileName}`),
    ...STORE_BADGES.map(({ fileName }) => `${STORE_ASSET_DIRECTORY}/${fileName}`),
  ];
}

async function validateArtwork(root: URL): Promise<StoreAssetIssue[]> {
  const issues: StoreAssetIssue[] = [];
  for (const specification of STORE_ARTWORK) {
    const path = `${STORE_ASSET_DIRECTORY}/${specification.fileName}`;
    if (await pathInformation(new URL(path, root)) === null) {
      issues.push({ path, message: "is missing; run deno task store:assets" });
      continue;
    }
    try {
      const information = inspectPng(await Deno.readFile(new URL(path, root)));
      if (
        information.width !== specification.width || information.height !== specification.height
      ) {
        issues.push({
          path,
          message: `must be exactly ${specification.width}x${specification.height}`,
        });
      }
      if (information.bitDepth !== 8 || information.colorType !== 2) {
        issues.push({ path, message: "must be an opaque 24-bit RGB PNG with no alpha channel" });
      }
    } catch (error) {
      if (error instanceof Error) issues.push({ path, message: error.message });
      else throw error;
    }
  }
  return issues;
}

async function validateBadges(root: URL): Promise<StoreAssetIssue[]> {
  const issues: StoreAssetIssue[] = [];
  for (const specification of STORE_BADGES) {
    const path = `${STORE_ASSET_DIRECTORY}/${specification.fileName}`;
    if (await pathInformation(new URL(path, root)) === null) {
      issues.push({ path, message: "is missing; run deno task store:assets" });
      continue;
    }
    const bytes = await Deno.readFile(new URL(path, root));
    const information = inspectPng(bytes);
    if (information.width !== specification.width || information.height !== specification.height) {
      issues.push({ path, message: "does not retain the official vendor badge dimensions" });
    }
    if (await sha256(bytes) !== specification.sha256) {
      issues.push({ path, message: `does not match ${specification.sourceUrl}` });
    }
  }
  return issues;
}

async function validateManifest(root: URL): Promise<StoreAssetIssue[]> {
  if (await pathInformation(new URL(STORE_ASSET_MANIFEST, root)) === null) {
    return [{ path: STORE_ASSET_MANIFEST, message: "is missing; run deno task store:assets" }];
  }
  const manifest = JSON.parse(
    await Deno.readTextFile(new URL(STORE_ASSET_MANIFEST, root)),
  ) as StoreAssetManifest;
  const issues: StoreAssetIssue[] = [];
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.sourcePaths)) {
    return [{ path: STORE_ASSET_MANIFEST, message: "has an unsupported schema" }];
  }
  const currentSourcePaths = await collectFiles(root, SOURCE_ROOTS);
  if (!stringsEqual(currentSourcePaths, manifest.sourcePaths)) {
    issues.push({
      path: `${STORE_ASSET_MANIFEST}#sourcePaths`,
      message: "does not match the current source inventory; run deno task store:assets",
    });
  }
  if (await calculateSourceDigest(root, currentSourcePaths) !== manifest.sourceDigest) {
    issues.push({
      path: `${STORE_ASSET_MANIFEST}#sourceDigest`,
      message: "is stale; run deno task store:assets",
    });
  }
  const storeListingInformation = await pathInformation(new URL("store-listing.json", root));
  if (storeListingInformation !== null) {
    const listing = parseStoreListing(
      JSON.parse(await Deno.readTextFile(new URL("store-listing.json", root))),
    );
    if (manifest.currentVersionSummary !== listing.listing.currentVersionSummary) {
      issues.push({
        path: `${STORE_ASSET_MANIFEST}#currentVersionSummary`,
        message: "must record the reviewed current-version summary",
      });
    }
  }
  const recordedHashes = new Map(manifest.assets.map(({ fileName, sha256 }) => [fileName, sha256]));
  for (const path of expectedAssetPaths()) {
    if (await pathInformation(new URL(path, root)) === null) continue;
    const fileName = path.slice(`${STORE_ASSET_DIRECTORY}/`.length);
    if (recordedHashes.get(fileName) !== await sha256(await Deno.readFile(new URL(path, root)))) {
      issues.push({ path: `${STORE_ASSET_MANIFEST}#assets.${fileName}`, message: "is stale" });
    }
  }
  return issues;
}

/**
 * Validates committed listing artwork, official badges, and source-freshness metadata.
 *
 * @param root - Repository root containing the generated assets.
 * @returns Deterministically ordered actionable violations.
 */
export async function validateStoreAssets(
  root = new URL("../", import.meta.url),
): Promise<readonly StoreAssetIssue[]> {
  const [artworkIssues, badgeIssues, manifestIssues] = await Promise.all([
    validateArtwork(root),
    validateBadges(root),
    validateManifest(root),
  ]);
  return [...artworkIssues, ...badgeIssues, ...manifestIssues];
}

/**
 * Refreshes committed vendor badges from their digest-pinned official sources.
 *
 * @param root - Repository root receiving the refreshed badges.
 * @param fetcher - HTTP fetch implementation, injectable for deterministic tests.
 * @returns Nothing after every verified badge is written.
 * @throws {Error} When a download fails or upstream bytes do not match the pinned digest.
 */
export async function refreshStoreBadges(
  root: URL,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const downloads: { readonly bytes: Uint8Array; readonly fileName: string }[] = [];
  for (const specification of STORE_BADGES) {
    const response = await fetcher(specification.sourceUrl);
    if (!response.ok) {
      throw new Error(`badge download failed (${response.status}): ${specification.sourceUrl}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256(bytes) !== specification.sha256) {
      throw new Error(`official badge changed upstream: ${specification.sourceUrl}`);
    }
    downloads.push({ bytes, fileName: specification.fileName });
  }
  await Deno.mkdir(new URL(`${STORE_ASSET_DIRECTORY}/`, root), { recursive: true });
  for (const { bytes, fileName } of downloads) {
    await Deno.writeFile(
      new URL(`${STORE_ASSET_DIRECTORY}/${fileName}`, root),
      bytes,
    );
  }
}

async function writeManifest(root: URL, outputDirectory: URL): Promise<void> {
  const sourcePaths = await collectFiles(root, SOURCE_ROOTS);
  const listing = parseStoreListing(
    JSON.parse(await Deno.readTextFile(new URL("store-listing.json", root))),
  );
  const assets = [];
  for (const path of expectedAssetPaths()) {
    const fileName = path.slice(`${STORE_ASSET_DIRECTORY}/`.length);
    assets.push({
      fileName,
      sha256: await sha256(await Deno.readFile(new URL(fileName, outputDirectory))),
    });
  }
  const manifest: StoreAssetManifest = {
    schemaVersion: 1,
    currentVersionSummary: listing.listing.currentVersionSummary,
    sourceDigest: await calculateSourceDigest(root, sourcePaths),
    sourcePaths,
    assets,
  };
  await Deno.writeTextFile(
    new URL("manifest.json", outputDirectory),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function removeDirectoryIfPresent(directory: URL): Promise<void> {
  try {
    await Deno.remove(directory, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

/**
 * Captures current product scenes and generates vendor-facing artwork with pinned badges.
 *
 * @param root - Repository root receiving generated assets.
 * @param captureScreenshots - Screenshot capture implementation, injectable for failure testing.
 * @returns Nothing after all outputs and freshness metadata are written.
 * @throws {Error} When a fixture or capture fails, or a pinned badge is missing or modified.
 */
export async function generateStoreAssets(
  root = new URL("../", import.meta.url),
  captureScreenshots?: StoreScreenshotCapture,
): Promise<void> {
  const assetDirectory = new URL(`${STORE_ASSET_DIRECTORY}/`, root);
  await Deno.mkdir(assetDirectory, { recursive: true });
  const badgeIssues = await validateBadges(root);
  if (badgeIssues.length > 0) printIssues(badgeIssues);
  const stagingPath = await Deno.makeTempDir({
    dir: fromFileUrl(new URL("docs/assets/", root)),
    prefix: ".store-assets-",
  });
  const stagingDirectory = toFileUrl(`${stagingPath}/`);
  try {
    for (const specification of STORE_BADGES) {
      await Deno.copyFile(
        new URL(specification.fileName, assetDirectory),
        new URL(specification.fileName, stagingDirectory),
      );
    }
    const capture = captureScreenshots ??
      (await import("./store-screenshots.ts")).captureStoreScreenshots;
    await capture(root, stagingDirectory);
    for (const kind of ["small", "marquee"] as const) {
      await Deno.writeFile(
        new URL(kind === "small" ? "small-promo.png" : "marquee-promo.png", stagingDirectory),
        await renderPromoTile(kind, root),
      );
    }
    await writeManifest(root, stagingDirectory);
    for (const path of expectedAssetPaths()) {
      const fileName = path.slice(`${STORE_ASSET_DIRECTORY}/`.length);
      await Deno.rename(
        new URL(fileName, stagingDirectory),
        new URL(fileName, assetDirectory),
      );
    }
    await Deno.rename(
      new URL("manifest.json", stagingDirectory),
      new URL("manifest.json", assetDirectory),
    );
  } finally {
    await removeDirectoryIfPresent(stagingDirectory);
  }
}

function printIssues(issues: readonly StoreAssetIssue[]): never {
  throw new Error(
    `Invalid store assets:\n${
      issues.map(({ path, message }) => `- ${path}: ${message}`).join("\n")
    }`,
  );
}

if (import.meta.main) {
  const root = new URL("../", import.meta.url);
  const command = Deno.args[0] ?? "check";
  if (command === "generate") {
    await generateStoreAssets(root);
    console.log(
      `Generated store assets in ${
        relative(fromFileUrl(root), fromFileUrl(new URL(`${STORE_ASSET_DIRECTORY}/`, root)))
      }`,
    );
  } else if (command === "refresh-badges") {
    await refreshStoreBadges(root);
    console.log("Refreshed digest-pinned official store badges.");
  } else if (command === "check") {
    const issues = await validateStoreAssets(root);
    if (issues.length > 0) printIssues(issues);
    console.log("Store assets are current.");
  } else {
    throw new Error(`Unknown store asset command: ${command}`);
  }
}
