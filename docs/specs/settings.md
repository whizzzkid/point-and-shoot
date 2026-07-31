# Extension settings

All runtime preferences live in one versioned record under the `settings` key in `storage.local`.
IndexedDB continues to hold sessions and notes; changing or clearing settings does not migrate
session records.

## Schema and defaults

The stored object contains exactly these fields:

| Field                    | Allowed values                             | Default   |
| ------------------------ | ------------------------------------------ | --------- |
| `schemaVersion`          | `1`                                        | `1`       |
| `themeOverride`          | `auto`, `dark`, `light`                    | `auto`    |
| `frameworkHints`         | Boolean                                    | `false`   |
| `exportSizeBudgetBytes`  | `1000000`, `2000000`, `4000000`, `8000000` | `2000000` |
| `stripSensitiveQueries`  | Boolean                                    | `true`    |
| `screenshotQuality`      | `0.5`, `0.7`, `0.85`, `1`                  | `0.7`     |
| `screenshotMaxDimension` | `512`, `1024`, `2048`                      | `1024`    |

The options page writes the complete record after every change. Writes are serialized so a later
selection cannot be overwritten by an earlier, slower storage operation.

Every read validates the full record and its exact keys. A missing or invalid record resolves to a
fresh copy of the defaults; runtime consumers never cast unknown storage data to the settings type.
An invalid write fails instead of persisting a partial record.

## Theme behavior

`auto` samples the page backdrop according to
[ADR-0010](../adr/0010-backdrop-luminance-theming-with-override.md). `dark` and `light` bypass
sampling and force that overlay theme.

The content realm reads settings before creating its first shadow host, so a forced theme is present
on the host when it first enters the document. It listens for `storage.local` changes while the
content realm lives:

- a mounted overlay changes immediately;
- an unmounted overlay retains the new preference for its next mount; and
- returning to `auto` resumes backdrop sampling.

## Capture and export behavior

The background reads screenshot settings for every capture request. The selected quality is passed
to WebP encoding, and the selected maximum dimension caps the output's longest edge. Downscaling to
that edge marks the capture `truncated`, just as the default `1024` pixel cap does.

The notes panel and plan view use `exportSizeBudgetBytes` as a displayed warning threshold. The plan
view compares it with the exact ZIP size, but exceeding it never disables copy or download. The
measured `2 MB` value remains the default; the user may deliberately choose one of the other fixed
thresholds.

When `stripSensitiveQueries` is on, a new note defaults `stripQuery` to true only if a query
parameter name contains `token`, `key`, `secret`, `auth`, or `session`, case-insensitively. Turning
the setting off makes new notes preserve their queries. It does not rewrite an existing note's
per-note choice.

## Framework component hints

`frameworkHints` defaults off because framework probes read non-standard properties from the
inspected page. The probe must not inspect those properties unless this setting is true. Turning the
setting off degrades cleanly to an absent `componentHint`; selector and style evidence remain. The
exact opt-in, execution-world, version, and failure contract is defined by the
[framework component hints spec](framework-component-hints.md).

## Browser-owned shortcuts

The options page displays the browser's current assignment for the manifest command
`toggle-capture`; it does not repeat the manifest default as though it were still assigned.

The extension cannot rebind shortcuts. `Manage browser shortcuts` opens:

- `chrome://extensions/shortcuts` on Chrome; or
- `about:addons` on Firefox.

## Clearing stored sessions

`Clear all sessions` requires confirmation. Confirming clears the IndexedDB `sessions` store in one
transaction and removes `activeSessionId` from `storage.local`. The settings record is retained.

A load, save, shortcut-navigation, or clear failure remains on the options page as an alert. A
failed clear does not report success, and a failed settings write restores the prior displayed
value.
