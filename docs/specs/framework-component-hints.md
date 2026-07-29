# Framework component hints

Framework hints are optional, untrusted evidence naming the likely source component for a reachable
captured element. They help a fix agent start near the owning component, but never replace selector
or computed-style evidence.

## Opt-in and data flow

The `frameworkHints` setting defaults to `false`. With that value, the content realm sends no probe
request and the background does not execute page-world code. The background reads the persisted
setting again for every request, so a malformed or compromised content request cannot bypass the
opt-in.

When enabled:

1. The content realm sends the reachable elements' verified `cssPath` segment arrays in one bounded
   request.
2. The background targets the sender's tab and frame and executes the pure probe once with
   `world: "MAIN"`.
3. The page-world function resolves each path across open shadow roots and returns one hint or
   `null` per path.
4. The content realm validates the aligned result before attaching hints to note evidence.

One request contains between one and the settled maximum of 25 element paths. Unreachable elements,
including closed shadow interiors and cross-origin frames, are never probed.

## Evidence shape

An emitted hint contains:

| Field       | Type                                   | Meaning                                 |
| ----------- | -------------------------------------- | --------------------------------------- |
| `framework` | `react`, `vue`, `svelte`, or `angular` | Detected framework marker               |
| `name`      | Non-empty string, at most 1024 units   | Best-effort owning component name       |
| `file`      | Optional non-empty, at most 1024 units | Development-build source path           |
| `line`      | Optional positive integer              | One-based development-build source line |

Legacy stored hints carrying only `framework` and `name` remain valid. New probe results include
`file` and `line` only when the framework exposes them.

## Verified framework behavior

The browser fixture runs the real pinned builds offline:

- React `18.3.1` development mode: reads the host fiber key, walks the `return` chain, requires
  `_debugSource`, and emits the component name, file, and line. The matching production bundle has
  no `_debugSource` and produces no hint.
- Vue `3.5.40` development mode: reads `__vueParentComponent`, walks parent instances, and emits
  `name` plus `__file`. Vue does not expose a reliable source line through this marker, so `line` is
  omitted.

Svelte `__svelte_meta` and Angular `__ngContext__` plus `ng.getOwningComponent` are best-effort
fallbacks. No framework-version support claim is made for them until a real pinned fixture is added.

## Trust boundary and failures

Framework expandos belong to the page's JavaScript world and are not visible through an isolated
content-world wrapper. [ADR-0015](../adr/0015-main-world-framework-probes.md) therefore permits one
narrow main-world execution. Its arguments are page-derived CSS selectors, its result is
page-derived metadata, and it receives no extension secrets, storage, session records, or extension
API access.

The inspected page can detect, spoof, or interfere with this probe. Consumers must treat every hint
as advisory. A missing marker, stripped production build, hostile getter, selector miss, navigation
race, rejected injection, malformed result, or unsupported framework returns no hint. Probe failures
produce no console noise and never block screenshot capture or note storage.
