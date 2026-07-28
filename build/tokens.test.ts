import { assertEquals } from "@std/assert";
import { FONT_SPECS } from "./vendor-assets.ts";

const TOKENS_CSS = new URL("../src/shared/design/tokens.css", import.meta.url);
const TOKENS_TS = new URL("../src/shared/design/tokens.ts", import.meta.url);

Deno.test("tokens - every font family is defined via @font-face, not merely referenced", async () => {
  const css = await Deno.readTextFile(TOKENS_CSS);
  const missing: string[] = [];
  for (const spec of FONT_SPECS) {
    for (const weight of spec.weights) {
      const rule = new RegExp(
        `@font-face\\s*\\{[^}]*font-family:\\s*["']${spec.family}["'];[^}]*font-weight:\\s*${weight};`,
      );
      if (!rule.test(css)) missing.push(`${spec.family} ${weight}`);
    }
  }
  assertEquals(missing, []);
});

Deno.test("tokens - tokens.css has no @import (remote font import stripped)", async () => {
  const css = await Deno.readTextFile(TOKENS_CSS);
  // `^(?!.*@import)` only rules out an `@import` on the first line, and a stripped import would sit
  // wherever the upstream stylesheet had it. A plain substring check has no such blind spot.
  assertEquals(css.includes("@import"), false);
});

Deno.test("tokens - every var() reference resolves to a defined token", async () => {
  const css = await Deno.readTextFile(TOKENS_CSS);
  const defined = new Set([...css.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));
  const referenced = [...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]);
  const dangling = referenced.filter((name) => !defined.has(name));
  assertEquals(dangling, []);
});

Deno.test("tokens - TokenName union matches every token defined in tokens.css", async () => {
  const css = await Deno.readTextFile(TOKENS_CSS);
  const definedCss = new Set([...css.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));
  const ts = await Deno.readTextFile(TOKENS_TS);
  const definedTs = new Set([...ts.matchAll(/\| "([a-z0-9-]+)"/g)].map((m) => m[1]));
  assertEquals(definedTs, definedCss);
});

Deno.test("tokens:check - fails after a hand-edit to a generated file, passes when reverted", async () => {
  const original = await Deno.readTextFile(TOKENS_CSS);
  try {
    await Deno.writeTextFile(TOKENS_CSS, `${original}\n:root{--drift:1px}\n`);
    const drifted = await new Deno.Command("deno", {
      args: ["run", "-A", "build/tokens.ts", "--check"],
      cwd: new URL("..", import.meta.url).pathname,
    }).output();
    assertEquals(drifted.success, false);
  } finally {
    await Deno.writeTextFile(TOKENS_CSS, original);
  }

  const clean = await new Deno.Command("deno", {
    args: ["run", "-A", "build/tokens.ts", "--check"],
    cwd: new URL("..", import.meta.url).pathname,
  }).output();
  assertEquals(clean.success, true);
});
