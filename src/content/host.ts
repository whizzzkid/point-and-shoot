/// <reference lib="dom" />

import { type ComponentChildren, render } from "preact";
import tokenStyles from "../shared/design/tokens.css" with { type: "text" };
import componentStyles from "../ui/components/components.css" with { type: "text" };
import type { Theme } from "../shared/theme.ts";

const HOST_ATTRIBUTE = "data-point-and-shoot-host";
const MOUNT_ATTRIBUTE = "data-point-and-shoot-mount";
const MAXIMUM_Z_INDEX = "2147483647";

const HOST_STYLES = `
:host {
  color: var(--text-primary);
  color-scheme: dark;
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

:host([data-theme="light"]) {
  color-scheme: light;
}

[${MOUNT_ATTRIBUTE}] {
  height: 100%;
  pointer-events: none;
  width: 100%;
}
`;

/** Inputs accepted by {@link createShadowHost}. */
export interface CreateShadowHostOptions {
  readonly children?: ComponentChildren;
  readonly ownerDocument?: Document;
  readonly resourceUrl: (path: string) => string;
  readonly theme: Theme;
}

/** Extension-owned references retained after creating the otherwise-closed shadow tree. */
export interface ShadowHost {
  readonly element: HTMLElement;
  readonly mount: HTMLElement;
  readonly root: ShadowRoot;
  destroy(): void;
}

function createStyleSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

function resolveFontUrls(
  css: string,
  resourceUrl: (path: string) => string,
): string {
  const matches = css.matchAll(
    /url\(['"]?\.\/fonts\/(?<filename>[^'")]+)['"]?\)/g,
  );
  let resolved = css;
  for (const match of matches) {
    const filename = match.groups?.filename;
    if (filename === undefined) continue;
    resolved = resolved.replaceAll(
      `./fonts/${filename}`,
      resourceUrl(`src/shared/design/fonts/${filename}`),
    );
  }
  return resolved;
}

function shadowTokenStyles(
  resourceUrl: (path: string) => string,
): string {
  return resolveFontUrls(tokenStyles, resourceUrl)
    .replaceAll(":root", ":host")
    .replaceAll('[data-theme="light"]', ':host([data-theme="light"])');
}

function documentFontStyles(resourceUrl: (path: string) => string): string {
  return [...tokenStyles.matchAll(/@font-face\s*\{[^}]*\}/g)]
    .map((match) => resolveFontUrls(match[0], resourceUrl))
    .join("\n");
}

function defendHostElement(element: HTMLElement): void {
  // The maximum CSS z-index plus an inline-important reset wins ordinary page stacking and reset
  // rules. Appending directly under <html> keeps transformed descendants from becoming its fixed
  // containing block; W3.3 reparents it into the fullscreen element when the top layer requires it.
  const importantStyles: Readonly<Record<string, string>> = {
    all: "initial",
    contain: "strict",
    display: "block",
    height: "100vh",
    inset: "0",
    isolation: "isolate",
    "pointer-events": "none",
    position: "fixed",
    width: "100vw",
    "z-index": MAXIMUM_Z_INDEX,
  };
  for (const [property, value] of Object.entries(importantStyles)) {
    element.style.setProperty(property, value, "important");
  }
}

/**
 * Creates the extension's single closed shadow boundary, adopts its styles, and mounts Preact.
 *
 * @param options Initial content, document, extension URL resolver, and forced first-paint theme.
 * @returns Extension-owned handles for later rendering and teardown.
 */
export function createShadowHost(
  {
    children,
    ownerDocument = document,
    resourceUrl,
    theme,
  }: CreateShadowHostOptions,
): ShadowHost {
  const element = ownerDocument.createElement("point-and-shoot-root");
  element.setAttribute(HOST_ATTRIBUTE, "");
  element.dataset.theme = theme;
  defendHostElement(element);

  const root = element.attachShadow({ mode: "closed" });
  const fontSheet = createStyleSheet(documentFontStyles(resourceUrl));
  const tokenSheet = createStyleSheet(shadowTokenStyles(resourceUrl));
  const componentSheet = createStyleSheet(componentStyles);
  const hostSheet = createStyleSheet(HOST_STYLES);
  ownerDocument.adoptedStyleSheets = [...ownerDocument.adoptedStyleSheets, fontSheet];
  root.adoptedStyleSheets = [tokenSheet, componentSheet, hostSheet];

  const mount = ownerDocument.createElement("div");
  mount.setAttribute(MOUNT_ATTRIBUTE, "");
  root.append(mount);
  ownerDocument.documentElement.append(element);
  render(children, mount);

  return {
    element,
    mount,
    root,
    destroy(): void {
      render(null, mount);
      element.remove();
      ownerDocument.adoptedStyleSheets = ownerDocument.adoptedStyleSheets.filter(
        (sheet) => sheet !== fontSheet,
      );
    },
  };
}
