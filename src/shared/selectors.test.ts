/**
 * Tests for the selector bundle engine, run against real DOM in a real Chromium via Playwright.
 *
 * Deno's own runtime has no DOM — {@link buildSelectorBundle} and its resolve helpers are shipped as
 * plain TypeScript, imported here, and driven inside the browser via `elementHandle.evaluate` and
 * `page.evaluate`, which serialize the imported function by source text (`Function.prototype
 * .toString()`, confirmed to strip Deno's type annotations cleanly) and re-parse it as real JS inside
 * the page. That is the whole reason every helper in `selectors.ts` is nested inside its exported
 * functions rather than shared at module scope: a reference to a module-level helper would resolve to
 * nothing once the source text is re-parsed with no surrounding module.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";
import { chromium, type ElementHandle, type Page } from "playwright";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";
import {
  buildSelectorBundle,
  type ReachableSelectorBundle,
  resolveCssPath,
  resolveXPath,
  type SelectorBundle,
} from "./selectors.ts";

/** Builds a selector bundle for the live element `handle` wraps, running inside the page. */
function buildBundleFor(handle: ElementHandle): Promise<SelectorBundle> {
  return handle.evaluate((el, buildSrc) => {
    // deno-lint-ignore no-explicit-any
    const build = new Function(`return (${buildSrc})`)() as (el: unknown) => any;
    return build(el);
  }, buildSelectorBundle.toString());
}

/**
 * Confirms `bundle.cssPath` and `bundle.xpath` both resolve back to the exact element `handle`
 * wraps, using the exported resolve helpers rather than trusting {@link buildSelectorBundle}'s own
 * internal check — this is the test suite's own round-trip assertion, run for every fixture case.
 *
 * `native` additionally evaluates the emitted xpath *as XPath*, via `document.evaluate`, whenever the
 * path crosses no shadow boundary. The resolve helpers deliberately go through each segment's CSS
 * translation (`document.evaluate` rejects a `ShadowRoot` context node), so on their own they cannot
 * tell a working xpath from one that is unresolvable in the language it is written in — a `/button`
 * that means "button as a child of the document node" translates to a CSS selector that matches
 * fine and an xpath that matches nothing. `null` for a shadow-crossing path, which has no native
 * equivalent to check.
 */
async function assertRoundTrips(
  handle: ElementHandle,
  bundle: ReachableSelectorBundle,
): Promise<void> {
  const matches = await handle.evaluate(
    (el, { cssPath, xpath, cssSrc, xpathSrc }) => {
      // deno-lint-ignore no-explicit-any
      const resolveCss = new Function(`return (${cssSrc})`)() as (p: readonly string[]) => any;
      // deno-lint-ignore no-explicit-any
      const resolveXpath = new Function(`return (${xpathSrc})`)() as (p: readonly string[]) => any;
      const soleSegment = xpath.length === 1 ? xpath[0] : undefined;
      const doc = el.ownerDocument;
      const native = soleSegment === undefined || doc === null ? null : doc.evaluate(
        soleSegment,
        doc,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue === el;
      return { css: resolveCss(cssPath) === el, xpath: resolveXpath(xpath) === el, native };
    },
    {
      cssPath: bundle.cssPath,
      xpath: bundle.xpath,
      cssSrc: resolveCssPath.toString(),
      xpathSrc: resolveXPath.toString(),
    },
  );
  const expectNative = bundle.xpath.length === 1 ? true : null;
  assertEquals(matches, { css: true, xpath: true, native: expectNative });
}

function assertReachable(bundle: SelectorBundle): asserts bundle is ReachableSelectorBundle {
  assert(bundle.reachable, `expected a reachable bundle, got ${JSON.stringify(bundle)}`);
}

Deno.test("selector bundle engine", async (t) => {
  const browser = await chromium.launch();
  const fixture = startFixtureServer();

  try {
    const page = await browser.newPage();

    await t.step("index.html fixtures", async (t) => {
      await page.goto(`${fixture.base}/index.html`, { waitUntil: "load" });

      await t.step("test-id case — emits the data-testid signal and round-trips", async () => {
        const handle = await requireHandle(page, "#with-test-ids button:first-of-type");
        const bundle = await buildBundleFor(handle);
        assertReachable(bundle);
        assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "save-note" }]);
        assertEquals(bundle.textSnippet, "Save note");
        await assertRoundTrips(handle, bundle);
      });

      await t.step(
        "no-id case — no test id, still round-trips on structural path alone",
        async () => {
          const handle = await requireHandle(page, "#without-identity span");
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, []);
          assertEquals(bundle.textSnippet, "Untagged label");
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "ambiguous-class case — four identical class lists, still resolves the one element",
        async () => {
          const handle = await requireHandle(
            page,
            "#ambiguous-classes .card:nth-of-type(3)",
          );
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.textSnippet, "Third card");
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "sibling-index-only case — identical tag, class and text; position is the only signal",
        async () => {
          const handle = await requireHandle(page, "#sibling-index-only li:nth-of-type(4)");
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          await assertRoundTrips(handle, bundle);

          // The engine's own uniqueness check is what proves this — a differently-indexed sibling
          // must NOT resolve to the same path.
          const otherHandle = await requireHandle(page, "#sibling-index-only li:nth-of-type(2)");
          const otherBundle = await buildBundleFor(otherHandle);
          assertReachable(otherBundle);
          assert(
            bundle.cssPath.join(" > ") !== otherBundle.cssPath.join(" > "),
            "two different list items produced the same cssPath",
          );
        },
      );

      await t.step("deeply nested button — aria-label wins as the accessible name", async () => {
        const handle = await requireHandle(page, "#deep-nesting button");
        const bundle = await buildBundleFor(handle);
        assertReachable(bundle);
        assertEquals(bundle.ariaRoleName, { role: "button", name: "Deeply nested action" });
        assertEquals(bundle.textSnippet, "Nested nine levels down");
        await assertRoundTrips(handle, bundle);
      });

      await t.step(
        "role plus accessible-name identity, no id/test-id/distinguishing class",
        async () => {
          const handle = await requireHandle(page, '[role="switch"]');
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, []);
          assertEquals(bundle.ariaRoleName, { role: "switch", name: "Force dark theme" });
          await assertRoundTrips(handle, bundle);
        },
      );
    });

    await t.step("shadow.html fixtures", async (t) => {
      await page.goto(`${fixture.base}/shadow.html`, { waitUntil: "load" });

      await t.step(
        "open shadow root — path records the boundary, round-trips across it",
        async () => {
          // Playwright's own selector engine pierces open shadow roots to fetch the handle; the
          // point under test is that our own `cssPath`/`xpath` do too, via `resolveCssPath`/
          // `resolveXPath`, which use plain `querySelector` and do not get that piercing for free.
          const handle = await requireHandle(page, '[data-testid="open-shadow-button"]');
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "open-shadow-button" }]);
          assert(bundle.cssPath.length >= 2, "expected a shadow-boundary-crossing cssPath");
          assert(bundle.xpath.length >= 2, "expected a shadow-boundary-crossing xpath");
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "closed shadow host — only the host is capturable, and it's ordinary",
        async () => {
          const handle = await requireHandle(page, "#closed-host");
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, [
            { attribute: "data-testid", value: "closed-shadow-host" },
            { attribute: "id", value: "closed-host" },
          ]);
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "closed shadow interior — flagged unreachable rather than a wrong selector",
        async () => {
          // No public API can hand back a reference to a closed shadow root's interior from
          // outside — by design. This constructs one from inside the same evaluate call (the only
          // place such a reference can exist) to exercise the defensive check directly.
          const bundle = await page.evaluate((buildSrc) => {
            // deno-lint-ignore no-explicit-any
            const build = new Function(`return (${buildSrc})`)() as (el: unknown) => any;
            const host = document.createElement("div");
            document.body.appendChild(host);
            const root = host.attachShadow({ mode: "closed" });
            root.innerHTML = '<button data-testid="synthetic-closed-button">Hi</button>';
            return build(root.querySelector("button"));
          }, buildSelectorBundle.toString());

          assertEquals(bundle.reachable, false);
          assertEquals((bundle as { unreachable: string }).unreachable, "closed-shadow-root");
          assertEquals(bundle.testIds, [
            { attribute: "data-testid", value: "synthetic-closed-button" },
          ]);
        },
      );
    });

    await t.step("iframe.html fixtures", async (t) => {
      await page.goto(`${fixture.base}/iframe.html`, { waitUntil: "load" });
      // The cross-origin frame's document settles a tick after load (same timing as tests/shots.ts).
      await page.waitForTimeout(250);

      await t.step(
        "same-origin iframe — parent can reach contentDocument, so it's ordinary",
        async () => {
          const handle = await requireHandle(page, '[data-testid="same-origin-frame"]');
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "same-origin-frame" }]);
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "same-origin iframe interior — element in a nested realm still round-trips",
        async () => {
          // The interior element's root node is built from the frame's own constructors, so a
          // realm-scoped `root instanceof Document` reports false for a node that *is* in a
          // document. Everything downstream of that test then takes the shadow-root branch. This
          // asserts the path from inside the frame, which the parent-side iframe case above cannot
          // reach.
          const frame = page.frames().find((f) => f.url().endsWith("/frame-content.html"));
          assert(frame !== undefined, "expected the same-origin frame to be attached");
          const handle = await frame.waitForSelector('[data-testid="frame-button"]');
          const bundle = await buildBundleFor(handle);
          assertReachable(bundle);
          assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "frame-button" }]);
          await assertRoundTrips(handle, bundle);
        },
      );

      await t.step(
        "frame interior reached from the parent realm — foreign-document, not a crash",
        async () => {
          // Same element as the step above, but the bundle is built in the *parent's* realm, so the
          // element's root document comes from another realm's constructors. `root instanceof
          // Document` is false there for a node that is in a document, which sends the walk down the
          // shadow-root branch and dereferences an undefined `host`. No path from this realm can
          // reach the element, so the honest answer is `unreachable`.
          const handle = await page.evaluateHandle(() => {
            const frame = document.querySelector<HTMLIFrameElement>(
              '[data-testid="same-origin-frame"]',
            );
            return frame?.contentDocument?.querySelector('[data-testid="frame-button"]') ?? null;
          });
          const element = handle.asElement();
          assert(element !== null, "expected to reach the frame's button from the parent realm");
          const bundle = await buildBundleFor(element);
          assertEquals(bundle.reachable, false);
          assertEquals((bundle as { unreachable: string }).unreachable, "foreign-document");
          assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "frame-button" }]);
        },
      );

      await t.step(
        "cross-origin iframe — unreachable from the parent's content script",
        async () => {
          const handle = await requireHandle(page, '[data-testid="cross-origin-frame"]');
          const bundle = await buildBundleFor(handle);
          assertEquals(bundle.reachable, false);
          assertEquals((bundle as { unreachable: string }).unreachable, "cross-origin-iframe");
          assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "cross-origin-frame" }]);
        },
      );
    });

    await t.step("sad paths", async (t) => {
      await page.goto(`${fixture.base}/index.html`, { waitUntil: "load" });

      await t.step("<html> itself — the shallowest possible target", async () => {
        const handle = await requireHandle(page, "html");
        const bundle = await buildBundleFor(handle);
        assertReachable(bundle);
        assertEquals(bundle.cssPath, ["html"]);
        assertEquals(bundle.xpath, ["/html"]);
        await assertRoundTrips(handle, bundle);
      });

      await t.step("detached element — never attached to any document", async () => {
        const bundle = await page.evaluate((buildSrc) => {
          // deno-lint-ignore no-explicit-any
          const build = new Function(`return (${buildSrc})`)() as (el: unknown) => any;
          const el = document.createElement("button");
          el.setAttribute("data-testid", "detached-button");
          el.textContent = "Detached";
          return build(el);
        }, buildSelectorBundle.toString());

        assertEquals(bundle.reachable, false);
        assertEquals((bundle as { unreachable: string }).unreachable, "detached");
        assertEquals(bundle.testIds, [{ attribute: "data-testid", value: "detached-button" }]);
      });

      await t.step("text node passed in by mistake", async () => {
        const bundle = await page.evaluate((buildSrc) => {
          // deno-lint-ignore no-explicit-any
          const build = new Function(`return (${buildSrc})`)() as (el: unknown) => any;
          const textNode = document.createTextNode("oops");
          document.body.appendChild(textNode);
          return build(textNode);
        }, buildSelectorBundle.toString());

        assertEquals(bundle.reachable, false);
        assertEquals((bundle as { unreachable: string }).unreachable, "not-an-element");
        assertEquals(bundle.testIds, []);
      });
    });
  } finally {
    await browser.close();
    await fixture.close();
  }
});

/** Fetches an element handle, failing fast with the selector in the message when it's missing. */
async function requireHandle(page: Page, selector: string): Promise<ElementHandle> {
  const handle = await page.$(selector);
  if (handle === null) throw new Error(`fixture selector not found: ${selector}`);
  return handle;
}
