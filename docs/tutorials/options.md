# Configure Point and Shoot options

This walkthrough opens the extension settings page and explains every section, what each control
changes, when you would change it, and the value it ships with.

If you have not captured a session yet, read [get started](getting-started.md) first. The settings
below assume you know what a session, a note, and a compiled plan are.

## Open the settings page

The settings page opens in its own tab, from the browser's extension management UI:

- In Chrome, open `chrome://extensions`, find Point and Shoot, and select **Details**, then
  **Extension options**.
- In Firefox, open `about:addons`, select Point and Shoot, and open its **Preferences** tab.

The toolbar icon does not open settings. It is the session control — a click starts, pauses, or
resumes a capture session, so it is not a route to this page.

The page opens on **General**. A tab strip across the top moves between the seven sections. The
current extension version is printed in the bottom corner; quote it when filing a bug.

## How saving works

There is no **Save** button. The settings on **General**, **Capture**, **Plan prompt**, and **Export
& privacy** write as soon as you change them, and a short status message appears in the page footer:
**Saving…**, then **Saved.**

If one of those writes fails, the footer shows an error and the control snaps back to the last value
that was stored successfully. Nothing is left half-applied. Retry the change, and if it keeps
failing see [troubleshooting](troubleshooting.md).

Two controls sit outside that guarantee. **Group by domain** on the Sessions tab is stored
separately and written best-effort: it reports neither **Saved.** nor an error, so on the rare
failure the toggle looks applied but will be back where it started next time you open the page. The
**Shortcuts** tab writes nothing at all — the browser owns that value.

Settings are stored in extension-local storage, so they are per browser profile. They are not synced
between machines, and they are never uploaded.

## Defaults at a glance

| Section          | Setting                       | Default                                      |
| ---------------- | ----------------------------- | -------------------------------------------- |
| General          | Theme                         | Follow backdrop                              |
| General          | Framework component hints     | Off                                          |
| Capture          | Screenshot quality            | 70%                                          |
| Capture          | Maximum screenshot dimension  | 1024 px                                      |
| Plan prompt      | Header prompt                 | Empty                                        |
| Plan prompt      | Footer prompt                 | Empty                                        |
| Export & privacy | Strip sensitive query strings | On                                           |
| Shortcuts        | Toggle capture                | `Command+Shift+P` / `Ctrl+Shift+P` requested |
| Sessions         | Group by domain               | Off                                          |

## General

Controls how the extension looks, and how much of a page's internals it is allowed to inspect.

### Theme

Choose between **Follow backdrop**, **Dark**, and **Light**. The default is **Follow backdrop**.

**Follow backdrop** samples the page you are inspecting and picks the variant that contrasts with
it, so the overlay stays readable on a dark documentation site and on a white admin console without
you touching anything. Because it follows the page rather than your operating system, the overlay
can legitimately change appearance as you move between tabs in one session.

Extension pages have no inspected page to sample, so on this settings page **Follow backdrop** falls
back to your operating system's light or dark preference instead.

Force **Dark** or **Light** when that automatic choice fights you: a page with a mid-gray backdrop
that flips the overlay back and forth, a page whose backdrop is an image, or a screen recording
where you want every frame to look the same. The forced value applies to the overlay and to this
settings page. The notes side panel is not themed by this setting today — it renders in its own
fixed palette whichever value you pick.

This setting is presentation only. It does not change what is captured or exported.

### Framework component hints

A switch, **off** by default.

Turn it on and Point and Shoot additionally records the framework component behind each element you
capture — the component name, and a source location when the framework exposes one. React, Vue,
Svelte, and Angular are recognized. Those hints ride along in the note and end up in the compiled
plan, which is the difference between telling an agent "the button at the top of the page" and
telling it `CheckoutSubmitButton`.

It is off by default because it is genuinely more invasive than the rest of the extension. Reading
framework metadata means running a probe in the page's own JavaScript context and reading
undocumented properties that frameworks attach to DOM nodes. That is a privilege the extension does
not take without being asked.

Turn it on when you are capturing bugs in an application you or your team own, and the agent
receiving the plan has the source. Leave it off on third-party pages, and on anything where you
would rather the extension stayed strictly outside the page.

Hints are best-effort. A production build with minified component names, a framework version that
does not expose the metadata, or a plain-HTML page all yield no hint, and the note is saved without
one rather than failing.

## Capture

Controls how screenshots are encoded. Neither setting changes _which_ region is captured — that is
decided by the element or box you select in the overlay. They change only how the resulting image is
stored.

### Screenshot quality

The WebP encoder quality, selectable as **50%**, **70%**, **85%**, or **100%**. The default is
**70%**.

Higher values keep more detail and produce larger session records. Because every note stores its own
screenshot, this multiplies: a long session at 100% can produce an export several times the size of
the same session at 70%.

Raise it when the bug is in the rendering itself — a one-pixel border, a subtle gradient banding, a
font-smoothing difference — where compression artifacts could be mistaken for the defect, or worse,
hide it. Lower it when the screenshots are only there to show _where_ on the page the problem is and
the export size warning is in your way.

### Maximum screenshot dimension

The longest-edge limit in pixels, selectable as **512 px**, **1024 px**, or **2048 px**. The default
is **1024 px**.

Any capture whose longer edge exceeds the limit is scaled down proportionally until it fits. Aspect
ratio is preserved and nothing is cropped, and the note records that it was downscaled so the
evidence never claims to be full resolution. Captures already smaller than the limit are left alone,
so lowering this does not upscale anything.

Raise it to **2048 px** when you capture wide regions — a full-width table, a whole dashboard row —
and the downscaled image is too soft to read the text an agent needs. Drop it to **512 px** when
your notes are small components and you want the smallest possible bundle.

Both settings apply to captures taken from now on. Screenshots already saved in existing sessions
keep the quality and dimensions they were captured at; changing these values does not re-encode
them. If an export is too large, the fastest fix is usually to exclude notes on the compile-plan
step rather than to re-capture.

## Plan prompt

Wraps every compiled plan in your own instructions. Both boxes are multi-line and **empty** by
default.

### Header prompt

Text placed before the captured notes. Use it for the standing instructions an agent needs before it
reads any evidence — which skills or conventions to apply, which directory to work in, how to
behave. For example:

```text
Use my custom skills to plan and execute on this.
```

### Footer prompt

Text placed after the captured notes. Use it for what the agent should do once it has read the
evidence — how to verify, what to avoid, what to report back.

### How the prompts are used

The header leads and the footer trails the notes in the exported `plan.md`, in the standalone prompt
download, and in every clipboard copy. Each part is trimmed and emitted only when you have written
something, separated from the generated plan by a blank line, so leaving both empty produces exactly
the plan you would have got without this section.

They are defaults, not fixed text: the compile-plan step in the side panel shows both boxes again,
seeded from what you set here, and lets you edit them for that one export without writing back to
settings. An open side panel picks up edits made here without a reload.

These boxes are for instructions that apply to _every_ plan. Anything specific to one bug belongs in
that note's body, where it stays attached to the screenshot and selectors that explain it.

## Export & privacy

### Strip sensitive query strings

A switch, **on** by default.

Every note stores the full URL of the page it was captured on, and captured URLs routinely carry
credentials in the query string — a session token, an API key, a signed link. With this on, a new
note defaults to dropping the query string when its parameter names look credential-bearing: names
containing `token`, `key`, `secret`, `auth`, or `session`, matched case-insensitively. The path and
hostname are always kept, so the agent still knows which page you were on.

This sets the **default** for newly captured notes only. Each note keeps its own query-string
choice, which you can flip per note in the side panel — useful when a stripped parameter is actually
load bearing for reproducing the bug, or when a parameter that happens to be named `sortKey` was
caught by the pattern and you want it back. Changing this switch does not rewrite notes you already
captured.

Leave it on. The name-matching heuristic is deliberately broad, and the cost of a false positive is
one per-note toggle, while the cost of a false negative is a live credential in a file you hand to
someone else.

Stripping query strings is not anonymization. A screenshot of an authenticated page can show account
names, balances, and email addresses no matter what the URL says, and the note also stores DOM text
from the region you captured. Read
[understand what leaves the device](getting-started.md#understand-what-leaves-the-device) before
sending a bundle to a hosted service.

## Shortcuts

The **Toggle capture** row shows the keyboard shortcut the browser has bound. The extension asks for
`Command+Shift+P` on macOS and `Ctrl+Shift+P` elsewhere at install time.

The row's own help text reads "show or hide the overlay on the active tab", and that understates
what the shortcut does. It is the _same gesture as the toolbar icon_, not a lighter-weight version
of it: it fires the browser action, so it follows the identical session path — starting a session on
an eligible page when none is active, pausing a running one, and resuming a paused one. The overlay
appearing and disappearing is the visible half of that; the durable session pausing underneath is
the half the label does not mention.

So do not reach for it to get the overlay back after navigating. A running session already remounts
the overlay on each page you load, and pressing the shortcut at that point pauses the session rather
than refreshing the overlay. Press it again to resume.

Ending a session is a separate gesture again: only **Compile plan** in the side panel completes one.
Neither the shortcut nor the toolbar icon ends a session — they pause and resume it.

The browser owns shortcut assignment, so this section reports what the browser has actually bound
rather than what the extension asked for. If another extension already holds the combination, or you
cleared it, the requested default is never granted and the section reads **Not assigned** — the
displayed value is always the real one, so trust it over the default above.

The extension cannot rebind the shortcut itself. Select **Manage browser shortcuts** to open the
page that can: `chrome://extensions/shortcuts` on Chrome, or `about:addons` on Firefox.

## Sessions

Lists every session stored in this browser profile, and lets you get back into one or remove it.

Each entry shows the session name, its creation time in your local time zone, its note count, and
its status: **Running**, **Paused**, or **Completed**. The flat list also labels each row with the
domain the session started on; grouped mode drops that label, because the group heading already
carries it.

### Group by domain

A toggle, **off** by default. It is remembered separately from the settings above, and is a view
preference only — it never changes stored data. It is also the one control on this page that saves
without telling you whether it worked, as [how saving works](#how-saving-works) describes.

Off, sessions are listed flat, newest first, each row labeled with its domain. On, they are
collected into collapsible groups by the hostname captured when the session started, sorted
alphabetically, with a count on each group. Turn it on once you have accumulated sessions across
several projects and want only the one application in front of you.

Sessions with no recoverable hostname — captured on a page whose URL cannot be parsed, such as a
browser-internal tab — collect under a group named **No domain** alongside the real hostnames.

The grouping uses the hostname from the _start_ of the session. A session that began on a staging
host and continued onto production stays filed under the host it started on.

### Load in side panel

Reopens that session in the notes side panel, where you can read and edit its notes, rename it, and
compile a plan from it. This is how you return to a completed session days later to export it again,
and how you pick a session back up when you have several on the go.

Loading a session into the panel does not resume capturing on it. The toolbar icon still owns the
session lifecycle.

### Delete

Removes one session with its notes and screenshots, after a confirmation dialog that names the
session and its note count. It cannot be undone, so export anything you still want first.

## Data

The tab is labeled **Data**; the panel heading inside it reads **Stored data**. It covers everything
the extension has stored on this device. Captured screenshots and notes live in extension-owned
local storage; they are never uploaded.

### Clear all sessions

Permanently deletes every session, note, and screenshot in one action. Your settings are kept, so
the choices you made in the sections above survive.

Selecting it opens a confirmation dialog, because there is no undo and no recycle bin. Export any
session you still need before confirming. The footer reports **Clearing sessions…** and then **All
sessions cleared.**

Reach for it when you have finished a batch of bug reports and want the stored screenshots gone, or
when you captured something on an authenticated page and would rather it not sit on disk. To remove
a single session instead, use **Delete** on the [Sessions](#sessions) tab.

## Next steps

- [Get started](getting-started.md) for the full capture-to-export walkthrough.
- [Use Point and Shoot with Playwright](playwright-companion.md) to drive a local app beside the
  extension.
- [Troubleshoot and understand known limits](troubleshooting.md) when a page or target will not
  capture.
- [Extension settings](../specs/settings.md) for the normative schema, allowed values, and storage
  behavior behind this page.
- [Framework component hints](../specs/framework-component-hints.md) for the exact opt-in,
  execution-world, and failure contract of that one switch.
