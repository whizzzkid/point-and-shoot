/// <reference lib="dom" />

import { probeFrameworkComponents } from "../../src/content/framework-probe.ts";
import { MAX_COMPONENT_HINT_TEXT_LENGTH } from "../../src/shared/schema.ts";

const harness = {
  probe(cssPath: readonly string[]) {
    return probeFrameworkComponents([cssPath], MAX_COMPONENT_HINT_TEXT_LENGTH)[0] ?? null;
  },
};

(globalThis as unknown as { pointShootFrameworkProbeTest: typeof harness })
  .pointShootFrameworkProbeTest = harness;
