import assert from "node:assert/strict";
import test from "node:test";

test("Astro uses the Pages URL supplied by the build environment", async () => {
  const previousSiteUrl = process.env.SITE_URL;
  process.env.SITE_URL = "https://pages.example.test";
  try {
    const { default: config } = await import(`../astro.config.mjs?test=${Date.now()}`);
    assert.equal(config.site, "https://pages.example.test");
  } finally {
    if (previousSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = previousSiteUrl;
    }
  }
});

test("Astro uses localhost when a local build has no Pages URL", async () => {
  const previousSiteUrl = process.env.SITE_URL;
  delete process.env.SITE_URL;
  try {
    const { default: config } = await import(`../astro.config.mjs?fallback=${Date.now()}`);
    assert.equal(config.site, "http://localhost:4321");
  } finally {
    if (previousSiteUrl !== undefined) {
      process.env.SITE_URL = previousSiteUrl;
    }
  }
});
