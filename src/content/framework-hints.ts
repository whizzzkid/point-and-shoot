import { FRAMEWORK_PROBE_MESSAGE, isFrameworkProbeResponse } from "../shared/messages.ts";
import type { PickerSelection } from "./picker/ElementPicker.tsx";

/** Runtime message capability used by component-hint enrichment. */
export interface FrameworkProbeRuntime {
  sendMessage(message: unknown): Promise<unknown>;
}

/**
 * Adds aligned page-world component hints without making capture depend on the fragile probe.
 *
 * @param runtime Content-to-background message channel.
 * @param selection Live picker selection to enrich.
 * @param enabled Whether the user explicitly enabled framework internals probing.
 * @returns The original selection on opt-out or any failure, else an enriched immutable copy.
 */
export async function addFrameworkComponentHints(
  runtime: FrameworkProbeRuntime,
  selection: PickerSelection,
  enabled: boolean,
): Promise<PickerSelection> {
  if (!enabled || selection.kind !== "elements") return selection;
  const cssPaths = selection.elements
    .filter((capture) => capture.selectors.reachable)
    .map((capture) => capture.selectors.reachable ? capture.selectors.cssPath : []);
  if (cssPaths.length === 0) return selection;

  let response: unknown;
  try {
    response = await runtime.sendMessage({
      cssPaths,
      type: FRAMEWORK_PROBE_MESSAGE,
    });
  } catch {
    return selection;
  }
  if (!isFrameworkProbeResponse(response, cssPaths.length)) return selection;

  let hintIndex = 0;
  return {
    ...selection,
    elements: selection.elements.map((capture) => {
      if (!capture.selectors.reachable) return capture;
      const hint = response.hints[hintIndex++] ?? null;
      return hint === null ? capture : { ...capture, componentHint: hint };
    }),
  };
}
