# Export bundle

The plan view projects one validated session into agent-readable outputs. The versioned session JSON
defined by `src/shared/schema.ts` remains canonical per
[ADR-0003](../adr/0003-json-canonical-markdown-projection.md); Markdown, ZIP entries, and clipboard
text are derived outputs and are never read back into storage.

## Selection and ordering

Every session note starts included. The user can include or exclude notes independently, include all
notes, or exclude all notes.

The selected notes retain their session order in every output. Excluding a note removes it from
`session.json`, `plan.md`, and `shots/`. An empty selection can be previewed but cannot be copied or
downloaded.

## URL privacy

The local session retains the full recorded `pageUrl`. Every export projection applies the note's
`stripQuery` preference:

- `true` removes the entire query.
- `false` preserves it.
- An absent value removes the query when a parameter name contains `token`, `key`, `secret`, `auth`,
  or `session`, case-insensitively.

Query stripping does not remove the fragment or alter any other note field. The plan view states
that sensitive query parameters are stripped by default and points the user back to the per-note
setting in the notes view.

## Canonical JSON

`session.json` is a pretty-printed session record with a trailing newline. It retains the current
`schemaVersion`, inline `data:image/webp;base64,...` screenshots, selector bundles, style digests,
surrounding capture metadata, and component hints. Its `notes` array contains only the selected
notes, and each exported `pageUrl` follows the privacy rule above.

Serialization is a pure function over the validated session. It performs no DOM access, storage
read, browser call, or mutation of the input record.

## Markdown plan

`plan.md` starts with the session name and selected-note count. Each note section presents:

1. The problem text.
2. The sanitized page URL, capture time, screenshot path, region, viewport, and clipped state.
3. Each element's selector bundle.
4. Its component hint, only when present.
5. Its computed-style evidence, or an explicit unavailable state.

Screenshot paths are relative and lexically sortable:

- Up to 99 selected notes use `./shots/note-01.webp` through `./shots/note-99.webp`.
- Larger sessions widen every number to the selected-note count's digit width.

The clipboard projection uses the same note content and selection, identifies itself as image-free,
and omits every screenshot reference. It points the reader to the downloaded bundle for the
canonical JSON and screenshots.

## ZIP archive

The downloaded ZIP contains exactly these entries, in this order:

1. `session.json`
2. `plan.md`
3. One `shots/note-NN.webp` entry per selected note

Each WebP is decoded from the corresponding JSON data URL. A screenshot that is not a base64 WebP
data URL fails export rather than producing a corrupt archive. ZIP metadata is deterministic, and
the archive uses store-only entries so its exact byte length is stable and inexpensive to compute.

The browser prompts the user to save the archive under `point-and-shoot/<session-name-or-id>.zip`.
An object URL exists only for the download call and is revoked whether that call succeeds or fails.

## Size budget and errors

The default limit is `2,000,000` bytes, taken from the
[settled-numbers table](../plans/README.md#settled-numbers). The options page can select a fixed
`1,000,000`, `2,000,000`, `4,000,000`, or `8,000,000` byte limit. The plan view measures the exact
ZIP bytes for the current selection. When the archive exceeds the configured limit, both copy and
download are disabled until the user excludes notes. The view shows the selected size, the limit,
and an alert.

A serialization, clipboard, or download failure remains on the plan view and is announced as an
alert. No failed action clears the session or changes note selection.

## Outbound disclosure

Immediately beside the export actions, the plan view states that the bundle can contain screenshots,
page URLs, DOM text, selectors, and computed styles; that it should be treated like any file pasted
into a chat; and that a hosted agent may receive data captured from authenticated pages. Point &
Shoot does not upload the bundle in v1. See
[ADR-0013](../adr/0013-export-bundles-contain-page-data.md).
