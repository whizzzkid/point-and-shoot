# Tutorials

These guides walk through Point and Shoot tasks from source build to agent handoff:

- [Get started](getting-started.md) — install the extension, capture a multi-page session, and
  export it.
- [Manage a Point and Shoot session](sessions.md) — the full session lifecycle: start, capture
  across pages, pause and resume, rename, manage notes, browse past sessions, end, and clear
  storage.
- [Configure Point and Shoot options](options.md) — every settings section, what each control
  changes, and the value it ships with.
- [Compile a plan and export it](exporting.md) — select notes, wrap the plan in your own prompts,
  and choose between the standalone prompt and the full bundle.
- [Use Point and Shoot with Playwright](playwright-companion.md) — load the unpacked Chrome build in
  a headed persistent Chromium context beside a local app.
- [Troubleshoot and understand known limits](troubleshooting.md) — restricted pages, closed shadow
  roots, cross-origin iframes, viewport-clamped captures, size limits, and recovery steps.
- [Test and publish a release](releasing.md) — review Release Please's accumulated changes, test
  both browser packages, and merge the release pull request.

Every command in these guides is part of the verified build and release workflow. The guides
describe shipped behavior, including failure states, rather than an idealized future flow.
