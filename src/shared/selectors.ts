/// <reference lib="dom" />

/**
 * Builds selector bundles that let an exported bug report point back at the exact element a user
 * flagged, per ADR-0009's "the report must survive the page it was captured on going away" intent.
 *
 * @module
 */

/** Attributes checked for a stable test-authored identifier, in the priority order they are read. */
export type TestIdAttribute = "data-testid" | "data-test" | "data-cy" | "id";

/** One test-authored identifier found on the element. */
export interface TestIdSignal {
  readonly attribute: TestIdAttribute;
  readonly value: string;
}

/** An element's ARIA role plus its best-effort computed accessible name. */
export interface AriaIdentity {
  readonly role: string;
  readonly name: string;
}

/** Why a selector bundle carries no path back to the element. */
export type UnreachableReason =
  | "closed-shadow-root"
  | "cross-origin-iframe"
  | "detached"
  | "not-an-element";

/** A bundle whose `cssPath`/`xpath` are verified to round-trip back to the element. */
export interface ReachableSelectorBundle {
  readonly reachable: true;
  readonly testIds: readonly TestIdSignal[];
  readonly ariaRoleName?: AriaIdentity;
  readonly cssPath: readonly string[];
  readonly xpath: readonly string[];
  readonly tagClasses: string;
  readonly textSnippet: string;
}

/**
 * A bundle for an element no selector can safely point back at. Carries every signal that could be
 * read directly off the element (no traversal needed), but never a `cssPath`/`xpath` — a path that
 * cannot be trusted to resolve is worse than no path at all.
 */
export interface UnreachableSelectorBundle {
  readonly reachable: false;
  readonly unreachable: UnreachableReason;
  readonly testIds: readonly TestIdSignal[];
  readonly ariaRoleName?: AriaIdentity;
  readonly tagClasses: string;
  readonly textSnippet: string;
}

/**
 * What {@link buildSelectorBundle} returns.
 *
 * Field order records trust order for a consumer chaining fallbacks: try {@link
 * ReachableSelectorBundle.testIds} first (an identifier a test suite already depends on), then
 * {@link ReachableSelectorBundle.ariaRoleName} (survives most markup reshuffles), and treat {@link
 * ReachableSelectorBundle.cssPath}/{@link ReachableSelectorBundle.xpath} as the structural
 * last resort — it survives only until the DOM around the element changes shape.
 */
export type SelectorBundle = ReachableSelectorBundle | UnreachableSelectorBundle;

/**
 * Builds a selector bundle for `el`, so a captured bug report can point back at the exact element
 * after the page reloads.
 *
 * Every helper below is nested inside this function's own body rather than hoisted to module scope.
 * That is deliberate, not a style choice: the test suite drives this function inside a real browser
 * via Playwright's `page.evaluate`, which serializes a page function by source text alone — a call
 * out to a module-level helper would resolve to nothing once that text is re-parsed in the page. Do
 * not lift a helper out of this function, even for reuse elsewhere in this module.
 *
 * `cssPath` and `xpath` are arrays rather than single strings so an element inside a shadow root can
 * carry an explicit record of every boundary it crosses: segment 0 resolves within `document`,
 * segment 1 resolves within segment 0's match's `shadowRoot`, and so on. A plain light-DOM element
 * gets a one-element array. Every array this function returns is verified, before returning, to
 * resolve back to `el` — see `resolveCssPath`/`resolveXPath` below, also exported so tests (and any
 * future dev-mode guard) can run the exact same round-trip check.
 *
 * @param el - The element to build a selector bundle for.
 * @returns A bundle with a verified path back to `el`, or an {@link UnreachableSelectorBundle} when
 *   no path can be trusted — closed shadow root interior, cross-origin iframe interior, a detached
 *   element, or a non-element node passed in by mistake.
 * @example buildSelectorBundle(document.querySelector("button")!) // => { reachable: true, ... }
 */
export function buildSelectorBundle(el: Element): SelectorBundle {
  /** `Node.nodeType` for an element node — inlined since this runs before DOM globals are assumed. */
  const ELEMENT_NODE = 1;

  function isElement(node: Node): node is Element {
    return node.nodeType === ELEMENT_NODE;
  }

  /** Walks up shadow-boundary crossings from `node`, true if any crossed root is closed. */
  function hasClosedShadowAncestor(node: Node): boolean {
    let current: Node = node;
    while (true) {
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        if (root.mode === "closed") return true;
        current = root.host;
        continue;
      }
      return false;
    }
  }

  function collectTestIds(node: Element): TestIdSignal[] {
    const attributes: readonly TestIdAttribute[] = ["data-testid", "data-test", "data-cy", "id"];
    const signals: TestIdSignal[] = [];
    for (const attribute of attributes) {
      const value = node.getAttribute(attribute);
      if (value !== null && value !== "") signals.push({ attribute, value });
    }
    return signals;
  }

  function computeTagClasses(node: Element): string {
    const tag = node.tagName.toLowerCase();
    const classes = Array.from(node.classList).filter((name) => name.length > 0);
    return classes.length === 0 ? tag : `${tag}.${classes.join(".")}`;
  }

  const TEXT_SNIPPET_CAP = 80;

  function computeTextSnippet(node: Node): string {
    const collapsed = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    return collapsed.length > TEXT_SNIPPET_CAP
      ? `${collapsed.slice(0, TEXT_SNIPPET_CAP)}…`
      : collapsed;
  }

  function resolveIdRefsText(node: Element, idRefs: string): string {
    const doc = node.ownerDocument;
    return idRefs
      .split(/\s+/)
      .filter((id) => id.length > 0)
      .map((id) => doc.getElementById(id)?.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const IMPLICIT_ROLES: Readonly<Record<string, string>> = {
    a: "link",
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
  };

  function implicitRole(node: Element): string | undefined {
    const tag = node.tagName.toLowerCase();
    if (tag === "a") return node.hasAttribute("href") ? "link" : undefined;
    if (tag === "input") {
      const type = (node.getAttribute("type") ?? "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    return IMPLICIT_ROLES[tag];
  }

  function computeAriaRoleName(node: Element): AriaIdentity | undefined {
    const role = node.getAttribute("role") ?? implicitRole(node);
    if (role === undefined) return undefined;

    const ariaLabel = node.getAttribute("aria-label");
    const labelledBy = node.getAttribute("aria-labelledby");
    const name = ariaLabel !== null && ariaLabel !== ""
      ? ariaLabel
      : labelledBy !== null && labelledBy !== ""
      ? resolveIdRefsText(node, labelledBy)
      : computeTextSnippet(node);

    return { role, name };
  }

  /**
   * Translates an xpath-style segment (e.g. `/html/body/div[2]`) into its CSS equivalent
   * (`html > body > div:nth-of-type(2)`). `document.evaluate` rejects a `ShadowRoot` context node
   * outright (`NotSupportedError: ... not a valid context node type`), so native XPath evaluation
   * cannot check uniqueness or resolve a path once it has crossed a shadow boundary — every xpath
   * segment this module produces uses `tag[n]` positional indexing by design specifically so it has
   * an exact CSS `:nth-of-type` equivalent, and resolution goes through that equivalent instead.
   */
  function xpathSegmentToCss(segment: string): string {
    const withoutLeadingSlash = segment.startsWith("/") ? segment.slice(1) : segment;
    return withoutLeadingSlash
      .split("/")
      .map((part) => part.replace(/\[(\d+)\]$/, ":nth-of-type($1)"))
      .join(" > ");
  }

  /** Shortest selector, scoped to `root`, that resolves to exactly `target` within it. */
  function uniqueCssSelectorWithin(target: Element, root: Document | ShadowRoot): string {
    function isUniqueMatch(selector: string): boolean {
      const matches = root.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === target;
    }

    if (target.id) {
      const idSelector = `#${CSS.escape(target.id)}`;
      if (isUniqueMatch(idSelector)) return idSelector;
    }

    const segments: string[] = [];
    let current: Element = target;
    while (true) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      let segment = tag;
      if (parent !== null) {
        const sameTagSiblings = Array.from(parent.children).filter((c) =>
          c.tagName === current.tagName
        );
        if (sameTagSiblings.length > 1) {
          segment = `${tag}:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
        }
      }
      segments.unshift(segment);

      if (isUniqueMatch(segments.join(" > "))) return segments.join(" > ");
      if (parent === null) return segments.join(" > ");
      current = parent;
    }
  }

  /** Shortest XPath, scoped to `root`, that resolves to exactly `target` within it. */
  function uniqueXPathWithin(target: Element, root: Document | ShadowRoot): string {
    const isAbsolute = root instanceof Document;

    function isUniqueMatch(expression: string): boolean {
      const matches = root.querySelectorAll(xpathSegmentToCss(expression));
      return matches.length === 1 && matches[0] === target;
    }

    const segments: string[] = [];
    let current: Element = target;
    while (true) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      let segment = tag;
      if (parent !== null) {
        const sameTagSiblings = Array.from(parent.children).filter((c) =>
          c.tagName === current.tagName
        );
        if (sameTagSiblings.length > 1) {
          segment = `${tag}[${sameTagSiblings.indexOf(current) + 1}]`;
        }
      }
      segments.unshift(segment);

      const candidate = isAbsolute ? `/${segments.join("/")}` : segments.join("/");
      if (isUniqueMatch(candidate)) return candidate;
      if (parent === null) return candidate;
      current = parent;
    }
  }

  /** Builds the boundary-crossing segment list for `target`, outermost segment first. */
  function buildPathSegments(
    target: Element,
    uniqueWithin: (target: Element, root: Document | ShadowRoot) => string,
  ): string[] {
    const segments: string[] = [];
    let currentEl = target;
    while (true) {
      const root = currentEl.getRootNode();
      if (root instanceof Document) {
        segments.unshift(uniqueWithin(currentEl, root));
        return segments;
      }
      const shadowRoot = root as ShadowRoot;
      segments.unshift(uniqueWithin(currentEl, shadowRoot));
      currentEl = shadowRoot.host;
    }
  }

  if (!isElement(el)) {
    return {
      reachable: false,
      unreachable: "not-an-element",
      testIds: [],
      tagClasses: "",
      textSnippet: computeTextSnippet(el),
    };
  }

  const testIds = collectTestIds(el);
  const ariaRoleName = computeAriaRoleName(el);
  const tagClasses = computeTagClasses(el);
  const textSnippet = computeTextSnippet(el);
  /** `exactOptionalPropertyTypes` forbids `ariaRoleName: undefined` — omit the key entirely instead. */
  const ariaRoleNameField = ariaRoleName === undefined ? {} : { ariaRoleName };

  if (!el.isConnected) {
    return {
      reachable: false,
      unreachable: "detached",
      testIds,
      ...ariaRoleNameField,
      tagClasses,
      textSnippet,
    };
  }

  if (hasClosedShadowAncestor(el)) {
    return {
      reachable: false,
      unreachable: "closed-shadow-root",
      testIds,
      ...ariaRoleNameField,
      tagClasses,
      textSnippet,
    };
  }

  if (el.tagName === "IFRAME") {
    let contentDocument: Document | null;
    try {
      contentDocument = (el as HTMLIFrameElement).contentDocument;
    } catch {
      contentDocument = null;
    }
    if (contentDocument === null) {
      return {
        reachable: false,
        unreachable: "cross-origin-iframe",
        testIds,
        ...ariaRoleNameField,
        tagClasses,
        textSnippet,
      };
    }
  }

  /**
   * Duplicates {@link resolveCssPath}'s logic rather than calling it — this function must stay
   * callable purely by its own serialized source (see the module-scope note above), so it cannot
   * reach out to another module export at runtime.
   */
  function roundTripCssPath(segments: readonly string[]): Element | null {
    let root: Document | ShadowRoot = document;
    let match: Element | null = null;
    for (const segment of segments) {
      match = root.querySelector(segment);
      if (match === null) return null;
      if (match.shadowRoot !== null) root = match.shadowRoot;
    }
    return match;
  }

  /** Duplicates {@link resolveXPath}'s logic — see {@link roundTripCssPath} for why. */
  function roundTripXPath(segments: readonly string[]): Element | null {
    let root: Document | ShadowRoot = document;
    let match: Element | null = null;
    for (const segment of segments) {
      match = root.querySelector(xpathSegmentToCss(segment));
      if (match === null) return null;
      if (match.shadowRoot !== null) root = match.shadowRoot;
    }
    return match;
  }

  const cssPath = buildPathSegments(el, uniqueCssSelectorWithin);
  const xpath = buildPathSegments(el, uniqueXPathWithin);

  if (roundTripCssPath(cssPath) !== el) {
    throw new Error(`selector bundle: cssPath ${JSON.stringify(cssPath)} did not round-trip`);
  }
  if (roundTripXPath(xpath) !== el) {
    throw new Error(`selector bundle: xpath ${JSON.stringify(xpath)} did not round-trip`);
  }

  return {
    reachable: true,
    testIds,
    ...ariaRoleNameField,
    cssPath,
    xpath,
    tagClasses,
    textSnippet,
  };
}

/**
 * Resolves a {@link ReachableSelectorBundle.cssPath} back to its element, crossing every shadow
 * boundary the path recorded. Self-contained for the same reason as {@link buildSelectorBundle}: it
 * runs inside a real browser via `page.evaluate` in this project's tests.
 *
 * @param segments - A `cssPath` produced by {@link buildSelectorBundle}.
 * @returns The resolved element, or `null` if any segment fails to resolve uniquely.
 * @example resolveCssPath(["#open-host", ".inner > button"]) // => the button inside the shadow root
 */
export function resolveCssPath(segments: readonly string[]): Element | null {
  let root: Document | ShadowRoot = document;
  let match: Element | null = null;
  for (const segment of segments) {
    match = root.querySelector(segment);
    if (match === null) return null;
    if (match.shadowRoot !== null) root = match.shadowRoot;
  }
  return match;
}

/**
 * Resolves a {@link ReachableSelectorBundle.xpath} back to its element, crossing every shadow
 * boundary the path recorded. Self-contained for the same reason as {@link buildSelectorBundle}.
 *
 * Resolves via each segment's CSS equivalent (`tag[n]` → `tag:nth-of-type(n)`) rather than native
 * `document.evaluate` — Chromium rejects a `ShadowRoot` as an XPath context node outright
 * (`NotSupportedError: ... not a valid context node type`), so evaluation can't cross a shadow
 * boundary. Every xpath segment this module produces uses `tag[n]` positional indexing by design,
 * specifically so it has an exact CSS equivalent to fall back on.
 *
 * @param segments - An `xpath` produced by {@link buildSelectorBundle}.
 * @returns The resolved element, or `null` if any segment fails to resolve uniquely.
 * @example resolveXPath(["/html/body/button"]) // => that button
 */
export function resolveXPath(segments: readonly string[]): Element | null {
  function xpathSegmentToCss(segment: string): string {
    const withoutLeadingSlash = segment.startsWith("/") ? segment.slice(1) : segment;
    return withoutLeadingSlash
      .split("/")
      .map((part) => part.replace(/\[(\d+)\]$/, ":nth-of-type($1)"))
      .join(" > ");
  }

  let root: Document | ShadowRoot = document;
  let match: Element | null = null;
  for (const segment of segments) {
    match = root.querySelector(xpathSegmentToCss(segment));
    if (match === null) return null;
    if (match.shadowRoot !== null) root = match.shadowRoot;
  }
  return match;
}
