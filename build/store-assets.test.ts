import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import {
  inspectPng,
  refreshStoreBadges,
  renderPromoTile,
  STORE_ARTWORK,
  validateStoreAssets,
} from "./store-assets.ts";

Deno.test("store assets - artwork contract has five screenshots followed by two promo tiles", () => {
  assertEquals(
    STORE_ARTWORK.map(({ fileName, height, width }) => ({ fileName, height, width })),
    [
      { fileName: "01-capture-toolbar.png", height: 800, width: 1_280 },
      { fileName: "02-notes-review.png", height: 800, width: 1_280 },
      { fileName: "03-note-hover-highlight.png", height: 800, width: 1_280 },
      { fileName: "04-compiled-plan.png", height: 800, width: 1_280 },
      { fileName: "05-privacy-settings.png", height: 800, width: 1_280 },
      { fileName: "small-promo.png", height: 280, width: 440 },
      { fileName: "marquee-promo.png", height: 560, width: 1_400 },
    ],
  );
});

Deno.test("store assets - promo renderers emit deterministic opaque RGB PNGs", async () => {
  for (const kind of ["small", "marquee"] as const) {
    const first = await renderPromoTile(kind);
    const second = await renderPromoTile(kind);
    assertEquals(first, second);

    const specification = STORE_ARTWORK.find(({ promoKind }) => promoKind === kind);
    if (specification === undefined) throw new Error(`missing ${kind} promo specification`);
    assertEquals(inspectPng(first), {
      bitDepth: 8,
      colorType: 2,
      height: specification.height,
      width: specification.width,
    });
  }
});

Deno.test("store assets - PNG inspection rejects malformed and truncated inputs", () => {
  assertThrows(() => inspectPng(new Uint8Array()), Error, "PNG signature");
  assertThrows(
    () => inspectPng(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    Error,
    "IHDR",
  );
});

Deno.test("store assets - explicit badge refresh rejects changed upstream bytes", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  const changedUpstream: typeof fetch = () =>
    Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
  try {
    await assertRejects(
      () => refreshStoreBadges(root, changedUpstream),
      Error,
      "official badge changed upstream",
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});

Deno.test("store assets - validation reports every missing generated asset and manifest", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  try {
    const issues = await validateStoreAssets(new URL("./", toFileUrl(`${temporaryDirectory}/`)));
    assertEquals(issues.map(({ path }) => path), [
      ...STORE_ARTWORK.map(({ fileName }) => `docs/assets/store/${fileName}`),
      "docs/assets/store/chrome-web-store-badge.png",
      "docs/assets/store/firefox-add-ons-badge.png",
      "docs/assets/store/manifest.json",
    ]);
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});

Deno.test("store assets - validation rejects a stale source fingerprint", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  try {
    await Deno.mkdir(new URL("docs/assets/store/", root), { recursive: true });
    await Deno.writeTextFile(new URL("source.txt", root), "current source\n");
    await Deno.writeTextFile(
      new URL("docs/assets/store/manifest.json", root),
      `${
        JSON.stringify({
          schemaVersion: 1,
          sourceDigest: "stale",
          sourcePaths: ["source.txt"],
          assets: [],
        })
      }\n`,
    );

    const issues = await validateStoreAssets(root);
    assertEquals(
      issues.some(({ path }) => path === "docs/assets/store/manifest.json#sourceDigest"),
      true,
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});

Deno.test("store assets - validation rejects source files absent from recorded inventory", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  try {
    await Deno.mkdir(new URL("docs/assets/store/", root), { recursive: true });
    await Deno.mkdir(new URL("src/", root), { recursive: true });
    await Deno.writeTextFile(new URL("src/new-visible-surface.ts", root), "export {};\n");
    await Deno.writeTextFile(
      new URL("docs/assets/store/manifest.json", root),
      `${
        JSON.stringify({
          schemaVersion: 1,
          currentVersionSummary: "unchanged",
          sourceDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          sourcePaths: [],
          assets: [],
        })
      }\n`,
    );

    const issues = await validateStoreAssets(root);
    assertEquals(
      issues.some(({ path }) => path === "docs/assets/store/manifest.json#sourcePaths"),
      true,
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});

Deno.test("store assets - validation surfaces unreadable manifest JSON", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  try {
    await Deno.mkdir(new URL("docs/assets/store/", root), { recursive: true });
    await Deno.writeTextFile(new URL("docs/assets/store/manifest.json", root), "not json\n");
    await assertRejects(
      () => validateStoreAssets(root),
      SyntaxError,
    );
  } finally {
    await Deno.remove(temporaryDirectory, { recursive: true });
  }
});
