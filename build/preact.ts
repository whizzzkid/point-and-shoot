/**
 * Shared esbuild integration for resolving Deno-pinned Preact imports without `node_modules`.
 *
 * @module
 */

import { fromFileUrl } from "@std/path";
import type * as esbuild from "npm:esbuild@0.28.1";

/**
 * Resolves Preact and its JSX-runtime subpaths through Deno's import map and npm cache.
 *
 * esbuild's standalone npm process cannot resolve the bare specifiers on its own because this
 * project deliberately has no `node_modules` directory.
 */
export const preactResolverPlugin: esbuild.Plugin = {
  name: "deno-preact-resolver",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^preact(\/.*)?$/ }, (args) => ({
      path: fromFileUrl(import.meta.resolve(args.path)),
    }));
  },
};
