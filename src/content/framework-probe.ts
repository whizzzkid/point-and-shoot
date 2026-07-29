/// <reference lib="dom" />

import type { ComponentHint } from "../shared/schema.ts";

/**
 * Resolves selector paths and probes undocumented framework metadata in the page's main world.
 *
 * Every helper is deliberately nested because `scripting.executeScript()` serializes this function
 * without its module scope. The caller must execute it with `world: "MAIN"`; an isolated content
 * world cannot observe framework-owned expando properties on DOM wrappers.
 *
 * @param rawCssPaths CSS segment arrays crossing zero or more open shadow roots.
 * @returns One aligned hint or `null` per path; malformed top-level input yields an empty array.
 */
export function probeFrameworkComponents(
  rawCssPaths: unknown = [],
  rawTextLengthLimit: unknown = 1_024,
): readonly (ComponentHint | null)[] {
  const textLengthLimit = typeof rawTextLengthLimit === "number" &&
      Number.isInteger(rawTextLengthLimit) &&
      rawTextLengthLimit > 0
    ? rawTextLengthLimit
    : 1_024;

  function isObjectLike(candidate: unknown): candidate is Record<string, unknown> {
    return (typeof candidate === "object" && candidate !== null) ||
      typeof candidate === "function";
  }

  function stringField(candidate: unknown, fields: readonly string[]): string | undefined {
    if (!isObjectLike(candidate)) return undefined;
    for (const field of fields) {
      const value = candidate[field];
      if (typeof value === "string" && value.trim() !== "") {
        return value.slice(0, textLengthLimit);
      }
    }
    return undefined;
  }

  function positiveInteger(candidate: unknown): number | undefined {
    return typeof candidate === "number" &&
        Number.isInteger(candidate) &&
        candidate > 0
      ? candidate
      : undefined;
  }

  function componentName(candidate: unknown): string | undefined {
    if (!isObjectLike(candidate)) return undefined;
    const direct = stringField(candidate, ["displayName", "name", "__name"]);
    if (direct !== undefined) return direct;
    return componentName(candidate.render) ?? componentName(candidate.type);
  }

  function resolveElement(candidate: unknown): Element | null {
    if (
      !Array.isArray(candidate) ||
      candidate.length === 0 ||
      !candidate.every((segment) => typeof segment === "string" && segment !== "")
    ) {
      return null;
    }
    let root: Document | ShadowRoot = document;
    let element: Element | null = null;
    for (let index = 0; index < candidate.length; index++) {
      element = root.querySelector(candidate[index] as string);
      if (element === null) return null;
      if (index < candidate.length - 1) {
        const nextRoot: ShadowRoot | null = element.shadowRoot;
        if (nextRoot === null) return null;
        root = nextRoot;
      }
    }
    return element;
  }

  function reactHint(element: Element): ComponentHint | null {
    const key = Object.getOwnPropertyNames(element).find((candidate) =>
      candidate.startsWith("__reactFiber$") ||
      candidate.startsWith("__reactInternalInstance$")
    );
    if (key === undefined) return null;
    let fiber: unknown = (element as unknown as Record<string, unknown>)[key];
    let nearestFile: string | undefined;
    let nearestLine: number | undefined;
    const visited = new Set<unknown>();
    for (let depth = 0; depth < 50 && isObjectLike(fiber); depth++) {
      if (visited.has(fiber)) return null;
      visited.add(fiber);
      const source = fiber._debugSource;
      if (isObjectLike(source)) {
        nearestFile ??= stringField(source, ["fileName", "file"]);
        nearestLine ??= positiveInteger(source.lineNumber) ?? positiveInteger(source.line);
      }
      const name = componentName(fiber.elementType) ?? componentName(fiber.type);
      if (name !== undefined && nearestFile !== undefined) {
        return {
          file: nearestFile,
          framework: "react",
          ...(nearestLine === undefined ? {} : { line: nearestLine }),
          name,
        };
      }
      fiber = fiber.return;
    }
    return null;
  }

  function vueHint(element: Element): ComponentHint | null {
    let instance: unknown = (element as unknown as Record<string, unknown>).__vueParentComponent;
    const visited = new Set<unknown>();
    for (let depth = 0; depth < 50 && isObjectLike(instance); depth++) {
      if (visited.has(instance)) return null;
      visited.add(instance);
      const type = isObjectLike(instance.type)
        ? instance.type
        : isObjectLike(instance.vnode) && isObjectLike(instance.vnode.type)
        ? instance.vnode.type
        : undefined;
      const name = componentName(type);
      if (name !== undefined) {
        const file = stringField(type, ["__file"]);
        return {
          ...(file === undefined ? {} : { file }),
          framework: "vue",
          name,
        };
      }
      instance = instance.parent;
    }
    return null;
  }

  function svelteHint(element: Element): ComponentHint | null {
    const meta = (element as unknown as Record<string, unknown>).__svelte_meta;
    if (!isObjectLike(meta)) return null;
    const location = isObjectLike(meta.loc) ? meta.loc : meta;
    const name = stringField(meta, ["component", "name"]);
    if (name === undefined) return null;
    const file = stringField(location, ["file", "filename"]);
    const line = positiveInteger(location.line);
    return {
      ...(file === undefined ? {} : { file }),
      framework: "svelte",
      ...(line === undefined ? {} : { line }),
      name,
    };
  }

  function angularHint(element: Element): ComponentHint | null {
    const marker = (element as unknown as Record<string, unknown>).__ngContext__;
    if (marker === undefined) return null;
    const angularDebug = (globalThis as unknown as Record<string, unknown>).ng;
    if (!isObjectLike(angularDebug) || typeof angularDebug.getOwningComponent !== "function") {
      return null;
    }
    const component = angularDebug.getOwningComponent(element);
    const name = isObjectLike(component) ? componentName(component.constructor) : undefined;
    return name === undefined ? null : { framework: "angular", name };
  }

  function probeOne(rawCssPath: unknown): ComponentHint | null {
    try {
      const element = resolveElement(rawCssPath);
      if (element === null) return null;
      return reactHint(element) ??
        vueHint(element) ??
        svelteHint(element) ??
        angularHint(element);
    } catch {
      return null;
    }
  }

  return Array.isArray(rawCssPaths) ? rawCssPaths.map(probeOne) : [];
}
