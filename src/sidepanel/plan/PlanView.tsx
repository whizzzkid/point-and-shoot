/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Session } from "../../shared/schema.ts";
import { toMarkdown } from "../../shared/serialize/index.ts";
import { createExportArchive } from "../../shared/serialize/zip.ts";
import { Badge, Button, CaptureMinimap, Checkbox, Icon, Input } from "../../ui/components/index.ts";
import { promptFilename } from "./delivery.ts";

/** Per-export header and footer prompt parts captured from the editable boxes. */
export interface PromptParts {
  readonly footerPrompt: string;
  readonly headerPrompt: string;
}

/** Export actions invoked by the plan view after it validates the current selection. */
export interface PlanViewActions {
  readonly copy: (includedNoteIds: ReadonlySet<string>, prompts: PromptParts) => Promise<void>;
  readonly downloadBundle: (
    includedNoteIds: ReadonlySet<string>,
    prompts: PromptParts,
  ) => Promise<void>;
  readonly downloadPrompt: (
    includedNoteIds: ReadonlySet<string>,
    prompts: PromptParts,
  ) => Promise<void>;
}

/** Props accepted by {@link PlanView}. */
export interface PlanViewProps {
  readonly actions: PlanViewActions;
  readonly defaultFooterPrompt: string;
  readonly defaultHeaderPrompt: string;
  readonly onBack: () => void;
  readonly session: Session;
}

type ActionState =
  | { readonly status: "idle" }
  | {
    readonly status: "busy";
    readonly action: "copy" | "download-bundle" | "download-prompt";
  }
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

function selectionFor(session: Session, selected: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(session.notes.filter((note) => selected.has(note.id)).map((note) => note.id));
}

/**
 * Renders the generated plan preview, note selection, privacy disclosure, and export actions.
 *
 * The header and footer prompt boxes are editable per-export; their contents change only this
 * export and never write back to settings. The generated plan between them stays read-only.
 *
 * @param props Session, delivery actions, default prompt parts, and back navigation.
 * @returns The complete plan workspace.
 */
export function PlanView(
  { actions, defaultFooterPrompt, defaultHeaderPrompt, onBack, session }: PlanViewProps,
): JSX.Element {
  const viewRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(session.notes.map((note) => note.id)),
  );
  const [headerPrompt, setHeaderPrompt] = useState(defaultHeaderPrompt);
  const [footerPrompt, setFooterPrompt] = useState(defaultFooterPrompt);
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  // Defaults arrive async via the settings load; re-seed the per-export boxes when they land so a
  // plan view opened before settings resolve still reflects the configured prompts.
  useEffect(() => {
    setHeaderPrompt(defaultHeaderPrompt);
    setFooterPrompt(defaultFooterPrompt);
  }, [defaultFooterPrompt, defaultHeaderPrompt]);
  const includedNoteIds = useMemo(() => selectionFor(session, selected), [session, selected]);
  const markdownProjection = useMemo(() => {
    try {
      return {
        status: "ready" as const,
        markdown: toMarkdown(session, {
          footerPrompt,
          headerPrompt,
          includedNoteIds,
          includeImageReferences: false,
        }),
      };
    } catch (cause) {
      return {
        status: "error" as const,
        message: cause instanceof Error ? cause.message : "The prompt could not be built.",
      };
    }
  }, [footerPrompt, headerPrompt, includedNoteIds, session]);
  const archiveProjection = useMemo(() => {
    try {
      // Header/footer prompt text cannot affect archive validity (createExportArchive only
      // fails on bad screenshot data), so they're intentionally excluded from the deps below —
      // including them would re-encode every screenshot on each keystroke in the prompt boxes.
      createExportArchive(session, { includedNoteIds });
      return {
        status: "ready" as const,
      };
    } catch (cause) {
      return {
        status: "error" as const,
        message: cause instanceof Error ? cause.message : "The export bundle could not be built.",
      };
    }
  }, [includedNoteIds, session]);
  const selectedCount = includedNoteIds.size;
  const isBusy = actionState.status === "busy";
  const promptIsBlocked = selectedCount === 0 || markdownProjection.status === "error" || isBusy;
  const bundleIsBlocked = selectedCount === 0 || archiveProjection.status === "error" || isBusy;
  const promptDisplayName = promptFilename(session).split("/").at(-1) ?? "prompt.md";

  useLayoutEffect(() => {
    viewRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);

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
    <main className="ps-plan-view" ref={viewRef}>
      <header className="ps-plan-header">
        <div>
          <p className="ps-eyebrow">Agent-ready export</p>
          <h1>Compile plan</h1>
          <p>
            {selectedCount} of {session.notes.length}{" "}
            {session.notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <Button onClick={onBack} variant="ghost">Back to notes</Button>
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
            <span className="ps-technical-value">{promptDisplayName}</span>
          </div>
          <div className="ps-plan-preview__actions">
            <Button
              disabled={promptIsBlocked}
              onClick={() =>
                runAction(
                  "copy",
                  () => actions.copy(includedNoteIds, { footerPrompt, headerPrompt }),
                )}
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
                  () => actions.downloadPrompt(includedNoteIds, { footerPrompt, headerPrompt }),
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
                  () => actions.downloadBundle(includedNoteIds, { footerPrompt, headerPrompt }),
                )}
            >
              {actionState.status === "busy" && actionState.action === "download-bundle"
                ? "Preparing…"
                : "Download bundle"}
            </Button>
          </div>
          <Input
            accessibleName="Header prompt"
            multiline
            onChange={setHeaderPrompt}
            placeholder="// Use my custom skills to plan and execute on this."
            rows={4}
            value={headerPrompt}
          />
          {markdownProjection.status === "ready"
            ? (
              <pre aria-label="Generated Markdown preview" data-markdown-preview tabIndex={0}>
                {markdownProjection.markdown}
              </pre>
            )
            : <p className="ps-panel-error" role="alert">{markdownProjection.message}</p>}
          <Input
            accessibleName="Footer prompt"
            multiline
            onChange={setFooterPrompt}
            placeholder="// Work hard, don't make mistakes."
            rows={4}
            value={footerPrompt}
          />
          {actionState.status === "success"
            ? <p className="ps-plan-status" role="status">{actionState.message}</p>
            : null}
          {actionState.status === "error"
            ? <p className="ps-panel-error" role="alert">{actionState.message}</p>
            : null}
          {archiveProjection.status === "error"
            ? <p className="ps-panel-error" role="alert">{archiveProjection.message}</p>
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
      </footer>
    </main>
  );
}
