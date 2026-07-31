/// <reference lib="dom" />

import { type NotePreviewRequest } from "../shared/messages.ts";
import type { AriaIdentity, SelectorBundle } from "../shared/selectors.ts";
import { resolveCssPath, resolveXPath } from "../shared/selectors.ts";

const PREVIEW_HOST_ATTRIBUTE = "data-point-and-shoot-preview-host";
const MAXIMUM_Z_INDEX = "2147483647";
const NAVIGATION_POLL_MILLISECONDS = 200;
const PREVIEW_STYLES = `
:host {
  all: initial;
}

[data-preview-box] {
  background: rgb(79 124 255 / 16%);
  border: 3px solid rgb(79 124 255);
  border-radius: 4px;
  box-shadow:
    0 0 0 1px rgb(255 255 255),
    0 0 0 3px rgb(17 19 24),
    0 0 18px rgb(79 124 255 / 60%);
  box-sizing: border-box;
  pointer-events: none;
  position: fixed;
}
`;

/** Generation-aware preview layer owned by the content realm. */
export interface NotePreviewLayer {
  /** Removes all preview UI and listeners. */
  destroy(): void;
  /**
   * Applies a validated preview request.
   *
   * @param request Monotonic show or clear request.
   * @returns Whether at least one recorded selector resolved and was highlighted.
   */
  handle(request: NotePreviewRequest): boolean;
}

function implicitRole(element: Element): string | undefined {
  const tag = element.tagName.toLowerCase();
  if (tag === "a") return element.hasAttribute("href") ? "link" : undefined;
  if (tag === "input") {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    return "textbox";
  }
  return {
    button: "button",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    img: "img",
    li: "listitem",
    nav: "navigation",
    ol: "list",
    select: "listbox",
    textarea: "textbox",
    ul: "list",
  }[tag];
}

function collapsedText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function accessibleName(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label !== null && label !== "") return label;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null && labelledBy !== "") {
    return collapsedText(
      labelledBy
        .split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
  }
  return collapsedText(element.textContent);
}

function deepElements(root: Document | ShadowRoot): Element[] {
  const elements = [...root.querySelectorAll("*")];
  for (const element of [...elements]) {
    if (element.shadowRoot !== null) elements.push(...deepElements(element.shadowRoot));
  }
  return elements;
}

function uniqueMatch(
  elements: readonly Element[],
  predicate: (element: Element) => boolean,
): Element | null {
  const matches = elements.filter(predicate);
  return matches.length === 1 ? matches[0] ?? null : null;
}

function resolveStableIdentity(
  selectors: SelectorBundle,
  elements: readonly Element[],
): Element | null {
  for (const signal of selectors.testIds) {
    const match = uniqueMatch(
      elements,
      (element) => element.getAttribute(signal.attribute) === signal.value,
    );
    if (match !== null) return match;
  }
  return null;
}

function resolveAriaIdentity(
  identity: AriaIdentity | undefined,
  elements: readonly Element[],
): Element | null {
  if (identity === undefined) return null;
  return uniqueMatch(
    elements,
    (element) =>
      (element.getAttribute("role") ?? implicitRole(element)) === identity.role &&
      accessibleName(element) === identity.name,
  );
}

/**
 * Resolves one selector bundle in its documented trust order.
 *
 * @param selectors Recorded selector bundle.
 * @param ownerDocument Inspected document containing the target.
 * @returns The unique stable-id, ARIA, CSS, or XPath match, or `null`.
 */
export function resolveNotePreviewTarget(
  selectors: SelectorBundle,
  ownerDocument: Document = document,
): Element | null {
  if (!selectors.reachable) return null;
  const elements = deepElements(ownerDocument);
  const identityMatch = resolveStableIdentity(selectors, elements) ??
    resolveAriaIdentity(selectors.ariaRoleName, elements);
  if (identityMatch !== null) return identityMatch;
  try {
    const cssMatch = resolveCssPath(selectors.cssPath);
    if (cssMatch !== null) return cssMatch;
  } catch {
    // A page can change a once-valid structural selector into invalid CSS. Continue to XPath.
  }
  try {
    return resolveXPath(selectors.xpath);
  } catch {
    return null;
  }
}

function defendHost(host: HTMLElement): void {
  const styles: Readonly<Record<string, string>> = {
    all: "initial",
    display: "block",
    height: "100vh",
    inset: "0",
    "pointer-events": "none",
    position: "fixed",
    width: "100vw",
    "z-index": MAXIMUM_Z_INDEX,
  };
  for (const [property, value] of Object.entries(styles)) {
    host.style.setProperty(property, value, "important");
  }
}

/**
 * Creates the closed-shadow note-preview layer for an inspected page.
 *
 * @param ownerDocument Inspected page document.
 * @param ownerWindow Inspected page window.
 * @returns A layer that ignores stale generations and never styles target elements.
 */
export function createNotePreviewLayer(
  ownerDocument: Document = document,
  ownerWindow: Window = window,
): NotePreviewLayer {
  let generation = -1;
  let host: HTMLElement | undefined;
  let root: ShadowRoot | undefined;
  let targets: readonly Element[] = [];
  let previewLocation = ownerWindow.location.href;

  const removeHost = (): void => {
    host?.remove();
    host = undefined;
    root = undefined;
    targets = [];
  };
  const ensureHost = (): ShadowRoot => {
    if (root !== undefined) return root;
    host = ownerDocument.createElement("point-and-shoot-preview");
    host.setAttribute(PREVIEW_HOST_ATTRIBUTE, "");
    defendHost(host);
    root = host.attachShadow({ mode: "closed" });
    const style = ownerDocument.createElement("style");
    style.textContent = PREVIEW_STYLES;
    root.append(style);
    ownerDocument.documentElement.append(host);
    return root;
  };
  const renderTargets = (): boolean => {
    const previewRoot = root;
    if (previewRoot === undefined) return false;
    for (const box of [...previewRoot.querySelectorAll("[data-preview-box]")]) box.remove();
    let visible = 0;
    for (const target of targets) {
      if (!target.isConnected) continue;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const box = ownerDocument.createElement("div");
      box.setAttribute("data-preview-box", "");
      box.style.blockSize = `${rect.height}px`;
      box.style.inlineSize = `${rect.width}px`;
      box.style.insetBlockStart = `${rect.top}px`;
      box.style.insetInlineStart = `${rect.left}px`;
      previewRoot.append(box);
      visible += 1;
    }
    if (visible === 0) removeHost();
    return visible > 0;
  };
  const refresh = (): void => {
    renderTargets();
  };
  const clearForNavigation = (): void => {
    removeHost();
  };
  const navigationPoll = ownerWindow.setInterval(() => {
    if (host !== undefined && ownerWindow.location.href !== previewLocation) {
      clearForNavigation();
    }
  }, NAVIGATION_POLL_MILLISECONDS);
  ownerWindow.addEventListener("resize", refresh);
  ownerWindow.addEventListener("scroll", refresh, true);
  ownerWindow.addEventListener("pagehide", clearForNavigation);
  ownerWindow.addEventListener("hashchange", clearForNavigation);
  ownerWindow.addEventListener("popstate", clearForNavigation);

  return {
    destroy() {
      generation += 1;
      removeHost();
      ownerWindow.removeEventListener("resize", refresh);
      ownerWindow.removeEventListener("scroll", refresh, true);
      ownerWindow.removeEventListener("pagehide", clearForNavigation);
      ownerWindow.removeEventListener("hashchange", clearForNavigation);
      ownerWindow.removeEventListener("popstate", clearForNavigation);
      ownerWindow.clearInterval(navigationPoll);
    },
    handle(request) {
      if (request.generation < generation) return host !== undefined;
      generation = request.generation;
      removeHost();
      if (request.action === "clear") return false;
      previewLocation = ownerWindow.location.href;
      targets = request.selectors
        .map((selectors) => resolveNotePreviewTarget(selectors, ownerDocument))
        .filter((target): target is Element => target !== null);
      if (targets.length === 0) return false;
      ensureHost();
      return renderTargets();
    },
  };
}
