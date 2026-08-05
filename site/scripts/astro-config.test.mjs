import { assertEquals } from "@std/assert";

Deno.test("Astro uses the Pages URL supplied by the build environment", async () => {
  const previousSiteUrl = Deno.env.get("SITE_URL");
  Deno.env.set("SITE_URL", "https://pages.example.test");
  try {
    const { default: config } = await import(`../astro.config.mjs?test=${Date.now()}`);
    assertEquals(config.site, "https://pages.example.test");
  } finally {
    if (previousSiteUrl === undefined) {
      Deno.env.delete("SITE_URL");
    } else {
      Deno.env.set("SITE_URL", previousSiteUrl);
    }
  }
});

Deno.test("Astro uses localhost when a local build has no Pages URL", async () => {
  const previousSiteUrl = Deno.env.get("SITE_URL");
  Deno.env.delete("SITE_URL");
  try {
    const { default: config } = await import(`../astro.config.mjs?fallback=${Date.now()}`);
    assertEquals(config.site, "http://localhost:4321");
  } finally {
    if (previousSiteUrl !== undefined) {
      Deno.env.set("SITE_URL", previousSiteUrl);
    }
  }
});
