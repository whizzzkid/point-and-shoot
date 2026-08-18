# Compile a plan and export it

This guide covers the second half of a Point and Shoot session: turning captured notes into a plan
an agent can act on, choosing what goes into it, and picking the delivery that fits your agent.

It assumes you already have a session with at least one note. If you do not, work through
[Get started](getting-started.md) first, which covers the same ground in one paragraph. This guide
explains each step and the file format behind it.

## Compile the plan

Select **Compile plan** in the side panel. The compile-plan step replaces the notes list with a
workspace in three parts: the note selection on the left, the generated plan in the middle, and the
outbound-data disclosure along the bottom.

Nothing is written or sent when the step opens. Compiling is a projection: Point and Shoot reads the
stored session and renders it as Markdown. You can move back and forth between the notes list and
the compile-plan step as often as you like, and the header shows how many notes the current
selection includes.

The plan is assembled from the session record in note order:

1. The session name becomes the document title, followed by a note count.
2. A line notes that `session.json` is the canonical record and the Markdown is a convenience
   projection.
3. Each included note becomes a `## Note N/M` section, titled with the page title.
4. Inside each note section, **Problem** carries your note text, **Location** carries the page URL,
   capture time, region geometry, viewport, and whether the capture was clipped, and **Evidence**
   carries one block per captured element.

A note saved with no text renders as `_No text was provided._` rather than an empty section. A note
whose region captured no element metadata says so instead of an empty **Evidence** block. Neither
case blocks the export, but both leave the agent with less to work from than a described problem
does.

Each element's evidence block is JSON: the selector bundle first, then the framework hint when
component hints are enabled, then a condensed computed-style digest. The digest is deliberately
terse — CSS shorthands collapse to their shortest equivalent form and uniform border colors collapse
to one value — so the plan stays readable at the size a real session reaches.

## Include and exclude notes

Every note starts included. The left column lists them with a minimap of the captured region, the
note text, and the page URL, each with an **Include** checkbox. **Include all** and **Exclude all**
set the whole selection at once.

Exclusion is per-export and non-destructive. It changes only this plan; the note stays in the
session and comes back included the next time you compile.

The selection drives everything downstream. Excluded notes are absent from the Markdown, absent from
`session.json`, and contribute no screenshot to the bundle. Screenshot numbering is assigned over
the included notes, so excluding the second of three notes yields `note-01` and `note-02`, not
`note-01` and `note-03`.

Excluding every note disables all three export actions. There is no empty plan.

## Read the preview

The middle column renders the plan as Markdown text, exactly as the export will contain it, with the
filename of the standalone prompt shown beside the heading. Every change to the selection or to the
prompt boxes re-renders it immediately.

The preview is read-only. It is the generated projection, not an editor — to change what it says,
change the notes or the surrounding prompts. The two editable boxes above and below it are the only
part of the plan you type into directly.

The preview omits screenshot links, because it mirrors the image-free projection used by **Copy
prompt** and **Download prompt**. The bundle's `plan.md` is otherwise identical and adds one
`- Screenshot:` line per note. If the preview cannot be built, an error replaces it and the prompt
actions are disabled.

## Wrap the plan in your own prompts

The boxes above and below the preview are the header and footer prompts. The header leads the
captured notes and the footer trails them, in the clipboard copy, the standalone `.md`, and the
bundle's `plan.md` alike. Leave either empty and it contributes nothing — no stray blank section.

Set the defaults in **Options** under **Plan prompt** so every future plan starts with them. The
boxes on the compile-plan step are seeded from those defaults and are editable per export: what you
type there changes this export only and never writes back to settings.

The split exists because the two kinds of instruction have different lifetimes. Durable, repeated
instruction belongs in the defaults:

- how the agent should work — which skills or workflow to follow, whether to plan before editing,
  how to verify a fix;
- standing project context — the repository layout, the framework in use, the conventions a fix must
  respect; and
- house rules — what not to touch, which files are generated, how to run the test suite.

One-off framing belongs in the per-export boxes: which ticket this session belongs to, which of two
plausible causes you already ruled out, which branch to work on.

## Choose an export action

Three actions sit above the preview. All three respect the current selection and the current prompt
boxes.

- **Copy prompt** puts the image-free Markdown on the clipboard. Use it when you are pasting
  straight into an agent chat and the note text carries enough on its own.
- **Download prompt** saves that same image-free Markdown as a standalone `.md` file under
  `point-and-shoot/` in your downloads folder, named from the session. The content is identical to
  what **Copy prompt** produces.
- **Download bundle** saves the complete ZIP, screenshots included, named from the session with a
  `.zip` extension.

Both downloads prompt for a location rather than saving silently. Each action reports its own
outcome beside the preview — copied, download started, or the error that stopped it.

## What is in the bundle

The ZIP holds three kinds of entry:

| Entry                | Contents                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `session.json`       | The canonical validated session record, filtered to the included notes   |
| `plan.md`            | The generated plan, with a relative screenshot link in each note section |
| `shots/note-NN.webp` | One WebP per included note, numbered in export order                     |

`session.json` is the authoritative record and the one an agent should trust when the two disagree.
It is the same schema Point and Shoot stores locally, pretty-printed, carrying the full selector
bundles, style digests, and region geometry — including each screenshot inline as a data URL. It
also reflects each note's query-string setting, so a URL stripped in the plan is stripped here too.

`plan.md` is the readable projection of that record. Its screenshot links are relative
(`./shots/note-01.webp`), which is what makes the extracted directory work in any Markdown viewer
and lets an agent resolve the images without being told where they are.

`shots/` numbering is zero-padded to at least two digits and widens for large sessions, so a
hundred-note export gives `note-001.webp` upward and the files still sort correctly.

## Hand the bundle to an agent

Extract the ZIP somewhere outside the source repository, so the export never lands in a diff. Then
start your coding agent in the repository that owns the page you captured and give it the extracted
directory:

> Read `plan.md` in the Point and Shoot export. Use `session.json` as the canonical evidence and
> resolve every relative image link under `shots/`. Implement the requested fixes, then verify them
> against the captured pages.

Keep the extracted directory intact. `plan.md` reaches its screenshots through relative paths, so
moving that one file out leaves every image link dangling — copy the whole directory or none of it.

## The standalone prompt or the bundle

The two are the same plan with different evidence. Choose by what the agent can see:

- **The standalone prompt** — a chat agent with no filesystem access, a quick paste, or a session
  where the note text alone describes the problem. It carries no screenshot links at all, so nothing
  in it can dangle. The visual evidence is simply absent.
- **The bundle** — a local coding agent, or any case where the screenshot is the point. Layout,
  spacing, contrast, and overflow bugs are much easier to act on with the image than with a
  description of it.

If you are unsure, send the bundle. An agent that ignores the screenshots loses nothing; an agent
that needed them cannot recover them from the prompt.

## Keep the export small

Screenshots dominate the size of a bundle, and a long session can produce a ZIP too large for
whatever you are sending it to. Two levers reduce it:

- **Export fewer notes.** Excluding notes drops both their screenshots and their evidence blocks.
  Splitting one long session into two exports is often better than one export nobody can upload.
- **Encode smaller screenshots.** In **Options** under **Capture**, lower **Screenshot quality** or
  **Maximum screenshot dimension**. Both settings apply at capture time, so they affect notes
  captured after the change, not notes already stored.

Neither setting changes which region is captured or the geometry recorded for it — only how the WebP
is encoded. The defaults are 0.7 quality and a 1024-pixel longest edge, which is a deliberate middle
ground rather than a maximum.

## Review what leaves the device

The disclosure along the bottom of the compile-plan step is worth reading before every export, not
once. An export carries screenshots, page URLs, DOM text, selectors, and computed styles. Point and
Shoot never uploads any of it — but sending a bundle to a hosted agent does send all of it off your
machine.

Query strings whose names look like credentials are stripped by default, and each note carries its
own setting you can change from the notes list. Stripping is a narrow safeguard: it removes tokens
from URLs and nothing else. An authenticated page can hold private account data in its DOM text and
in the screenshot itself, and no setting can detect that.

So before sending a bundle to anything hosted, look at the screenshots you selected. The minimaps in
the left column are there to make that possible without leaving the step, and excluding one note is
much cheaper than retracting an upload.

## Next steps

- [Get started](getting-started.md) for the full capture-to-handoff walkthrough.
- [Troubleshoot and understand known limits](troubleshooting.md) when a page, a target, or a capture
  does not behave as described here.
