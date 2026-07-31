/// <reference lib="dom" />

/**
 * Ensures the component library removes all animation and transition durations for reduced motion.
 *
 * Named `.spec.ts` so the fast unit gate does not launch Chromium. Run through `deno task a11y`.
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { chromium } from "playwright";
import { startGalleryServer } from "../../src/ui/gallery/server.ts";

Deno.test("prefers-reduced-motion disables every shared component effect", async () => {
  const gallery = await startGalleryServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(gallery.url);
    await page.getByRole("heading", { name: "Point and Shoot component gallery" }).waitFor();

    const offenders = await page.evaluate(() => {
      const hasNonZeroDuration = (value: string): boolean =>
        value.split(",").some((duration) => Number.parseFloat(duration) > 0);
      return [...document.querySelectorAll(".gallery *")].flatMap((element) => {
        const style = getComputedStyle(element);
        const activeAnimation = style.animationName !== "none" &&
          hasNonZeroDuration(style.animationDuration);
        const activeTransition = hasNonZeroDuration(style.transitionDuration);
        return activeAnimation || activeTransition
          ? [{
            animationDuration: style.animationDuration,
            animationName: style.animationName,
            target: element.getAttribute("class") ?? element.tagName.toLowerCase(),
            transitionDuration: style.transitionDuration,
          }]
          : [];
      });
    });

    assertEquals(offenders, []);
  } finally {
    await browser.close();
    await gallery.close();
  }
});
