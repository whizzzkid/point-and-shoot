import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { toFileUrl } from "@std/path";
import {
  generateStoreAssets,
  inspectPng,
  refreshStoreBadges,
  renderPromoTile,
  STORE_ARTWORK,
  validateStoreAssets,
} from "./store-assets.ts";
import { parseStoreListing } from "./store-listing.ts";
import { storeScreenshotSession } from "./store-screenshots.ts";
import { EXPORT_FIXTURE_SESSION } from "../src/shared/serialize/fixture.ts";

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

Deno.test("store assets - canonical listing names every generated artwork file", async () => {
  const listing = parseStoreListing(
    JSON.parse(await Deno.readTextFile(new URL("../store-listing.json", import.meta.url))),
  );
  assertEquals(
    [
      ...listing.artwork.screenshots.map(({ fileName }) => fileName),
      listing.artwork.smallPromoFileName,
      listing.artwork.marqueePromoFileName,
    ],
    STORE_ARTWORK.map(({ fileName }) => fileName),
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

Deno.test("store assets - PNG inspection rejects malformed and truncated inputs", async () => {
  assertThrows(() => inspectPng(new Uint8Array()), Error, "PNG signature");
  assertThrows(
    () => inspectPng(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    Error,
    "IHDR",
  );
  const completePng = await Deno.readFile(
    new URL("../docs/assets/store/01-capture-toolbar.png", import.meta.url),
  );
  assertThrows(
    () => inspectPng(completePng.slice(0, 29)),
    Error,
    "invalid or truncated",
  );
});

Deno.test("store assets - screenshot fixture removes credential-shaped queries", () => {
  const sanitized = storeScreenshotSession(EXPORT_FIXTURE_SESSION);
  assertEquals(sanitized.notes.map(({ pageUrl }) => pageUrl), [
    "https://example.com/checkout",
    "https://example.com/checkout/summary",
  ]);
  assertEquals(
    /(?:access[_-]?token|api[_-]?key|password|secret)=/i.test(JSON.stringify(sanitized)),
    false,
  );
  assertEquals(EXPORT_FIXTURE_SESSION.notes[0]?.pageUrl.includes("access_token=secret"), true);
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

Deno.test("store assets - capture failure leaves committed outputs unchanged", async () => {
  const temporaryDirectory = await Deno.makeTempDir();
  const root = new URL("./", toFileUrl(`${temporaryDirectory}/`));
  const assetDirectory = new URL("docs/assets/store/", root);
  try {
    await Deno.mkdir(assetDirectory, { recursive: true });
    for (const fileName of ["chrome-web-store-badge.png", "firefox-add-ons-badge.png"]) {
      await Deno.copyFile(
        new URL(`../docs/assets/store/${fileName}`, import.meta.url),
        new URL(fileName, assetDirectory),
      );
    }
    await Deno.writeTextFile(new URL("small-promo.png", assetDirectory), "original\n");

    await assertRejects(
      () =>
        generateStoreAssets(root, () => {
          throw new Error("capture failed");
        }),
      Error,
      "capture failed",
    );
    assertEquals(
      await Deno.readTextFile(new URL("small-promo.png", assetDirectory)),
      "original\n",
    );
    const assetParentEntries = [];
    for await (const entry of Deno.readDir(new URL("docs/assets/", root))) {
      assetParentEntries.push(entry.name);
    }
    assertEquals(assetParentEntries.sort(), ["store"]);
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
