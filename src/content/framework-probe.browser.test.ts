/// <reference lib="dom" />

import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import * as esbuild from "npm:esbuild@0.28.1";
import { chromium } from "playwright";
import { preactResolverPlugin } from "../../build/preact.ts";
import { startFixtureServer } from "../../tests/fixtures/app/server.ts";
import "loose-envify";
import "scheduler";

const ROOT = new URL("../../", import.meta.url);
const PROBE_HARNESS = new URL("tests/e2e/framework-probe-harness.ts", ROOT);
const FRAMEWORK_FIXTURE = new URL("tests/e2e/framework-dev-fixture.ts", ROOT);

interface FrameworkProbeHarness {
  probe(cssPath: readonly string[]): {
    readonly file?: string;
    readonly framework: string;
    readonly line?: number;
    readonly name: string;
  } | null;
}

async function bundleProbeHarness(): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      entryPoints: [fromFileUrl(PROBE_HARNESS)],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "preact",
      loader: { ".css": "text", ".svg": "text" },
      plugins: [preactResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("framework probe harness emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

const frameworkFixtureResolverPlugin: esbuild.Plugin = {
  name: "framework-fixture-resolver",
  setup(build) {
    build.onResolve(
      { filter: /^(loose-envify|react|react-dom\/client|scheduler|vue)$/ },
      (args) => ({ path: fromFileUrl(import.meta.resolve(args.path)) }),
    );
  },
};

async function bundleFrameworkFixture(mode: "development" | "production"): Promise<string> {
  try {
    const output = await esbuild.build({
      absWorkingDir: fromFileUrl(ROOT),
      bundle: true,
      define: {
        __VUE_OPTIONS_API__: "true",
        __VUE_PROD_DEVTOOLS__: "false",
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
        "process.env.NODE_ENV": JSON.stringify(mode),
      },
      entryPoints: [fromFileUrl(FRAMEWORK_FIXTURE)],
      format: "iife",
      plugins: [frameworkFixtureResolverPlugin],
      target: ["chrome116", "firefox109"],
      write: false,
    });
    const bundle = output.outputFiles?.[0];
    if (bundle === undefined) throw new Error("framework fixture emitted no JavaScript");
    return bundle.text;
  } finally {
    await esbuild.stop();
  }
}

Deno.test("framework probe identifies actual React 18.3.1 and Vue 3.5.40 dev builds", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleFrameworkFixture("development") });
    await page.locator("#actual-react-probe").waitFor();
    await page.locator("#actual-vue-probe").waitFor();
    await page.addScriptTag({ content: await bundleProbeHarness() });

    const hints = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootFrameworkProbeTest: FrameworkProbeHarness;
      }).pointShootFrameworkProbeTest;
      return {
        react: harness.probe(["#actual-react-probe"]),
        vue: harness.probe(["#actual-vue-probe"]),
      };
    });

    assertEquals(hints.react, {
      file: "/workspace/src/checkout/ReactCheckoutButton.tsx",
      framework: "react",
      line: 17,
      name: "ReactCheckoutButton",
    });
    assertEquals(hints.vue, {
      file: "/workspace/src/checkout/VueCheckoutButton.vue",
      framework: "vue",
      name: "VueCheckoutButton",
    });
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("framework probe returns no hint for a React production build", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${fixture.base}/light.html`);
    await page.addScriptTag({ content: await bundleFrameworkFixture("production") });
    await page.locator("#actual-react-probe").waitFor();
    await page.addScriptTag({ content: await bundleProbeHarness() });

    const hint = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootFrameworkProbeTest: FrameworkProbeHarness;
      }).pointShootFrameworkProbeTest;
      return harness.probe(["#actual-react-probe"]);
    });
    assertEquals(hint, null);
  } finally {
    await browser.close();
    await fixture.close();
  }
});

Deno.test("framework probe handles absent and hostile internals without console noise", async () => {
  const fixture = startFixtureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto(`${fixture.base}/light.html`);
    await page.evaluate(() => {
      const react = document.createElement("button");
      react.id = "react-probe";
      const ReactCheckoutButton = function ReactCheckoutButton(): void {};
      const owner = {
        _debugSource: {
          fileName: "/workspace/src/checkout/ReactCheckoutButton.tsx",
          lineNumber: 41,
        },
        elementType: ReactCheckoutButton,
        return: null,
      };
      Object.defineProperty(react, "__reactFiber$fixture", {
        value: {
          _debugSource: {
            fileName: "/workspace/src/checkout/ReactCheckoutButton.tsx",
            lineNumber: 42,
          },
          return: owner,
          type: "button",
        },
      });
      document.body.append(react);

      const vue = document.createElement("button");
      vue.id = "vue-probe";
      Object.defineProperty(vue, "__vueParentComponent", {
        value: {
          parent: null,
          type: {
            __file: "/workspace/src/checkout/VueCheckoutButton.vue",
            name: "VueCheckoutButton",
          },
        },
      });
      document.body.append(vue);

      const svelte = document.createElement("button");
      svelte.id = "svelte-probe";
      Object.defineProperty(svelte, "__svelte_meta", {
        value: {
          component: "SvelteCheckoutButton",
          loc: {
            file: "/workspace/src/checkout/SvelteCheckoutButton.svelte",
            line: 9,
          },
        },
      });
      document.body.append(svelte);

      const angular = document.createElement("button");
      angular.id = "angular-probe";
      Object.defineProperty(angular, "__ngContext__", { value: [] });
      document.body.append(angular);
      const AngularCheckoutButton = class AngularCheckoutButton {};
      (globalThis as unknown as Record<string, unknown>).ng = {
        getOwningComponent(element: Element) {
          return element === angular ? new AngularCheckoutButton() : null;
        },
      };

      const oversized = document.createElement("button");
      oversized.id = "oversized-probe";
      Object.defineProperty(oversized, "__reactFiber$oversized", {
        value: {
          _debugSource: {
            fileName: "f".repeat(2_000),
            lineNumber: 1,
          },
          elementType: { displayName: "n".repeat(2_000) },
          return: null,
        },
      });
      document.body.append(oversized);

      const hostile = document.createElement("button");
      hostile.id = "hostile-probe";
      Object.defineProperty(hostile, "__reactFiber$hostile", {
        get() {
          throw new Error("hostile getter");
        },
      });
      document.body.append(hostile);
    });
    await page.addScriptTag({ content: await bundleProbeHarness() });

    const hints = await page.evaluate(() => {
      const harness = (globalThis as unknown as {
        pointShootFrameworkProbeTest: FrameworkProbeHarness;
      }).pointShootFrameworkProbeTest;
      return {
        angular: harness.probe(["#angular-probe"]),
        hostile: harness.probe(["#hostile-probe"]),
        oversized: harness.probe(["#oversized-probe"]),
        plain: harness.probe(["main"]),
        react: harness.probe(["#react-probe"]),
        svelte: harness.probe(["#svelte-probe"]),
        vue: harness.probe(["#vue-probe"]),
      };
    });

    assertEquals(hints.react, {
      file: "/workspace/src/checkout/ReactCheckoutButton.tsx",
      framework: "react",
      line: 42,
      name: "ReactCheckoutButton",
    });
    assertEquals(hints.vue, {
      file: "/workspace/src/checkout/VueCheckoutButton.vue",
      framework: "vue",
      name: "VueCheckoutButton",
    });
    assertEquals(hints.svelte, {
      file: "/workspace/src/checkout/SvelteCheckoutButton.svelte",
      framework: "svelte",
      line: 9,
      name: "SvelteCheckoutButton",
    });
    assertEquals(hints.angular, {
      framework: "angular",
      name: "AngularCheckoutButton",
    });
    assertEquals(hints.oversized?.file?.length, 1_024);
    assertEquals(hints.oversized?.name.length, 1_024);
    assertEquals(hints.hostile, null);
    assertEquals(hints.plain, null);
    assertEquals(consoleErrors, []);
  } finally {
    await browser.close();
    await fixture.close();
  }
});
