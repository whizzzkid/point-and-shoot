import type { BrowserShim } from "./browser.ts";
import { DEFAULT_EXPORT_SIZE_BUDGET_BYTES } from "./session.ts";
import type { ThemeOverride } from "./theme.ts";

/** Extension-storage key containing the complete versioned settings record. */
export const SETTINGS_STORAGE_KEY = "settings";

/** Export budgets presented by the options page, in decimal bytes. */
export const EXPORT_SIZE_BUDGET_OPTIONS = [
  1_000_000,
  DEFAULT_EXPORT_SIZE_BUDGET_BYTES,
  4_000_000,
  8_000_000,
] as const;

/** WebP quality values presented by the options page. */
export const SCREENSHOT_QUALITY_OPTIONS = [0.5, 0.7, 0.85, 1] as const;

/** Longest-edge limits presented by the options page, in pixels. */
export const SCREENSHOT_MAX_DIMENSION_OPTIONS = [512, 1_024, 2_048] as const;

/** Supported export-budget values. */
export type ExportSizeBudget = typeof EXPORT_SIZE_BUDGET_OPTIONS[number];

/** Supported WebP encoder quality values. */
export type ScreenshotQuality = typeof SCREENSHOT_QUALITY_OPTIONS[number];

/** Supported screenshot longest-edge values. */
export type ScreenshotMaxDimension = typeof SCREENSHOT_MAX_DIMENSION_OPTIONS[number];

/** Versioned settings shared by every extension surface and background consumer. */
export interface ExtensionSettings {
  readonly exportSizeBudgetBytes: ExportSizeBudget;
  readonly frameworkHints: boolean;
  readonly schemaVersion: 1;
  readonly screenshotMaxDimension: ScreenshotMaxDimension;
  readonly screenshotQuality: ScreenshotQuality;
  readonly stripSensitiveQueries: boolean;
  readonly themeOverride: ThemeOverride;
}

/** Settled defaults used when settings have not been saved or cannot be validated. */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  exportSizeBudgetBytes: DEFAULT_EXPORT_SIZE_BUDGET_BYTES,
  frameworkHints: false,
  schemaVersion: 1,
  screenshotMaxDimension: 1_024,
  screenshotQuality: 0.7,
  stripSensitiveQueries: true,
  themeOverride: "auto",
};

type SettingsStorage = Pick<BrowserShim["storage"]["local"], "get" | "set">;

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

function hasExactKeys(candidate: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(candidate);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isAllowedNumber<const Values extends readonly number[]>(
  candidate: unknown,
  values: Values,
): candidate is Values[number] {
  return typeof candidate === "number" && values.includes(candidate);
}

/**
 * Validates an unknown persisted value as the current settings schema.
 *
 * @param candidate Value read from extension storage.
 * @returns Whether the value is an exact, supported settings record.
 */
export function isExtensionSettings(candidate: unknown): candidate is ExtensionSettings {
  return isRecord(candidate) &&
    hasExactKeys(candidate, [
      "exportSizeBudgetBytes",
      "frameworkHints",
      "schemaVersion",
      "screenshotMaxDimension",
      "screenshotQuality",
      "stripSensitiveQueries",
      "themeOverride",
    ]) &&
    candidate.schemaVersion === 1 &&
    isAllowedNumber(candidate.exportSizeBudgetBytes, EXPORT_SIZE_BUDGET_OPTIONS) &&
    typeof candidate.frameworkHints === "boolean" &&
    isAllowedNumber(candidate.screenshotMaxDimension, SCREENSHOT_MAX_DIMENSION_OPTIONS) &&
    isAllowedNumber(candidate.screenshotQuality, SCREENSHOT_QUALITY_OPTIONS) &&
    typeof candidate.stripSensitiveQueries === "boolean" &&
    ["auto", "dark", "light"].includes(candidate.themeOverride as string);
}

/**
 * Loads validated settings, recovering an absent or corrupt record with settled defaults.
 *
 * @param storage Promise-based extension-local storage.
 * @returns A fresh settings object safe for runtime consumers.
 */
export async function loadSettings(storage: SettingsStorage): Promise<ExtensionSettings> {
  const stored = await storage.get(SETTINGS_STORAGE_KEY);
  const candidate = stored[SETTINGS_STORAGE_KEY];
  return isExtensionSettings(candidate) ? { ...candidate } : { ...DEFAULT_SETTINGS };
}

/**
 * Persists one complete settings record after runtime validation.
 *
 * @param storage Promise-based extension-local storage.
 * @param settings Complete settings record.
 * @returns Nothing after the write is durable.
 */
export async function saveSettings(
  storage: SettingsStorage,
  settings: ExtensionSettings,
): Promise<void> {
  if (!isExtensionSettings(settings)) throw new TypeError("Invalid extension settings.");
  await storage.set({ [SETTINGS_STORAGE_KEY]: { ...settings } });
}
