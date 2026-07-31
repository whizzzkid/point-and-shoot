/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Session } from "../shared/schema.ts";
import { Badge, Button, Icon, Switch, VersionLabel } from "../ui/components/index.ts";
import type { PopupActions } from "./actions.ts";
import type { PopupSessionRepository } from "./repository.ts";

export type { PopupActions } from "./actions.ts";
export type { PopupSessionRepository } from "./repository.ts";

/** Props accepted by {@link Popup}. */
export interface PopupProps {
  readonly actions: PopupActions;
  readonly repository: PopupSessionRepository;
  readonly theme: "dark" | "light";
  readonly version: string;
}

type PopupStatus =
  | { readonly state: "idle" }
  | { readonly state: "success"; readonly message: string }
  | { readonly state: "error"; readonly message: string };

type PopupAction = "notes" | "options" | "overlay" | "session";

/**
 * Renders the compact session launcher shown in extension chrome.
 *
 * @param props Session repository, platform actions, and forced theme.
 * @returns The popup loading, launcher, and error states.
 */
export function Popup({ actions, repository, theme, version }: PopupProps): JSX.Element {
  const [session, setSession] = useState<Session | null>();
  const [overlayOn, setOverlayOn] = useState<boolean>();
  const [busy, setBusy] = useState<PopupAction>();
  const [status, setStatus] = useState<PopupStatus>({ state: "idle" });

  useEffect(() => {
    let active = true;
    void Promise.all([repository.load(), actions.readOverlay()])
      .then(([loadedSession, mounted]) => {
        if (!active) return;
        setSession(loadedSession);
        setOverlayOn(mounted);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSession(null);
        setOverlayOn(false);
        setStatus({
          state: "error",
          message: cause instanceof Error ? cause.message : "The popup could not load.",
        });
      });
    return () => {
      active = false;
    };
  }, [actions, repository]);

  const run = (
    action: PopupAction,
    operation: () => Promise<void>,
    successMessage?: string,
  ): void => {
    setBusy(action);
    setStatus({ state: "idle" });
    void Promise.resolve()
      .then(operation)
      .then(() => {
        if (successMessage !== undefined) {
          setStatus({ state: "success", message: successMessage });
        }
      })
      .catch((cause: unknown) => {
        setStatus({
          state: "error",
          message: cause instanceof Error ? cause.message : "The action could not finish.",
        });
      })
      .finally(() => setBusy(undefined));
  };

  const ensureSession = async (): Promise<Session> => {
    if (session !== null && session !== undefined) return session;
    const active = await repository.startOrResume();
    setSession(active);
    return active;
  };

  const setOverlay = (requested: boolean): void => {
    if (busy !== undefined || requested === overlayOn) return;
    run("overlay", async () => {
      if (requested) await ensureSession();
      setOverlayOn(await actions.toggleOverlay());
    });
  };

  const startOrResume = (): void => {
    if (busy !== undefined) return;
    run(
      "session",
      async () => {
        await ensureSession();
        if (!overlayOn) setOverlayOn(await actions.toggleOverlay());
      },
      "Session ready.",
    );
  };

  const isLoading = session === undefined || overlayOn === undefined;
  const noteCount = session?.notes.length ?? 0;

  return (
    <main className="ps-popup" data-theme={theme}>
      <header className="ps-popup-header">
        <span className="ps-popup-brand-mark">
          <Icon name="crosshair" size={16} />
        </span>
        <span className="ps-popup-brand">Point & Shoot</span>
        <Badge tone={overlayOn ? "success" : "neutral"}>
          {overlayOn ? "On" : "Off"}
        </Badge>
      </header>

      <section className="ps-popup-session">
        <p className="ps-eyebrow">Current session</p>
        <div className="ps-popup-session__heading">
          <h1>{isLoading ? "Loading session…" : session?.name ?? "No active session"}</h1>
          {session === null || session === undefined
            ? null
            : <Badge>{noteCount} {noteCount === 1 ? "note" : "notes"}</Badge>}
        </div>
        <p>
          {session === null
            ? "Start a session to capture an issue on the active tab."
            : session === undefined
            ? "Reading extension storage."
            : "Resume capturing or review the notes already collected."}
        </p>
      </section>

      <section className="ps-popup-controls">
        <label aria-disabled={busy !== undefined} className="ps-popup-overlay-toggle">
          <span>
            <strong>Overlay on this tab</strong>
            <small>{overlayOn ? "Ready to capture" : "Hidden on the page"}</small>
          </span>
          <Switch checked={overlayOn ?? false} onChange={setOverlay} />
        </label>

        <Button
          disabled={isLoading || busy !== undefined || overlayOn}
          onClick={startOrResume}
          size="lg"
        >
          {busy === "session"
            ? "Starting…"
            : session === null
            ? "Start session"
            : overlayOn
            ? "Session active"
            : "Resume session"}
        </Button>

        <div className="ps-popup-links">
          <Button
            disabled={isLoading || busy !== undefined}
            icon={<Icon name="list-checks" />}
            onClick={() => run("notes", actions.openNotes)}
            variant="secondary"
          >
            Open notes panel
          </Button>
          <Button
            disabled={busy !== undefined}
            icon={<Icon name="settings" />}
            onClick={() => run("options", actions.openOptions)}
            variant="ghost"
          >
            Open options
          </Button>
        </div>
      </section>

      {status.state === "success"
        ? <p className="ps-popup-status" role="status">{status.message}</p>
        : null}
      {status.state === "error"
        ? <p className="ps-popup-error" role="alert">{status.message}</p>
        : null}
      <VersionLabel version={version} />
    </main>
  );
}
