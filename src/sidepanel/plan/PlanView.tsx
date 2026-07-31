/// <reference lib="dom" />

import type { JSX } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { Session } from "../../shared/schema.ts";
import { toMarkdown } from "../../shared/serialize/index.ts";
import { createExportArchive } from "../../shared/serialize/zip.ts";
import { Badge, Button, CaptureMinimap, Checkbox, Icon } from "../../ui/components/index.ts";

/** Export actions invoked by the plan view after it validates the current selection. */
export interface PlanViewActions {
  readonly copy: (includedNoteIds: ReadonlySet<string>) => Promise<void>;
  readonly downloadBundle: (includedNoteIds: ReadonlySet<string>) => Promise<void>;
  readonly downloadPrompt: (includedNoteIds: ReadonlySet<string>) => Promise<void>;
}

/** Props accepted by {@link PlanView}. */
export interface PlanViewProps {
  readonly actions: PlanViewActions;
  readonly onBack: () => void;
  readonly session: Session;
  readonly sizeBudgetBytes: number;
}

type ActionState =
  | { readonly status: "idle" }
  | {
    readonly status: "busy";
    readonly action: "copy" | "download-bundle" | "download-prompt";
  }
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

function formatBytes(bytes: number): string {
  if (bytes === 1) return "1 byte";
  if (bytes < 1_000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1_000)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function selectionFor(session: Session, selected: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(session.notes.filter((note) => selected.has(note.id)).map((note) => note.id));
}

/**
 * Renders the generated plan preview, note selection, privacy disclosure, and export actions.
 *
 * @param props Session, exact size budget, delivery actions, and back navigation.
 * @returns The complete plan workspace.
 */
export function PlanView(
  { actions, onBack, session, sizeBudgetBytes }: PlanViewProps,
): JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(session.notes.map((note) => note.id)),
  );
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const includedNoteIds = useMemo(() => selectionFor(session, selected), [session, selected]);
  const markdownProjection = useMemo(() => {
    try {
      return {
        status: "ready" as const,
        markdown: toMarkdown(session, { includedNoteIds, includeImageReferences: false }),
      };
    } catch (cause) {
      return {
        status: "error" as const,
        message: cause instanceof Error ? cause.message : "The prompt could not be built.",
      };
    }
  }, [includedNoteIds, session]);
  const archiveProjection = useMemo(() => {
    try {
      return {
        status: "ready" as const,
        bytes: createExportArchive(session, { includedNoteIds }).byteLength,
      };
    } catch (cause) {
      return {
        status: "error" as const,
        message: cause instanceof Error ? cause.message : "The export bundle could not be built.",
      };
    }
  }, [includedNoteIds, session]);
  const selectedCount = includedNoteIds.size;
  const archiveBytes = archiveProjection.status === "ready" ? archiveProjection.bytes : 0;
  const isOverBudget = archiveProjection.status === "ready" &&
    archiveBytes > sizeBudgetBytes;
  const isBusy = actionState.status === "busy";
  const promptIsBlocked = selectedCount === 0 || markdownProjection.status === "error" || isBusy;
  const bundleIsBlocked = selectedCount === 0 || archiveProjection.status === "error" || isBusy;

  const replaceSelection = (next: ReadonlySet<string>): void => {
    setActionState({ status: "idle" });
    setSelected(next);
  };

  const toggleNote = (id: string, checked: boolean): void => {
    if (isBusy) return;
    setActionState({ status: "idle" });
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runAction = (
    action: "copy" | "download-bundle" | "download-prompt",
    operation: () => Promise<void>,
  ): void => {
    setActionState({ status: "busy", action });
    void Promise.resolve()
      .then(operation)
      .then(() => {
        setActionState({
          status: "success",
          message: action === "copy"
            ? "Prompt copied."
            : action === "download-prompt"
            ? "Prompt download started."
            : "Bundle download started.",
        });
      })
      .catch((cause: unknown) => {
        setActionState({
          status: "error",
          message: cause instanceof Error ? cause.message : "The export action failed.",
        });
      });
  };

  return (
    <main className="ps-plan-view">
      <header className="ps-plan-header">
        <div>
          <p className="ps-eyebrow">Agent-ready export</p>
          <h1>Compile plan</h1>
          <p>
            {selectedCount} of {session.notes.length}{" "}
            {session.notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <Button autoFocus onClick={onBack} variant="ghost">Back to notes</Button>
      </header>

      <div className="ps-plan-layout">
        <aside className="ps-plan-selection">
          <div className="ps-plan-selection__header">
            <div>
              <p className="ps-eyebrow">Included notes</p>
              <h2>Choose evidence</h2>
            </div>
            <Badge>{selectedCount}</Badge>
          </div>
          <div className="ps-plan-selection__bulk">
            <Button
              disabled={isBusy || selectedCount === session.notes.length}
              onClick={() => replaceSelection(new Set(session.notes.map((note) => note.id)))}
              size="sm"
              variant="ghost"
            >
              Include all
            </Button>
            <Button
              disabled={isBusy || selectedCount === 0}
              onClick={() => replaceSelection(new Set())}
              size="sm"
              variant="ghost"
            >
              Exclude all
            </Button>
          </div>
          <div className="ps-plan-note-list">
            {session.notes.map((note) => (
              <article className="ps-plan-note" key={note.id}>
                <CaptureMinimap
                  label={`Captured region — ${note.pageTitle || "Untitled page"}`}
                  screenshot={note.region.screenshot}
                  truncated={note.region.truncated}
                />
                <div>
                  <Checkbox
                    checked={selected.has(note.id)}
                    disabled={isBusy}
                    label={`Include ${note.pageTitle || "Untitled page"}`}
                    onChange={(checked) => toggleNote(note.id, checked)}
                  />
                  <p>{note.text || "No note text was provided."}</p>
                  <span className="ps-technical-value" title={note.pageUrl}>{note.pageUrl}</span>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="ps-plan-preview">
          <div className="ps-plan-preview__header">
            <div>
              <p className="ps-eyebrow">Generated prompt</p>
              <h2>Markdown preview</h2>
            </div>
            <span className="ps-technical-value">plan.md</span>
          </div>
          <div className="ps-plan-preview__actions">
            <Button
              disabled={promptIsBlocked}
              onClick={() => runAction("copy", () => actions.copy(includedNoteIds))}
              variant="secondary"
            >
              {actionState.status === "busy" && actionState.action === "copy"
                ? "Copying…"
                : "Copy prompt"}
            </Button>
            <Button
              disabled={promptIsBlocked}
              onClick={() =>
                runAction(
                  "download-prompt",
                  () => actions.downloadPrompt(includedNoteIds),
                )}
              variant="secondary"
            >
              {actionState.status === "busy" && actionState.action === "download-prompt"
                ? "Preparing…"
                : "Download prompt"}
            </Button>
            <Button
              disabled={bundleIsBlocked}
              icon={<Icon name="list-checks" />}
              onClick={() =>
                runAction(
                  "download-bundle",
                  () => actions.downloadBundle(includedNoteIds),
                )}
            >
              {actionState.status === "busy" && actionState.action === "download-bundle"
                ? "Preparing…"
                : "Download bundle"}
            </Button>
          </div>
          {markdownProjection.status === "ready"
            ? (
              <pre aria-label="Generated Markdown preview" data-markdown-preview tabIndex={0}>
                {markdownProjection.markdown}
              </pre>
            )
            : <p className="ps-panel-error" role="alert">{markdownProjection.message}</p>}
          {actionState.status === "success"
            ? <p className="ps-plan-status" role="status">{actionState.message}</p>
            : null}
          {actionState.status === "error"
            ? <p className="ps-panel-error" role="alert">{actionState.message}</p>
            : null}
        </section>
      </div>

      <footer className="ps-plan-footer">
        <div className="ps-plan-disclosure">
          <Icon name="list-checks" />
          <div>
            <h2>Review what leaves this device</h2>
            <p>
              The bundle contains screenshots, page URLs, DOM text, selectors, and computed styles.
              Treat it like any other file you would paste into a chat. A hosted agent may receive
              data captured from authenticated pages.
            </p>
            <p>
              Sensitive query parameters are stripped by default. Change each note’s export setting
              from the notes view.
            </p>
          </div>
        </div>

        <div className="ps-plan-actions">
          <div
            className="ps-export-budget"
            data-export-budget
            data-over-budget={isOverBudget}
          >
            <div>
              <span>{formatBytes(archiveBytes)} of {formatBytes(sizeBudgetBytes)}</span>
              <span>ZIP bundle</span>
            </div>
            <progress max={sizeBudgetBytes} value={Math.min(archiveBytes, sizeBudgetBytes)} />
            {isOverBudget
              ? (
                <p role="alert">
                  The selected bundle is above the {formatBytes(sizeBudgetBytes)}{" "}
                  warning threshold. Copy and download remain available.
                </p>
              )
              : null}
            {archiveProjection.status === "error"
              ? <p role="alert">{archiveProjection.message}</p>
              : null}
          </div>
        </div>
      </footer>
    </main>
  );
}
