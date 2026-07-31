import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { PUBLISHED_DOCS_PATTERN } from "./lib/docs-manifest";

const docs = defineCollection({
  loader: glob({
    base: "../docs",
    pattern: PUBLISHED_DOCS_PATTERN,
  }),
});

export const collections = { docs };
