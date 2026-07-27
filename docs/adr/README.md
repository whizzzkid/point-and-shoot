# Architecture decision records

An ADR records _why_ a decision was made, what was rejected, and what consequences were accepted. It
is written once, at decision time, and is **immutable once accepted**. A decision that turns out
wrong is not edited — it gets a successor ADR that supersedes it and links back, because the record
of having believed something is itself the value.

Read the ADR before arguing with a rule it produced. Most rules in this repo that look arbitrary
have one behind them.

## Index

| #    | Title          | Status |
| ---- | -------------- | ------ |
| 0001 | _pending W1.6_ | —      |

W1.6 writes ADRs 0001–0011 and fills this table in the same commit.

## Filing a new one

- Filename is `NNNN-kebab-slug.md`, zero-padded to four digits, numbered in the order decisions are
  accepted — never renumbered.
- Add a row to the index above in the same commit. An ADR missing from the index is an ADR nobody
  finds.
- Status is one of `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, or `Rejected`. Carry the date
  the status was reached.
- Supersede rather than edit. The successor names its predecessor in **Context**; the predecessor's
  status flips to `Superseded by ADR-NNNN` — that status line is the only edit an accepted ADR ever
  takes.

## Template

Copy this into the new file and fill every section. An empty section means the decision was not
actually made yet.

```markdown
# ADR-NNNN — Title in sentence case

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context

What forced a decision. The constraint, the conflict, or the discovery — enough that a reader who
was not there can see why doing nothing was not an option. Name the specific platform limits,
because those are what make the alternatives unequal.

## Decision

What was decided, in the imperative. One decision per ADR.

## Consequences

What this costs and what it forecloses. Write the uncomfortable ones down: the thing that is now
harder, the feature that is now off the table without revisiting this record, the extra build step
someone will hit. An ADR listing only benefits is marketing, not a record.

## Alternatives considered

Each alternative, and the specific reason it lost. "We preferred X" is not a reason; "X has no
Firefox equivalent, so it forks the codebase" is.
```
