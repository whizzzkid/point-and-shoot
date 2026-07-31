/// <reference lib="dom" />

import { render } from "preact";
import { CaptureOverlay } from "../../src/content/CaptureOverlay.tsx";
import { createShadowHost } from "../../src/content/host.ts";
import pickerStyles from "../../src/content/picker/picker.css" with { type: "text" };
import iconSprite from "../../src/shared/design/icons.svg" with { type: "text" };
import toolbarStyles from "../../src/content/toolbar/toolbar.css" with { type: "text" };
import type { SerializableAxeViolation } from "./axe.ts";

interface ContrastSamples {
  readonly highlightBorder: string;
  readonly pageBackground: string;
  readonly targetBackground: string;
  readonly toolbarActionBackground: string;
  readonly toolbarActionForeground: string;
  readonly toolbarBackground: string;
  readonly toolbarIconForeground: string;
  readonly toolbarTextBackground: string;
  readonly toolbarTextForeground: string;
}

interface MotionOffender {
  readonly animationDuration: string;
  readonly animationName: string;
  readonly target: string;
  readonly transitionDuration: string;
}

interface AxeRuntime {
  run(
    context: Element,
    options: {
      readonly runOnly: {
        readonly type: "tag";
        readonly values: readonly string[];
      };
    },
  ): Promise<{ readonly violations: readonly SerializableAxeViolation[] }>;
}

function requiredElement(selector: string, message: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(message);
  return element;
}

const target = requiredElement(
  "[data-a11y-target]",
  "overlay accessibility target is missing",
);

const shadowHost = createShadowHost({
  inlineIconSprite: iconSprite,
  resourceUrl: () => "data:font/woff2;base64,d09GMg==",
  styles: [pickerStyles, toolbarStyles],
  theme: document.documentElement.dataset.a11yTheme === "light" ? "light" : "dark",
});

render(<CaptureOverlay iconSpriteUrl="" noteCount={1} />, shadowHost.mount);

// axe-core cannot traverse a production closed shadow root even when the test retains its
// ShadowRoot handle. This open audit tree renders the same production toolbar solely for semantic
// rules; contrast, motion, Escape, and focus assertions still inspect the real closed overlay.
const auditHost = document.createElement("div");
auditHost.dataset.a11yAuditHost = "";
document.body.append(auditHost);
const auditRoot = auditHost.attachShadow({ mode: "open" });
const auditMount = document.createElement("div");
auditRoot.append(auditMount);
const toolbar = shadowHost.root.querySelector(".ps-floating-toolbar");
if (toolbar === null) throw new Error("overlay accessibility toolbar is missing");
auditMount.append(toolbar.cloneNode(true));

function describe(element: Element): string {
  const className = element.getAttribute("class");
  return className === null
    ? element.tagName.toLowerCase()
    : `.${className.trim().replaceAll(" ", ".")}`;
}

function hasNonZeroDuration(value: string): boolean {
  return value.split(",").some((duration) => Number.parseFloat(duration) > 0);
}

function motionOffenders(): readonly MotionOffender[] {
  const candidates = [...shadowHost.root.querySelectorAll("*")];
  const offenders = candidates.flatMap((element) => {
    const styles = [getComputedStyle(element), getComputedStyle(element, "::after")];
    return styles.flatMap((style) => {
      const activeAnimation = style.animationName !== "none" &&
        hasNonZeroDuration(style.animationDuration);
      const activeTransition = hasNonZeroDuration(style.transitionDuration);
      return activeAnimation || activeTransition
        ? [{
          animationDuration: style.animationDuration,
          animationName: style.animationName,
          target: describe(element),
          transitionDuration: style.transitionDuration,
        }]
        : [];
    });
  });
  return offenders;
}

function contrastSamples(): ContrastSamples {
  const highlight = shadowHost.root.querySelector<HTMLElement>(".ps-picker-highlight");
  const toolbar = shadowHost.root.querySelector<HTMLElement>(".ps-floating-toolbar");
  const badge = shadowHost.root.querySelector<HTMLElement>(".ps-badge");
  const iconButton = shadowHost.root.querySelector<HTMLElement>(".ps-icon-button");
  const action = shadowHost.root.querySelector<HTMLElement>(
    '.ps-button[data-variant="primary"]',
  );
  if (
    highlight === null || toolbar === null || badge === null || iconButton === null ||
    action === null
  ) {
    throw new Error("overlay accessibility samples are not ready");
  }
  const highlightStyle = getComputedStyle(highlight);
  const toolbarStyle = getComputedStyle(toolbar);
  const badgeStyle = getComputedStyle(badge);
  const iconButtonStyle = getComputedStyle(iconButton);
  const actionStyle = getComputedStyle(action);
  return {
    highlightBorder: highlightStyle.borderTopColor,
    pageBackground: getComputedStyle(document.body).backgroundColor,
    targetBackground: getComputedStyle(target).backgroundColor,
    toolbarActionBackground: actionStyle.backgroundColor,
    toolbarActionForeground: actionStyle.color,
    toolbarBackground: toolbarStyle.backgroundColor,
    toolbarIconForeground: iconButtonStyle.color,
    toolbarTextBackground: badgeStyle.backgroundColor,
    toolbarTextForeground: badgeStyle.color,
  };
}

async function axeViolations(): Promise<readonly SerializableAxeViolation[]> {
  const axeRuntime = (globalThis as unknown as { readonly axe: AxeRuntime }).axe;
  const result = await axeRuntime.run(auditHost, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
    },
  });
  return result.violations;
}

const harness = {
  axeViolations,
  contrastSamples,
  motionOffenders,
  overlayCount(): number {
    return shadowHost.root.querySelectorAll(
      ".ps-picker-highlight, .ps-picker-drag-box, .ps-picker-frame-shield",
    ).length;
  },
  toolbarPresent(): boolean {
    return shadowHost.root.querySelector('[role="toolbar"]') !== null;
  },
};

(globalThis as unknown as { pointShootOverlayA11y: typeof harness }).pointShootOverlayA11y =
  harness;
