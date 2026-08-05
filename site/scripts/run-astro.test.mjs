import { assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, resolve } from "@std/path";

const repositoryRoot = resolve(dirname(fromFileUrl(import.meta.url)), "../..");

Deno.test("Astro runner reports the Deno task interface for unsupported commands", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "site/scripts/run-astro.mjs", "unsupported"],
    cwd: repositoryRoot,
    stderr: "piped",
    stdout: "piped",
  }).output();

  assertEquals(output.code, 1);
  assertStringIncludes(
    new TextDecoder().decode(output.stderr),
    "Usage: deno task site:<build|check|dev>",
  );
});
