/// <reference lib="dom" />

import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type {
  ExportSizeBudget,
  ExtensionSettings,
  ScreenshotMaxDimension,
  ScreenshotQuality,
} from "../shared/settings.ts";
import {
  EXPORT_SIZE_BUDGET_OPTIONS,
  SCREENSHOT_MAX_DIMENSION_OPTIONS,
  SCREENSHOT_QUALITY_OPTIONS,
} from "../shared/settings.ts";
import type { Theme, ThemeOverride } from "../shared/theme.ts";
import { Button, Dialog, Icon, Select, Switch, Tabs } from "../ui/components/index.ts";
import type { OptionsRepository } from "./repository.ts";

const SECTIONS = ["General", "Capture", "Export & privacy", "Shortcuts", "Data"] as const;
type OptionsSection = typeof SECTIONS[number];

type OptionsStatus =
  | { readonly state: "idle" }
  | { readonly state: "saving" }
  | { readonly state: "clearing" }
  | { readonly state: "success"; readonly message: string }
  | { readonly state: "error"; readonly message: string };

/** Props accepted by {@link Options}. */
export interface OptionsProps {
  readonly autoTheme: Theme;
  readonly repository: OptionsRepository;
}

interface SettingRowProps {
  readonly children: ComponentChildren;
  readonly help: string;
  readonly label: string;
}

function SettingRow({ children, help, label }: SettingRowProps): JSX.Element {
  return (
    <label className="ps-options-row">
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
      <span className="ps-options-row__control">{children}</span>
    </label>
  );
}

function formatMegabytes(bytes: number): string {
  return `${bytes / 1_000_000} MB`;
}

function qualityLabel(quality: number): string {
  return `${Math.round(quality * 100)}%`;
}

function selectedTheme(value: string): ThemeOverride {
  return value === "dark" || value === "light" ? value : "auto";
}

function selectedExportBudget(value: string): ExportSizeBudget {
  const candidate = Number(value);
  return EXPORT_SIZE_BUDGET_OPTIONS.find((option) => option === candidate) ??
    EXPORT_SIZE_BUDGET_OPTIONS[0];
}

function selectedQuality(value: string): ScreenshotQuality {
  const candidate = Number(value);
  return SCREENSHOT_QUALITY_OPTIONS.find((option) => option === candidate) ??
    SCREENSHOT_QUALITY_OPTIONS[0];
}

function selectedMaximumDimension(value: string): ScreenshotMaxDimension {
  const candidate = Number(value);
  return SCREENSHOT_MAX_DIMENSION_OPTIONS.find((option) => option === candidate) ??
    SCREENSHOT_MAX_DIMENSION_OPTIONS[0];
}

/**
 * Renders the extension settings surface with auto-saved, validated controls.
 *
 * @param props Settings repository and the extension-page theme used for follow-backdrop mode.
 * @returns Loading, error, and complete options-page states.
 */
export function Options({ autoTheme, repository }: OptionsProps): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>();
  const [shortcut, setShortcut] = useState("Not assigned");
  const [section, setSection] = useState<OptionsSection>("General");
  const [status, setStatus] = useState<OptionsStatus>({ state: "idle" });
  const [confirmClear, setConfirmClear] = useState(false);
  const saveGeneration = useRef(0);
  const lastSavedSettings = useRef<ExtensionSettings>();

  useEffect(() => {
    let active = true;
    void repository.load()
      .then((snapshot) => {
        if (!active) return;
        setSettings(snapshot.settings);
        lastSavedSettings.current = snapshot.settings;
        setShortcut(snapshot.shortcut);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus({
          state: "error",
          message: cause instanceof Error ? cause.message : "Settings could not be loaded.",
        });
      });
    return () => {
      active = false;
    };
  }, [repository]);

  const resolvedTheme = settings?.themeOverride === "dark" ||
      settings?.themeOverride === "light"
    ? settings.themeOverride
    : autoTheme;
  const busy = status.state === "clearing";

  const update = (next: ExtensionSettings): void => {
    if (settings === undefined) return;
    const generation = ++saveGeneration.current;
    setSettings(next);
    setStatus({ state: "saving" });
    void repository.save(next)
      .then(() => {
        lastSavedSettings.current = next;
        if (generation === saveGeneration.current) {
          setStatus({ state: "success", message: "Saved." });
        }
      })
      .catch((cause: unknown) => {
        if (generation !== saveGeneration.current) return;
        setSettings(lastSavedSettings.current);
        setStatus({
          state: "error",
          message: cause instanceof Error ? cause.message : "Settings could not be saved.",
        });
      });
  };

  const clearAllSessions = (): void => {
    if (busy) return;
    setStatus({ state: "clearing" });
    void repository.clearSessions()
      .then(() => {
        setConfirmClear(false);
        setStatus({ state: "success", message: "All sessions cleared." });
      })
      .catch((cause: unknown) => {
        setConfirmClear(false);
        setStatus({
          state: "error",
          message: cause instanceof Error ? cause.message : "Sessions could not be cleared.",
        });
      });
  };

  const openShortcutSettings = (): void => {
    if (busy) return;
    setStatus({ state: "idle" });
    void repository.openShortcutSettings().catch((cause: unknown) => {
      setStatus({
        state: "error",
        message: cause instanceof Error
          ? cause.message
          : "Browser shortcut settings could not be opened.",
      });
    });
  };

  return (
    <main className="ps-options" data-theme={resolvedTheme}>
      <header className="ps-options-header">
        <span className="ps-options-header__mark">
          <Icon name="settings" size={20} />
        </span>
        <div>
          <p className="ps-eyebrow">Point & Shoot</p>
          <h1>Settings</h1>
        </div>
      </header>

      <nav className="ps-options-navigation">
        <Tabs
          active={section}
          onChange={(next) => {
            if (SECTIONS.includes(next as OptionsSection)) setSection(next as OptionsSection);
          }}
          tabs={SECTIONS}
        />
      </nav>

      {settings === undefined
        ? (
          <section aria-busy="true" className="ps-options-content">
            <p>{status.state === "error" ? "Settings are unavailable." : "Loading settings…"}</p>
          </section>
        )
        : (
          <section className="ps-options-content">
            {section === "General"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>General</h2>
                    <p>
                      Choose how the extension looks and how much page internals it may inspect.
                    </p>
                  </div>
                  <SettingRow
                    help="Follow the inspected page backdrop, or force dark or light."
                    label="Theme"
                  >
                    <Select
                      onChange={(value) =>
                        update({ ...settings, themeOverride: selectedTheme(value) })}
                      options={[
                        { label: "Follow backdrop", value: "auto" },
                        { label: "Dark", value: "dark" },
                        { label: "Light", value: "light" },
                      ]}
                      value={settings.themeOverride}
                    />
                  </SettingRow>
                  <SettingRow
                    help="Opt in to reading framework-specific page internals for component names."
                    label="Framework component hints"
                  >
                    <Switch
                      checked={settings.frameworkHints}
                      onChange={(checked) => update({ ...settings, frameworkHints: checked })}
                    />
                  </SettingRow>
                </>
              )
              : null}

            {section === "Capture"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Capture</h2>
                    <p>Control WebP encoding without changing the captured region geometry.</p>
                  </div>
                  <SettingRow
                    help="Higher quality preserves more detail and produces larger session records."
                    label="Screenshot quality"
                  >
                    <Select
                      onChange={(value) =>
                        update({ ...settings, screenshotQuality: selectedQuality(value) })}
                      options={SCREENSHOT_QUALITY_OPTIONS.map((quality) => ({
                        label: qualityLabel(quality),
                        value: String(quality),
                      }))}
                      value={String(settings.screenshotQuality)}
                    />
                  </SettingRow>
                  <SettingRow
                    help="Longer image edges are downscaled to this limit."
                    label="Maximum screenshot dimension"
                  >
                    <Select
                      onChange={(value) =>
                        update({
                          ...settings,
                          screenshotMaxDimension: selectedMaximumDimension(value),
                        })}
                      options={SCREENSHOT_MAX_DIMENSION_OPTIONS.map((dimension) => ({
                        label: `${dimension} px`,
                        value: String(dimension),
                      }))}
                      value={String(settings.screenshotMaxDimension)}
                    />
                  </SettingRow>
                </>
              )
              : null}

            {section === "Export & privacy"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Export & privacy</h2>
                    <p>Set the bundle warning limit and the default treatment of sensitive URLs.</p>
                  </div>
                  <SettingRow
                    help="Exports above this measured agent-ingestion budget are blocked."
                    label="Export size budget"
                  >
                    <Select
                      onChange={(value) =>
                        update({
                          ...settings,
                          exportSizeBudgetBytes: selectedExportBudget(value),
                        })}
                      options={EXPORT_SIZE_BUDGET_OPTIONS.map((bytes) => ({
                        label: formatMegabytes(bytes),
                        value: String(bytes),
                      }))}
                      value={String(settings.exportSizeBudgetBytes)}
                    />
                  </SettingRow>
                  <SettingRow
                    help="Default new notes to removing queries whose names look like credentials."
                    label="Strip sensitive query strings"
                  >
                    <Switch
                      checked={settings.stripSensitiveQueries}
                      onChange={(checked) =>
                        update({ ...settings, stripSensitiveQueries: checked })}
                    />
                  </SettingRow>
                </>
              )
              : null}

            {section === "Shortcuts"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Shortcuts</h2>
                    <p>The browser owns shortcut assignment; the extension can only display it.</p>
                  </div>
                  <div className="ps-options-row">
                    <span>
                      <strong>Toggle capture</strong>
                      <small>Show or hide the overlay on the active tab.</small>
                    </span>
                    <span className="ps-options-shortcut">{shortcut}</span>
                  </div>
                  <div className="ps-options-section-action">
                    <Button onClick={openShortcutSettings} variant="secondary">
                      Manage browser shortcuts
                    </Button>
                  </div>
                </>
              )
              : null}

            {section === "Data"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Stored data</h2>
                    <p>Captured screenshots and notes stay in extension-owned local storage.</p>
                  </div>
                  <div className="ps-options-danger">
                    <div>
                      <h3>Clear all sessions</h3>
                      <p>
                        Permanently delete every session, note, and screenshot. Settings are kept.
                      </p>
                    </div>
                    <Button
                      disabled={busy}
                      icon={<Icon name="trash-2" />}
                      onClick={() => setConfirmClear(true)}
                      variant="danger"
                    >
                      Clear all sessions
                    </Button>
                  </div>
                </>
              )
              : null}
          </section>
        )}

      <footer className="ps-options-footer">
        {status.state === "saving" ? <p role="status">Saving…</p> : null}
        {status.state === "clearing" ? <p role="status">Clearing sessions…</p> : null}
        {status.state === "success" ? <p role="status">{status.message}</p> : null}
        {status.state === "error" ? <p role="alert">{status.message}</p> : null}
      </footer>

      <Dialog
        footer={
          <>
            <Button disabled={busy} onClick={() => setConfirmClear(false)} variant="ghost">
              Cancel
            </Button>
            <Button disabled={busy} onClick={clearAllSessions} variant="danger">
              {status.state === "clearing" ? "Clearing…" : "Clear all sessions"}
            </Button>
          </>
        }
        onClose={() => {
          if (!busy) setConfirmClear(false);
        }}
        open={confirmClear}
        title="Clear all sessions?"
      >
        This cannot be undone. Export any sessions you need before continuing.
      </Dialog>
    </main>
  );
}
