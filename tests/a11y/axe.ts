/// <reference lib="dom" />

import type { Page } from "playwright";

const AXE_REPORT_DIRECTORY = "playwright-report/a11y";
const REPORT_NAME_PATTERN = /^[a-z0-9-]+$/;
const AXE_SOURCE = await Deno.readTextFile(new URL(import.meta.resolve("axe-core")));

/** Serializable axe impact values used to decide whether a scan blocks release. */
export type AxeImpact = "minor" | "moderate" | "serious" | "critical" | null;

/** One serializable axe node finding retained in failure artifacts. */
export interface SerializableAxeNode {
  readonly failureSummary: string | undefined;
  readonly target: readonly string[];
}

/** One serializable axe rule violation retained in failure artifacts. */
export interface SerializableAxeViolation {
  readonly help: string;
  readonly helpUrl: string;
  readonly id: string;
  readonly impact: AxeImpact;
  readonly nodes: readonly SerializableAxeNode[];
}

interface AxeRuntime {
  run(
    context: Document,
    options: {
      readonly runOnly: {
        readonly type: "tag";
        readonly values: readonly string[];
      };
    },
  ): Promise<{
    readonly violations: readonly {
      readonly help: string;
      readonly helpUrl: string;
      readonly id: string;
      readonly impact: AxeImpact;
      readonly nodes: readonly {
        readonly failureSummary?: string;
        readonly target: readonly string[];
      }[];
    }[];
  }>;
}

/**
 * Keeps axe findings that fail Wave 4's serious-or-critical release threshold.
 *
 * @param violations Serializable axe violations from one surface.
 * @returns Only serious and critical violations.
 */
export function blockingAxeViolations(
  violations: readonly SerializableAxeViolation[],
): readonly SerializableAxeViolation[] {
  return violations.filter(({ impact }) => impact === "serious" || impact === "critical");
}

/**
 * Formats actionable axe failures for terminal and CI output.
 *
 * @param surface Human-readable scanned surface.
 * @param violations Blocking violations on that surface.
 * @returns Multi-line failure message.
 */
export function formatAxeViolations(
  surface: string,
  violations: readonly SerializableAxeViolation[],
): string {
  const details = violations.flatMap((violation) =>
    violation.nodes.map((node) =>
      [
        `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help}`,
        `target: ${node.target.join(" > ")}`,
        `remediation: ${node.failureSummary ?? violation.helpUrl}`,
      ].join("\n")
    )
  );
  return `${surface} has ${violations.length} blocking axe violation(s):\n${details.join("\n\n")}`;
}

async function writeFailureReport(
  reportName: string,
  violations: readonly SerializableAxeViolation[],
): Promise<void> {
  if (!REPORT_NAME_PATTERN.test(reportName)) {
    throw new Error(`invalid axe report name: "${reportName}"`);
  }
  await Deno.mkdir(AXE_REPORT_DIRECTORY, { recursive: true });
  await Deno.writeTextFile(
    `${AXE_REPORT_DIRECTORY}/${reportName}.json`,
    `${JSON.stringify({ reportName, violations }, null, 2)}\n`,
  );
}

/**
 * Fails a surface scan when axe reports a serious or critical violation.
 *
 * @param surface Human-readable scanned surface.
 * @param reportName Filesystem-safe artifact name.
 * @param violations Serializable axe violations from the surface.
 * @returns Nothing when the blocking threshold is clear.
 */
export async function assertNoBlockingAxeViolations(
  surface: string,
  reportName: string,
  violations: readonly SerializableAxeViolation[],
): Promise<void> {
  const blocking = blockingAxeViolations(violations);
  if (blocking.length === 0) return;
  await writeFailureReport(reportName, violations);
  throw new Error(formatAxeViolations(surface, blocking));
}

/**
 * Installs pinned axe-core into a browser page without evaluating it in the Deno process.
 *
 * @param page Playwright page receiving axe-core.
 * @returns Nothing after the global `axe` runtime is available.
 */
export async function installAxe(page: Page): Promise<void> {
  await page.evaluate(AXE_SOURCE);
}

/**
 * Injects pinned axe-core into a page and scans its current document.
 *
 * @param page Playwright page containing a rendered extension surface.
 * @param surface Human-readable scanned surface.
 * @param reportName Filesystem-safe artifact name.
 * @returns All violations after enforcing the blocking threshold.
 */
export async function scanPageWithAxe(
  page: Page,
  surface: string,
  reportName: string,
): Promise<readonly SerializableAxeViolation[]> {
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    const axeRuntime = (globalThis as unknown as { readonly axe: AxeRuntime }).axe;
    const result = await axeRuntime.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map((violation) => ({
      help: violation.help,
      helpUrl: violation.helpUrl,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        failureSummary: node.failureSummary,
        target: node.target,
      })),
    }));
  });
  await assertNoBlockingAxeViolations(surface, reportName, violations);
  return violations;
}
