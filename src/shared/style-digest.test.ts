/**
 * Tests for the computed-style digest engine, run against real DOM in a real Chromium via
 * Playwright — same reason and same serialization approach as `selectors.test.ts`: Deno's runtime
 * has no DOM, so {@link buildStyleDigest} is shipped as plain TypeScript, imported here, and driven
 * inside the page via `page.evaluate`, which serializes it by source text.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { chromium, type Page } from "playwright";
import {
  buildStyleDigest,
  MAX_SIBLINGS,
  MAX_STYLE_PROPERTIES,
  SIBLINGS_PER_SIDE,
  type StyleDigestBundle,
} from "./style-digest.ts";

/** Counts the leaf properties across a digest's `self` element — box + typography + color fields. */
function countStyleProperties(bundle: StyleDigestBundle): number {
  return Object.keys(bundle.self.box).length +
    Object.keys(bundle.self.typography).length +
    Object.keys(bundle.self.color).length;
}

/** Builds a digest for the element matching `selector`, run inside the page. */
function digestFor(page: Page, selector: string): Promise<StyleDigestBundle> {
  return page.evaluate(
    ({ selector, buildSrc }) => {
      // deno-lint-ignore no-explicit-any
      const build = new Function(`return (${buildSrc})`)() as (el: unknown) => any;
      const el = document.querySelector(selector);
      if (el === null) throw new Error(`fixture selector not found: ${selector}`);
      return build(el);
    },
    { selector, buildSrc: buildStyleDigest.toString() },
  );
}

Deno.test("style digest engine", async (t) => {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    await t.step("box model, typography, and color — normalized and stable", async () => {
      await page.setContent(`
        <style>
          #target {
            width: 200px; height: 40px;
            padding: 4px 8px; margin: 12px 0;
            border: 2px solid rgb(107, 114, 128);
            font-family: Arial; font-size: 16px; font-weight: 700;
            line-height: 1.5; letter-spacing: 0.5px;
            color: rgb(17, 24, 39); background-color: rgba(255, 0, 0, 0.5);
          }
        </style>
        <div id="target">Hi</div>
      `);

      const bundle = await digestFor(page, "#target");

      assertEquals(bundle.self.box, {
        width: 200,
        height: 40,
        paddingTop: 4,
        paddingRight: 8,
        paddingBottom: 4,
        paddingLeft: 8,
        marginTop: 12,
        marginRight: 0,
        marginBottom: 12,
        marginLeft: 0,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
      });
      assertEquals(bundle.self.typography.fontSize, 16);
      assertEquals(bundle.self.typography.fontWeight, "700");
      assertEquals(bundle.self.color.color, "#111827");
      assertEquals(bundle.self.color.borderTopColor, "#6b7280");
      assertEquals(bundle.self.color.backgroundColor, "#ff000080");
    });

    await t.step("parent — null only when there is none", async () => {
      await page.setContent(`<div id="parent"><span id="child">Hi</span></div>`);
      const bundle = await digestFor(page, "#child");
      assert(bundle.parent !== null, "expected a parent digest");

      const rootBundle = await digestFor(page, "html");
      assertEquals(rootBundle.parent, null);
    });

    await t.step("siblings — nearest-first on each side, gap measured in DOM order", async () => {
      await page.setContent(`
        <style>#list div { height: 20px; margin-bottom: 10px; }</style>
        <div id="list">
          <div id="a">a</div>
          <div id="b">b</div>
          <div id="target">target</div>
          <div id="c">c</div>
          <div id="d">d</div>
        </div>
      `);

      const bundle = await digestFor(page, "#target");
      const preceding = bundle.siblings.filter((s) => s.direction === "preceding");
      const following = bundle.siblings.filter((s) => s.direction === "following");

      assertEquals(preceding.length, 2);
      assertEquals(following.length, 2);
      assertEquals(preceding.map((s) => s.distance), [1, 2]);
      assertEquals(following.map((s) => s.distance), [1, 2]);
      // #b is the nearest preceding sibling — 10px margin-bottom is the only gap.
      assert(preceding[0] !== undefined && following[0] !== undefined);
      assertEquals(preceding[0].gapPx, 10);
      assertEquals(following[0].gapPx, 10);
    });

    await t.step("sibling cap holds against a pathologically wide sibling list", async () => {
      const items = Array.from({ length: 20 }, (_, i) => `<div>item-${i}</div>`).join("");
      await page.setContent(`<div id="list">${items}<div id="target">target</div>${items}</div>`);

      const bundle = await digestFor(page, "#target");
      assertEquals(bundle.siblings.length, MAX_SIBLINGS);
      assertEquals(
        bundle.siblings.filter((s) => s.direction === "preceding").length,
        SIBLINGS_PER_SIDE,
      );
      assertEquals(
        bundle.siblings.filter((s) => s.direction === "following").length,
        SIBLINGS_PER_SIDE,
      );
    });

    await t.step("property count stays under the settled cap", async () => {
      await page.setContent(`<div id="target">Hi</div>`);
      const bundle = await digestFor(page, "#target");
      assert(
        countStyleProperties(bundle) <= MAX_STYLE_PROPERTIES,
        `expected at most ${MAX_STYLE_PROPERTIES} properties, got ${countStyleProperties(bundle)}`,
      );
    });

    await t.step("no siblings — empty array, not a crash", async () => {
      await page.setContent(`<div id="lonely">alone</div>`);
      const bundle = await digestFor(page, "#lonely");
      assertEquals(bundle.siblings, []);
    });
  } finally {
    await browser.close();
  }
});
