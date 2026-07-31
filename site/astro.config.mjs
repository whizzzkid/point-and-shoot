import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { rehypeTechnicalTitles } from "./src/markdown/rehype-technical-titles.mjs";
import { remarkDocsLinks } from "./src/markdown/remark-docs-links.mjs";
import { remarkStaticMermaid } from "./src/markdown/remark-static-mermaid.mjs";

export default defineConfig({
  site: "https://whizzzkid.github.io",
  base: "/point-and-shoot",
  output: "static",
  publicDir: ".generated/public",
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        rehypeTechnicalTitles,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            content: {
              type: "text",
              value: "#",
            },
            properties: {
              ariaLabel: "Link to this section",
              className: ["heading-anchor"],
            },
          },
        ],
      ],
      remarkPlugins: [remarkDocsLinks, remarkStaticMermaid],
    }),
    shikiConfig: {
      theme: "css-variables",
    },
  },
});
