/// <reference lib="dom" />

import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type {
  ExtensionSettings,
  ScreenshotMaxDimension,
  ScreenshotQuality,
} from "../shared/settings.ts";
import {
  SCREENSHOT_MAX_DIMENSION_OPTIONS,
  SCREENSHOT_QUALITY_OPTIONS,
} from "../shared/settings.ts";
import type { Theme, ThemeOverride } from "../shared/theme.ts";
import {
  Button,
  Dialog,
  Icon,
  Input,
  Select,
  Switch,
  Tabs,
  VersionLabel,
} from "../ui/components/index.ts";
import type { OptionsRepository } from "./repository.ts";
import type { Session } from "../shared/schema.ts";

const SECTIONS = [
  "General",
  "Capture",
  "Plan prompt",
  "Export & privacy",
  "Shortcuts",
  "Sessions",
  "Data",
] as const;
type OptionsSection = typeof SECTIONS[number];

interface SessionListEntry {
  readonly session: Session;
  readonly noteCount: number;
  readonly status: "running" | "paused" | "completed";
  readonly displayDomain: string;
}

function toEntry(session: Session): SessionListEntry {
  // Session.pausedAt is added by ADR-0022 (feat/session-pause-resume); PR4's base predates that
  // change, so we read it defensively. After the pause/resume PR merges the cast is a no-op.
  const pausedAt = (session as { readonly pausedAt?: string | null }).pausedAt;
  const status: SessionListEntry["status"] = session.endedAt !== null
    ? "completed"
    : pausedAt != null
    ? "paused"
    : "running";
  return {
    session,
    noteCount: session.notes.length,
    status,
    displayDomain: session.domain ?? "No domain",
  };
}

function groupByDomain(
  entries: readonly SessionListEntry[],
): readonly (readonly [string, readonly SessionListEntry[]])[] {
  const groups = new Map<string, SessionListEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.displayDomain);
    if (existing === undefined) groups.set(entry.displayDomain, [entry]);
    else existing.push(entry);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

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
  readonly version: string;
}

interface SettingRowProps {
  readonly children: ComponentChildren;
  readonly help: string;
  readonly label: string;
}

interface SessionListItemProps {
  readonly entry: SessionListEntry;
  readonly onLoad: () => void;
  readonly onDelete: () => void;
  readonly showDomain?: boolean;
}

function SessionListItem(
  { entry, onLoad, onDelete, showDomain = false }: SessionListItemProps,
): JSX.Element {
  return (
    <li className="ps-options-session-item">
      <div className="ps-options-session-meta">
        <span className="ps-options-session-name">{entry.session.name}</span>
        <span className="ps-options-session-details">
          {showDomain ? <span>{entry.displayDomain} ·</span> : null}
          <span>{formatCreatedAt(entry.session.createdAt)}</span>
          <span>· {entry.noteCount} {entry.noteCount === 1 ? "note" : "notes"}</span>
          <span className={`ps-options-session-status ps-options-session-status-${entry.status}`}>
            {" · "}
            {entry.status[0]?.toUpperCase() ?? ""}
            {entry.status.slice(1)}
          </span>
        </span>
      </div>
      <div className="ps-options-session-actions">
        <button type="button" onClick={onLoad}>Load in side panel</button>
        <button type="button" onClick={onDelete} className="ps-options-danger-button">
          Delete
        </button>
      </div>
    </li>
  );
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

function qualityLabel(quality: number): string {
  return `${Math.round(quality * 100)}%`;
}

function selectedTheme(value: string): ThemeOverride {
  return value === "dark" || value === "light" ? value : "auto";
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
 * @param props Settings repository, extension-page theme, and displayed version.
 * @returns Loading, error, and complete options-page states.
 */
export function Options({ autoTheme, repository, version }: OptionsProps): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>();
  const [shortcut, setShortcut] = useState("Not assigned");
  const [section, setSection] = useState<OptionsSection>("General");
  const [status, setStatus] = useState<OptionsStatus>({ state: "idle" });
  const [confirmClear, setConfirmClear] = useState(false);
  const [sessions, setSessions] = useState<readonly SessionListEntry[]>();
  const [groupByDomainOn, setGroupByDomainOn] = useState(false);
  const [sessionError, setSessionError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<SessionListEntry>();
  const saveGeneration = useRef(0);
  const lastSavedSettings = useRef<ExtensionSettings>();

  const reloadSessions = (): void => {
    setSessionError(undefined);
    void repository.listAllSessions()
      .then((records) => setSessions(records.map(toEntry)))
      .catch((cause: unknown) => {
        setSessionError(cause instanceof Error ? cause.message : "Sessions could not be loaded.");
      });
  };

  useEffect(() => {
    if (section !== "Sessions") return;
    reloadSessions();
    void repository.readGroupByDomain().then(setGroupByDomainOn).catch(() => undefined);
  }, [section, repository]);

  const onLoadSession = (entry: SessionListEntry): void => {
    setSessionError(undefined);
    void repository.openSessionInSidePanel(entry.session.id).catch((cause: unknown) => {
      setSessionError(
        cause instanceof Error ? cause.message : "The side panel could not be opened.",
      );
    });
  };

  const onDeleteSession = (entry: SessionListEntry): void => {
    setSessionError(undefined);
    setConfirmDelete(undefined);
    void repository.deleteSessionById(entry.session.id)
      .then(reloadSessions)
      .catch((cause: unknown) => {
        setSessionError(
          cause instanceof Error ? cause.message : "The session could not be deleted.",
        );
      });
  };

  const toggleGroupByDomain = (next: boolean): void => {
    setGroupByDomainOn(next);
    void repository.writeGroupByDomain(next).catch(() => undefined);
  };

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
                    help="Opt in to page internals for component names and source locations."
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

            {section === "Plan prompt"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Plan prompt</h2>
                    <p>
                      Wrap every generated plan with your own instructions. The header leads the
                      captured notes and the footer trails them in the exported plan.md and in every
                      clipboard copy. Edit these again on the compile-plan step.
                    </p>
                  </div>
                  <SettingRow
                    help="Leading text prepended to every generated plan."
                    label="Header prompt"
                  >
                    <Input
                      accessibleName="Header prompt"
                      multiline
                      onChange={(value) => update({ ...settings, defaultHeaderPrompt: value })}
                      placeholder="// Use my custom skills to plan and execute on this."
                      rows={4}
                      value={settings.defaultHeaderPrompt}
                    />
                  </SettingRow>
                  <SettingRow
                    help="Trailing text appended to every generated plan."
                    label="Footer prompt"
                  >
                    <Input
                      accessibleName="Footer prompt"
                      multiline
                      onChange={(value) => update({ ...settings, defaultFooterPrompt: value })}
                      placeholder="// Work hard, don't make mistakes."
                      rows={4}
                      value={settings.defaultFooterPrompt}
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
                    <p>Set the default treatment of sensitive URLs.</p>
                  </div>
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

            {section === "Sessions"
              ? (
                <>
                  <div className="ps-options-section-heading">
                    <h2>Sessions</h2>
                    <p>
                      Load a session back into the side panel, delete individual sessions, or group
                      the list by the domain each session started on.
                    </p>
                  </div>
                  <SettingRow
                    label="Group by domain"
                    help="Collect sessions by the hostname captured at their start."
                  >
                    <label className="ps-options-toggle">
                      <input
                        checked={groupByDomainOn}
                        onInput={(event) =>
                          toggleGroupByDomain((event.currentTarget as HTMLInputElement).checked)}
                        type="checkbox"
                      />
                      <span>{groupByDomainOn ? "On" : "Off"}</span>
                    </label>
                  </SettingRow>

                  {sessionError !== undefined
                    ? <p role="alert" className="ps-options-inline-error">{sessionError}</p>
                    : null}

                  {sessions === undefined
                    ? <p role="status">Loading…</p>
                    : sessions.length === 0
                    ? <p>No sessions captured yet.</p>
                    : groupByDomainOn
                    ? (
                      <>
                        {groupByDomain(sessions).map(([domain, entries]) => (
                          <details key={domain} className="ps-options-session-group">
                            <summary>
                              <strong>{domain}</strong>
                              <span className="ps-options-session-group-count">
                                {entries.length}
                              </span>
                            </summary>
                            <ul className="ps-options-session-list">
                              {entries.map((entry) => (
                                <SessionListItem
                                  key={entry.session.id}
                                  entry={entry}
                                  onLoad={() => onLoadSession(entry)}
                                  onDelete={() =>
                                    setConfirmDelete(entry)}
                                />
                              ))}
                            </ul>
                          </details>
                        ))}
                      </>
                    )
                    : (
                      <ul className="ps-options-session-list">
                        {sessions.map((entry) => (
                          <SessionListItem
                            key={entry.session.id}
                            entry={entry}
                            onLoad={() => onLoadSession(entry)}
                            onDelete={() => setConfirmDelete(entry)}
                            showDomain
                          />
                        ))}
                      </ul>
                    )}
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
      <Dialog
        footer={
          <>
            <button type="button" onClick={() => setConfirmDelete(undefined)}>Cancel</button>
            <button
              type="button"
              className="ps-options-danger-button"
              onClick={() => confirmDelete && onDeleteSession(confirmDelete)}
            >
              Delete
            </button>
          </>
        }
        onClose={() => setConfirmDelete(undefined)}
        open={confirmDelete !== undefined}
        title="Delete this session?"
      >
        {confirmDelete
          ? `"${confirmDelete.session.name}" and its ${confirmDelete.noteCount} note${
            confirmDelete.noteCount === 1 ? "" : "s"
          } will be removed. This cannot be undone.`
          : ""}
      </Dialog>
      <VersionLabel version={version} />
    </main>
  );
}
