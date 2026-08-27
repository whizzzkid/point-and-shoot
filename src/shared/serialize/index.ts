import type { Note, Session } from "../schema.ts";
import { pageUrlForExport, shouldStripQueryByDefault } from "../session.ts";
import type {
  BoxModelDigest,
  ColorDigest,
  ElementDigest,
  StyleDigestBundle,
} from "../style-digest.ts";

/** Controls which notes and image references an export projection includes. */
export interface SerializeOptions {
  readonly footerPrompt?: string;
  readonly headerPrompt?: string;
  readonly includedNoteIds?: ReadonlySet<string>;
  readonly includeImageReferences?: boolean;
}

function includedNotes(session: Session, includedNoteIds?: ReadonlySet<string>): readonly Note[] {
  if (includedNoteIds === undefined) return session.notes;
  return session.notes.filter((note) => includedNoteIds.has(note.id));
}

function projectedPageUrl(note: Note): string {
  return pageUrlForExport(
    note.pageUrl,
    note.stripQuery ?? shouldStripQueryByDefault(note.pageUrl),
  );
}

function projectSession(session: Session, options: SerializeOptions): Session {
  return {
    ...session,
    notes: includedNotes(session, options.includedNoteIds).map((note) => ({
      ...note,
      pageUrl: projectedPageUrl(note),
    })),
  };
}

function noteNumberWidth(noteCount: number): number {
  return Math.max(2, String(noteCount).length);
}

/**
 * Returns the relative WebP path assigned to a note at an export position.
 *
 * @param index Zero-based note position in the projected session.
 * @param noteCount Total projected note count.
 * @returns A stable path such as `shots/note-01.webp`.
 */
export function shotPath(index: number, noteCount: number): string {
  return `shots/note-${String(index + 1).padStart(noteNumberWidth(noteCount), "0")}.webp`;
}

/**
 * Serializes a session into the canonical, versioned JSON export record.
 *
 * @param session Validated session record.
 * @param options Optional note inclusion selection.
 * @returns Pretty-printed JSON with a trailing newline.
 */
export function toJson(session: Session, options: SerializeOptions = {}): string {
  return `${JSON.stringify(projectSession(session, options), null, 2)}\n`;
}

function jsonEvidence(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function pixelValue(value: number): string {
  return value === 0 ? "0" : `${value}px`;
}

function cssShorthand(top: number, right: number, bottom: number, left: number): string {
  const values = [top, right, bottom, left];
  if (top === right && top === bottom && top === left) values.splice(1);
  else if (top === bottom && right === left) values.splice(2);
  else if (right === left) values.splice(3, 1);
  return values.map(pixelValue).join(" ");
}

function terseBox(box: BoxModelDigest): Record<string, number | string> {
  return {
    width: box.width,
    height: box.height,
    padding: cssShorthand(
      box.paddingTop,
      box.paddingRight,
      box.paddingBottom,
      box.paddingLeft,
    ),
    margin: cssShorthand(
      box.marginTop,
      box.marginRight,
      box.marginBottom,
      box.marginLeft,
    ),
    borderWidth: cssShorthand(
      box.borderTopWidth,
      box.borderRightWidth,
      box.borderBottomWidth,
      box.borderLeftWidth,
    ),
  };
}

function terseColor(color: ColorDigest): Record<string, string> {
  const borderColors = [
    color.borderTopColor,
    color.borderRightColor,
    color.borderBottomColor,
    color.borderLeftColor,
  ];
  const sharedBorderColor = borderColors.every((value) => value === borderColors[0]);
  if (sharedBorderColor) {
    return {
      color: color.color,
      backgroundColor: color.backgroundColor,
      borderColor: color.borderTopColor,
    };
  }
  return { ...color };
}

function terseElement(element: ElementDigest): Record<string, unknown> {
  return {
    box: terseBox(element.box),
    typography: element.typography,
    color: terseColor(element.color),
  };
}

function terseStyleDigest(digest: StyleDigestBundle): Record<string, unknown> {
  return {
    self: terseElement(digest.self),
    parent: digest.parent === null ? null : terseElement(digest.parent),
    siblings: digest.siblings.map((sibling) => ({
      ...sibling,
      element: terseElement(sibling.element),
    })),
  };
}

function singleLine(value: string, fallback: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed || fallback;
}

/**
 * Trims a user-authored prompt part and returns it only when it has content.
 *
 * @param part Raw header or footer prompt from settings or a per-export override.
 * @returns The trimmed prompt, or an empty string when it is blank.
 */
export function trimPromptPart(part: string | undefined): string {
  return (part ?? "").trim();
}

function elementLetter(index: number): string {
  let remaining = index;
  let label = "";
  do {
    label = String.fromCharCode(97 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

function noteMarkdown(
  note: Note,
  index: number,
  noteCount: number,
  includeImageReferences: boolean,
): string {
  const lines = [
    `## Note ${index + 1}/${noteCount} — ${singleLine(note.pageTitle, "Untitled page")}`,
    "",
    "### Goal",
    "",
    note.text.trim() || "_No note text was provided._",
    "",
    "### Location on Live page",
    "",
    `- Page: \`${note.pageUrl}\``,
    `- Captured: \`${note.createdAt}\``,
  ];

  if (includeImageReferences) {
    const path = `./${shotPath(index, noteCount)}`;
    lines.push(`- Screenshot: [\`${path}\`](${path})`);
  }

  lines.push(
    `- Region: \`x=${note.region.box.x}, y=${note.region.box.y}, ` +
      `width=${note.region.box.width}, height=${note.region.box.height}\``,
    `- Viewport: \`${note.region.viewport.width} × ${note.region.viewport.height}\``,
    `- Capture clipped: ${note.region.truncated ? "yes" : "no"}`,
    "",
    `### Evidence ${index + 1}`,
    "",
  );

  if (note.elements.length === 0) {
    lines.push("No element metadata was captured for this region.");
    return lines.join("\n");
  }

  note.elements.forEach((element, elementIndex) => {
    if (elementIndex > 0) lines.push("");
    lines.push(
      `#### Element ${index + 1}.${elementLetter(elementIndex)}`,
      "",
      "Selector bundle:",
      "",
      jsonEvidence(element.selectors),
    );
    if (element.componentHint !== undefined) {
      lines.push("", "Framework hint:", "", jsonEvidence(element.componentHint));
    }
    lines.push(
      "",
      element.styleDigest === null
        ? "Computed style evidence was unavailable."
        : `Computed style evidence:\n\n${jsonEvidence(terseStyleDigest(element.styleDigest))}`,
    );
  });

  return lines.join("\n");
}

/**
 * Projects a session into an agent-readable Markdown plan.
 *
 * @param session Validated session record.
 * @param options Note selection, screenshot references, and optional header/footer prompt parts.
 * @returns Markdown that leads with each problem, then its location and structured evidence.
 */
export function toMarkdown(session: Session, options: SerializeOptions = {}): string {
  const projected = projectSession(session, options);
  const noteCount = projected.notes.length;
  const includeImageReferences = options.includeImageReferences ?? true;
  const header = [
    `# ${singleLine(projected.name, "Point & Shoot session")}`,
    "",
    `${noteCount} ${noteCount === 1 ? "note" : "notes"} captured.`,
    "",
    includeImageReferences
      ? "`session.json` is the canonical record. This Markdown file is a convenience projection."
      : "This image-free prompt is a convenience projection. Download the bundle for the " +
        "canonical `session.json` record and screenshots.",
    "",
    "These are raw notes captured from live changes that need improvement or are new ideas. " +
    "Use the issues and ideas in each note below to plan and implement the changes in the " +
    "best possible order.",
  ];
  const planFooter =
    "After planning, confirm every ask and report in the notes above is addressed. After " +
    "implementation, revisit this planning doc and validate that all notes and asks were " +
    "implemented.";
  const notes = projected.notes.map((note, index) =>
    noteMarkdown(note, index, noteCount, includeImageReferences)
  );
  const body = `${[header.join("\n"), ...notes, planFooter].join("\n\n")}\n`;
  const headerPrompt = trimPromptPart(options.headerPrompt);
  const footerPrompt = trimPromptPart(options.footerPrompt);
  if (headerPrompt === "" && footerPrompt === "") return body;
  const headerBlock = headerPrompt === "" ? "" : `${headerPrompt}\n\n`;
  // `body` already ends with a trailing newline, so a single `\n` before the footer yields
  // exactly one blank line separating the plan from the footer; a trailing `\n` after it
  // preserves the file's usual terminal newline.
  const footerBlock = footerPrompt === "" ? "" : `\n${footerPrompt}\n`;
  return `${headerBlock}${body}${footerBlock}`;
}
