import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({
    base: "../docs",
    pattern: "{README.md,design.md,specs/**/*.md,tutorials/**/*.md}",
  }),
});

export const collections = { docs };
