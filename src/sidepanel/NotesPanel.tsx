/// <reference lib="dom" />

import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Note, Session } from "../shared/schema.ts";
import { DEFAULT_EXPORT_SIZE_BUDGET_BYTES, projectedSessionSize } from "../shared/session.ts";
import {
  Badge,
  Button,
  CaptureMinimap,
  Dialog,
  Icon,
  IconButton,
  IconSpriteProvider,
  Input,
  Switch,
} from "../ui/components/index.ts";
import {
  deleteNote,
  effectiveStripQuery,
  groupNotesByPage,
  moveNote,
  setNoteStripQuery,
  updateNoteText,
} from "./model.ts";
import { copySessionPrompt, downloadSessionArchive } from "./plan/delivery.ts";
import type { ExportDeliveryDependencies } from "./plan/delivery.ts";
import { PlanView } from "./plan/PlanView.tsx";
import type { NotesRepository } from "./repository.ts";

/** Props accepted by {@link NotesPanel}. */
export interface NotesPanelProps {
  readonly exportDelivery: ExportDeliveryDependencies;
  readonly iconSpriteUrl: string;
  readonly repository: NotesRepository;
  readonly sizeBudgetBytes?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1_000)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function targetLabel(note: Note): string {
  const selectors = note.elements[0]?.selectors;
  if (selectors === undefined) return "Region capture";
  return selectors.tagClasses || (selectors.reachable ? "Selected element" : selectors.unreachable);
}

function xpathLabel(note: Note): string | undefined {
  const selectors = note.elements[0]?.selectors;
  return selectors?.reachable ? selectors.xpath.join(" › ") : undefined;
}

interface NoteCardProps {
  readonly busy: boolean;
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly note: Note;
  readonly onDelete: (note: Note) => void;
  readonly onEdit: (note: Note) => void;
  readonly onMove: (note: Note, direction: "up" | "down") => void;
  readonly onStripQuery: (note: Note, checked: boolean) => void;
}

function NoteCard(
  {
    busy,
    canMoveDown,
    canMoveUp,
    note,
    onDelete,
    onEdit,
    onMove,
    onStripQuery,
  }: NoteCardProps,
): JSX.Element {
  const target = targetLabel(note);
  const xpath = xpathLabel(note);
  return (
    <article className="ps-note-card" data-note-id={note.id}>
      <CaptureMinimap
        label={`Captured region — ${target}`}
        screenshot={note.region.screenshot}
        truncated={note.region.truncated}
      />
      <div className="ps-note-card__content">
        <div className="ps-note-card__meta">
          <span className="ps-technical-value" title={target}>{target}</span>
          {note.region.truncated ? <Badge tone="warning">Clipped</Badge> : null}
        </div>
        <p className="ps-note-card__text">{note.text || "Add a note about this capture."}</p>
        <span
          className="ps-technical-value ps-note-card__url"
          data-recorded-url
          title={note.pageUrl}
        >
          {note.pageUrl}
        </span>
        {xpath === undefined
          ? null
          : <span className="ps-technical-value" data-xpath title={xpath}>{xpath}</span>}
        <label className="ps-query-setting">
          <Switch
            checked={effectiveStripQuery(note)}
            onChange={(checked) => {
              if (!busy) onStripQuery(note, checked);
            }}
          />
          <span>Strip query when exporting</span>
        </label>
      </div>
      <div className="ps-note-card__actions">
        <IconButton
          icon={<Icon name="pencil" />}
          label="Edit"
          onClick={() => {
            if (!busy) onEdit(note);
          }}
        />
        <IconButton
          icon={<Icon name="trash-2" />}
          label="Delete"
          onClick={() => {
            if (!busy) onDelete(note);
          }}
        />
        <Button
          disabled={busy || !canMoveUp}
          onClick={() => onMove(note, "up")}
          size="sm"
          variant="ghost"
        >
          Move up
        </Button>
        <Button
          disabled={busy || !canMoveDown}
          onClick={() => onMove(note, "down")}
          size="sm"
          variant="ghost"
        >
          Move down
        </Button>
      </div>
    </article>
  );
}

/**
 * Renders the current session review workspace backed by extension-owned persistence.
 *
 * @param props Repository, icon sprite, and export-budget threshold.
 * @returns Notes panel loading, empty, error, or review state.
 */
export function NotesPanel(
  {
    exportDelivery,
    iconSpriteUrl,
    repository,
    sizeBudgetBytes = DEFAULT_EXPORT_SIZE_BUDGET_BYTES,
  }: NotesPanelProps,
): JSX.Element {
  const [session, setSession] = useState<Session | null>();
  const [selectedPageKey, setSelectedPageKey] = useState<string>();
  const [editing, setEditing] = useState<Note>();
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<Note>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<"notes" | "plan">("notes");

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const reload = (): void => {
      const currentRequest = ++requestId;
      void repository.load()
        .then((loaded) => {
          if (active && currentRequest === requestId) {
            setError(undefined);
            setSession(loaded);
          }
        })
        .catch((cause: unknown) => {
          if (active && currentRequest === requestId) {
            setError(
              cause instanceof Error ? cause.message : "The current session could not load.",
            );
            setSession(null);
          }
        });
    };
    const stopWatching = repository.watch(reload);
    reload();
    return () => {
      active = false;
      stopWatching();
    };
  }, [repository]);

  const groups = useMemo(
    () => session === undefined || session === null ? [] : groupNotesByPage(session),
    [session],
  );
  const activePageKey = groups.some((group) => group.key === selectedPageKey)
    ? selectedPageKey
    : groups[0]?.key;
  const activeGroup = groups.find((group) => group.key === activePageKey);

  const persist = async (next: Session): Promise<boolean> => {
    setBusy(true);
    setError(undefined);
    try {
      await repository.save(next);
      setSession(next);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The session change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const apply = (next: Session, afterSave?: () => void): void => {
    void persist(next).then((saved) => {
      if (saved) afterSave?.();
    });
  };

  const beginEdit = (note: Note): void => {
    setEditing(note);
    setEditText(note.text);
  };

  if (session === undefined) {
    return <main className="ps-notes-panel ps-notes-panel--center">Loading notes…</main>;
  }

  const noteCount = session?.notes.length ?? 0;
  const projectedBytes = session === null ? 0 : projectedSessionSize(session);
  const isOverBudget = projectedBytes > sizeBudgetBytes;

  if (session !== null && view === "plan") {
    return (
      <IconSpriteProvider url={iconSpriteUrl}>
        <PlanView
          actions={{
            copy: (includedNoteIds) =>
              copySessionPrompt(session, { includedNoteIds }, exportDelivery),
            download: (includedNoteIds) =>
              downloadSessionArchive(session, { includedNoteIds }, exportDelivery).then(
                () => undefined,
              ),
          }}
          onBack={() => setView("notes")}
          session={session}
          sizeBudgetBytes={sizeBudgetBytes}
        />
      </IconSpriteProvider>
    );
  }

  return (
    <IconSpriteProvider url={iconSpriteUrl}>
      <main className="ps-notes-panel">
        <aside className="ps-notes-sidebar">
          <div>
            <p className="ps-eyebrow">
              {session === null
                ? "Session"
                : session.endedAt === null
                ? "Current session"
                : "Completed session"}
            </p>
            <h1>{session?.name ?? "Notes"}</h1>
          </div>
          <nav aria-label="Captured pages" className="ps-page-list">
            <p className="ps-eyebrow">Pages</p>
            {groups.map((group) => (
              <button
                aria-current={group.key === activePageKey ? "page" : undefined}
                className="ps-page-link"
                data-page-key={group.key}
                key={group.key}
                onClick={() => setSelectedPageKey(group.key)}
                title={group.pageUrl}
                type="button"
              >
                <span>{group.pageTitle || "Untitled page"}</span>
                <Badge>{group.notes.length}</Badge>
                <span className="ps-technical-value">{group.key}</span>
              </button>
            ))}
          </nav>
          <div
            className="ps-export-budget"
            data-export-budget
            data-over-budget={isOverBudget}
          >
            <div>
              <span>{formatBytes(projectedBytes)} of {formatBytes(sizeBudgetBytes)}</span>
              <span>{noteCount} {noteCount === 1 ? "note" : "notes"}</span>
            </div>
            <progress max={sizeBudgetBytes} value={Math.min(projectedBytes, sizeBudgetBytes)} />
            {isOverBudget
              ? (
                <p role="alert">
                  Export is over the size budget. Delete notes or reduce screenshot settings before
                  export.
                </p>
              )
              : null}
          </div>
        </aside>

        <section className="ps-notes-workspace">
          {error === undefined ? null : <p className="ps-panel-error" role="alert">{error}</p>}
          {noteCount === 0
            ? (
              <div className="ps-empty-notes">
                <h2>No notes yet</h2>
                <p>No notes yet. Highlight anything on the page to start one.</p>
              </div>
            )
            : (
              <>
                <header className="ps-notes-header">
                  <div>
                    <p className="ps-eyebrow">Notes on this page</p>
                    <h2>{activeGroup?.pageTitle || "Untitled page"}</h2>
                    <p className="ps-technical-value" title={activeGroup?.pageUrl}>
                      {activeGroup?.pageUrl}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    icon={<Icon name="list-checks" />}
                    onClick={() => setView("plan")}
                  >
                    Compile plan
                  </Button>
                </header>
                <div className="ps-note-list">
                  {activeGroup?.notes.map((note, index) => (
                    <NoteCard
                      busy={busy}
                      canMoveDown={index < activeGroup.notes.length - 1}
                      canMoveUp={index > 0}
                      key={note.id}
                      note={note}
                      onDelete={setDeleting}
                      onEdit={beginEdit}
                      onMove={(selected, direction) => {
                        if (session !== null) {
                          apply(moveNote(session, selected.id, direction));
                        }
                      }}
                      onStripQuery={(selected, checked) => {
                        if (session !== null) {
                          apply(setNoteStripQuery(session, selected.id, checked));
                        }
                      }}
                    />
                  ))}
                </div>
              </>
            )}
        </section>

        <Dialog
          footer={
            <>
              <Button onClick={() => setEditing(undefined)} variant="secondary">Cancel</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  if (editing !== undefined && session !== null) {
                    apply(
                      updateNoteText(session, editing.id, editText),
                      () => setEditing(undefined),
                    );
                  }
                }}
              >
                Save changes
              </Button>
            </>
          }
          onClose={() => setEditing(undefined)}
          open={editing !== undefined}
          title="Edit note"
        >
          <label className="ps-edit-note-label">
            <span>Note text</span>
            <Input
              accessibleName="Note text"
              multiline
              onChange={setEditText}
              placeholder="Describe what should change."
              value={editText}
            />
          </label>
        </Dialog>

        <Dialog
          footer={
            <>
              <Button onClick={() => setDeleting(undefined)} variant="secondary">Cancel</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  if (deleting !== undefined && session !== null) {
                    apply(deleteNote(session, deleting.id), () => setDeleting(undefined));
                  }
                }}
                variant="danger"
              >
                Delete note
              </Button>
            </>
          }
          onClose={() => setDeleting(undefined)}
          open={deleting !== undefined}
          title="Delete note?"
        >
          Deleting this note permanently removes its screenshot. This cannot be undone.
        </Dialog>
      </main>
    </IconSpriteProvider>
  );
}
