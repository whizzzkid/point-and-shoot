import { assertEquals } from "@std/assert";

const PACKAGE_ROOT = new URL("./", import.meta.url);
const ENTRY_POINT = new URL("mod.ts", PACKAGE_ROOT);
const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*)["'](?<specifier>[^"']+)["']/g;
const FORBIDDEN_RUNTIME_REFERENCES = [
  "Deno.",
  "node:",
  "@a2a-js/sdk",
  "@grpc/grpc-js",
  "@bufbuild/protobuf",
  "chrome.",
  "browser.",
] as const;

Deno.test("portable client public graph remains inside the future package boundary", async () => {
  const pending = [ENTRY_POINT];
  const visited = new Set<string>();
  const forbidden: string[] = [];

  while (pending.length > 0) {
    const module = pending.pop();
    if (module === undefined || visited.has(module.href)) {
      continue;
    }
    visited.add(module.href);
    const source = await Deno.readTextFile(module);
    for (const reference of FORBIDDEN_RUNTIME_REFERENCES) {
      if (source.includes(reference)) {
        forbidden.push(`${module.pathname}:${reference}`);
      }
    }
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match.groups?.specifier;
      if (specifier === undefined) {
        continue;
      }
      if (!specifier.startsWith("./")) {
        forbidden.push(`${module.pathname}:${specifier}`);
        continue;
      }
      const dependency = new URL(specifier, module);
      if (!dependency.href.startsWith(PACKAGE_ROOT.href)) {
        forbidden.push(`${module.pathname}:${specifier}`);
        continue;
      }
      pending.push(dependency);
    }
  }

  assertEquals(forbidden, []);
  assertEquals(visited.has(new URL("generate-protocol.ts", PACKAGE_ROOT).href), false);
});
