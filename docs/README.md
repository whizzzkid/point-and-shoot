# Point & Shoot documentation

Point & Shoot is a browser extension for reporting and fixing UI/UX bugs in place. You turn it on
from the toolbar or a keyboard shortcut, it drops a small action bar onto the current page, you
highlight a region and write what's wrong — and it captures the screenshot, the URL, the XPath of
every element in the highlight, and the surrounding DOM and meta context into one note. A page can
hold many notes. The collected notes compile into a prompt a local coding agent can act on.

Everything in this folder is written to be **publicly readable in the repository**. The product
guides are also the source for the rendered documentation site, themed with the same design tokens
as the extension (see [Publishing](#publishing) below). Write for a reader who has never seen the
repo.

## Map

| Path                                | What lives there                                                                 | Published?      |
| ----------------------------------- | -------------------------------------------------------------------------------- | --------------- |
| [`design.md`](design.md)            | The design system, MV3 substitutions, and application rules                      | Yes             |
| [`plans/`](plans/README.md)         | Active implementation plans, including the browser-store rollout                 | Repository only |
| [`specs/`](specs/README.md)         | Current contracts for the extension, release pipeline, and website               | Yes             |
| [`adr/`](adr/README.md)             | Architecture decision records, numbered and immutable once accepted              | Repository only |
| [`tutorials/`](tutorials/README.md) | Task walkthroughs for install, capture, Playwright, troubleshooting, and release | Yes             |
| `assets/`                           | Committed images referenced by documentation and pull request bodies             | When referenced |

Start with [`specs/README.md`](specs/README.md) when changing behavior. It maps the current
contracts and links to the ADRs that explain their architectural constraints.

## What each kind of document is for

Keeping these distinct is what makes the set navigable. A document in the wrong category is a
document nobody finds.

- **ADR** ([`adr/NNNN-slug.md`](adr/README.md)) — _why_ a decision was made, the alternatives
  rejected, and the consequences accepted. Written once, at decision time. Superseded rather than
  edited: a wrong ADR gets a successor that references it, because the record of having believed
  something is itself the value.
- **Plan** ([`plans/<initiative>/`](plans/README.md)) — how active proposed work is sequenced and
  verified. Temporary: retire it when delivery is complete, after current guarantees move to specs
  and lasting rationale moves to ADRs.
- **Spec** ([`specs/*.md`](specs/README.md)) — _what_ the software guarantees. Schemas, formats,
  invariants, error behavior. Normative: an implementation that disagrees with a spec is a bug in
  one of the two, and the PR must say which.
- **Tutorial** ([`tutorials/*.md`](tutorials/README.md)) — how a _person_ accomplishes a task, start
  to finish, with real commands. Every command in a tutorial has been run.
- **Design** ([`design.md`](design.md)) — the visual and interaction language, and the rules that
  keep the shipped UI faithful to the exported bundle.

## Documenting interactions and intentions

The rule this project holds itself to: **an interaction a user can have, and an intention behind a
decision, are both documented before the work that introduces them is considered done.**

Concretely, for every item of work:

1. **Interactions** — any new user-facing behavior (a gesture, a keyboard path, a state the UI can
   be in, an error the user can hit) is described in [`specs/`](specs/README.md) or
   [`tutorials/`](tutorials/README.md), including the sad paths. A behavior that only exists in a
   test assertion is undocumented.
2. **Intentions** — any decision that a future reader could reasonably second-guess gets its
   rationale written down: an ADR when it constrains the architecture, an inline design note on the
   PR when it is local to the change. "Why not the obvious alternative?" is the question being
   answered.
3. **Limits** — known limitations are documented up front, not when someone files them as bugs.
   Closed shadow roots, cross-origin iframes, restricted pages, and viewport-clamped regions are all
   known today and belong in [`tutorials/troubleshooting.md`](tutorials/troubleshooting.md).
4. **Sync** — docs land in the **same commit** as the behavior they describe. A follow-up docs
   commit is a docs commit that doesn't happen.

## Conventions

- One `#` H1 per file, matching the filename's intent.
- Relative links between docs (`[design](design.md)`), so the same link works in the repo, on
  GitHub, and on the published site.
- Mermaid for diagrams, never ASCII art. Line breaks in node labels are `<br/>` — a literal `\n`
  renders as two visible characters on GitHub.
- Exact versions whenever a version is named. No `latest`, no `^`, no `~`.
- Every command shown must have been run. A command that doesn't work is worse than no command.
- Sentence case in headings, matching the product's voice.

## Publishing

The published documentation is built alongside the marketing site so both share one toolchain and
one set of design tokens. The site publishes this index, the design guide, specifications, and
tutorials. ADRs remain repository-only because they document architectural history rather than
product use. Published pages link back to ADRs on GitHub when the rationale matters.

The published Markdown is converted to HTML and themed with the same tokens the extension uses, so
the docs look like the product rather than like a generic docs theme.

Two consequences for how you write here:

- Files in this folder are **inputs to a build**, so paths and link targets matter. A broken
  relative link becomes a broken page.
- Nothing in this folder is private. Repository-only means omitted from the website, not
  confidential.

Only active implementation plans live under [`docs/plans/`](plans/README.md), and the documentation
site does not publish them. Once behavior lands, preserve its current contract in a spec and its
lasting rationale in an ADR; use issues and pull requests for durable delivery history, then retire
the completed plan. In particular, retire the active browser-store plan under
[`plans/publish/`](plans/publish/README.md) after the first automated store release is verified.
