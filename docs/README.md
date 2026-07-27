# Point & Shoot documentation

Point & Shoot is a browser extension for reporting and fixing UI/UX bugs in place. You turn it on from
the toolbar or a keyboard shortcut, it drops a small action bar onto the current page, you highlight a
region and write what's wrong — and it captures the screenshot, the URL, the XPath of every element in
the highlight, and the surrounding DOM and meta context into one note. A page can hold many notes. The
collected notes compile into a prompt a local coding agent can act on.

Everything in this folder is written to be **published**: the markdown here is the source for the
rendered documentation site, themed with the same design tokens as the product (see
[Publishing](#publishing) below). Write for a reader who has never seen the repo.

## Map

| Path | What lives there | Published? |
| --- | --- | --- |
| [`design.md`](design.md) | The design system: what's in the bundle, the MV3 substitutions, how to apply it | Yes |
| [`plans/`](plans/) | The wave-by-wave delivery plan — 53 items, dependency graphs, per-item verify steps | Yes |
| `specs/` | Settled behavioral contracts: note schema, export bundle format, capture semantics | Yes |
| `adr/` | Architecture decision records, numbered, immutable once accepted | Yes |
| `tutorials/` | Task-shaped walkthroughs: install, first capture, Playwright companion, troubleshooting | Yes |
| `assets/` | Committed images referenced by these docs and by PR bodies, one subdirectory per wave | Yes, as images |

`plans/` is the entry point for anyone about to do work. Start at
[`plans/README.md`](plans/README.md) — it carries the shared context, the settled decisions, the
dependency graph, and the rules every wave follows.

## What each kind of document is for

Keeping these distinct is what makes the set navigable. A document in the wrong category is a document
nobody finds.

- **ADR** (`adr/NNNN-slug.md`) — *why* a decision was made, the alternatives rejected, and the
  consequences accepted. Written once, at decision time. Superseded rather than edited: a wrong ADR gets
  a successor that references it, because the record of having believed something is itself the value.
- **Spec** (`specs/*.md`) — *what* the software guarantees. Schemas, formats, invariants, error
  behavior. Normative: an implementation that disagrees with a spec is a bug in one of the two, and the
  PR must say which.
- **Plan** (`plans/*.md`) — *how and in what order* the work happens. Living documents; they carry
  checkboxes and commit SHAs and are updated as items land.
- **Tutorial** (`tutorials/*.md`) — how a *person* accomplishes a task, start to finish, with real
  commands. Every command in a tutorial has been run.
- **Design** (`design.md`) — the visual and interaction language, and the rules that keep the shipped UI
  faithful to the exported bundle.

## Documenting interactions and intentions

The rule this project holds itself to: **an interaction a user can have, and an intention behind a
decision, are both documented before the work that introduces them is considered done.**

Concretely, for every item of work:

1. **Interactions** — any new user-facing behavior (a gesture, a keyboard path, a state the UI can be in,
   an error the user can hit) is described in `specs/` or `tutorials/`, including the sad paths. A
   behavior that only exists in a test assertion is undocumented.
2. **Intentions** — any decision that a future reader could reasonably second-guess gets its rationale
   written down: an ADR when it constrains the architecture, an inline design note on the PR when it is
   local to the change. "Why not the obvious alternative?" is the question being answered.
3. **Limits** — known limitations are documented up front, not when someone files them as bugs. Closed
   shadow roots, cross-origin iframes, restricted pages, and viewport-clamped regions are all known
   today and belong in `tutorials/troubleshooting`.
4. **Sync** — docs land in the **same commit** as the behavior they describe. A follow-up docs commit is
   a docs commit that doesn't happen.

## Conventions

- One `#` H1 per file, matching the filename's intent.
- Relative links between docs (`[design](design.md)`), so the same link works in the repo, on GitHub, and
  on the published site.
- Mermaid for diagrams, never ASCII art. Line breaks in node labels are `<br/>` — a literal `\n` renders
  as two visible characters on GitHub.
- Exact versions whenever a version is named. No `latest`, no `^`, no `~`.
- Every command shown must have been run. A command that doesn't work is worse than no command.
- Sentence case in headings, matching the product's voice.

## Publishing

The published docs site is **wave 5** scope, built alongside the marketing site so both share one
toolchain and one set of design tokens — see
[`plans/wave-5-marketing-site.md`](plans/wave-5-marketing-site.md). The markdown in this folder is
converted to HTML and themed with the same tokens the extension uses, so the docs look like the product
rather than like a generic docs theme.

Two consequences for how you write here:

- Files in this folder are **inputs to a build**, so paths and link targets matter. A broken relative link
  becomes a broken page.
- Nothing in this folder is private. Do not write anything here you would not publish.
