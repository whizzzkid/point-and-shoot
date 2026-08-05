# Test and publish a release

Release Please maintains one release pull request from conventional commits merged into `main`. That
pull request updates the changelog, `version.txt`, the Release Please version manifest, and the
browser-manifest source together. Merging it creates the matching `v`-prefixed CalVer tag and GitHub
release. The same workflow attaches Chrome and Firefox store-submission packages plus the source and
build instructions required by Mozilla reviewers.

The version uses the UTC release date:

- `YYYY` is the year.
- The middle component, conventionally called `MMDD`, is the variable-width numeric encoding
  `month * 100 + day`, without a leading zero.
- `N` starts at `0` and increments for another release on the same UTC day.

For example, January 11 and November 1, 2026 become `2026.111.0` and `2026.1101.0`. They cannot
collide because the month occupies every digit before the final two day digits.

## Enable release pull requests

An administrator must enable **Allow GitHub Actions to create and approve pull requests** under
**Settings → Actions → General → Workflow permissions**. The release orchestration job grants
Release Please `contents`, `issues`, and `pull-requests` write access. It also grants
`actions: write` solely to dispatch CI for the generated release PR; build jobs use narrower
permissions.

The workflow intentionally uses GitHub's repository token instead of a personal access token. Events
produced by that token do not start another workflow, so `.github/workflows/release.yml` builds the
release pull request preview and final release assets in the same run as Release Please. It also
uses GitHub's recursion-safe `workflow_dispatch` exception to run the normal CI workflow against the
generated pull request head without requiring a personal access token or manual workflow approval.

## Accumulate changes

Merge ordinary pull requests into `main` with conventional titles such as `feat:`, `fix:`, or
`docs:`. On each push, Release Please creates or updates its existing release pull request and
collects the merged work into `CHANGELOG.md`.

The workflow computes the candidate version at run time and supplies it through Release Please's
`release-as` input. If the UTC date changes while the pull request remains open, the next update
moves the candidate to the new date. A second release on the same day increments `N`.

## Test the candidate packages

Wait for the release workflow's **preview** job. Its bot comment on the release pull request links
to a 14-day GitHub Actions artifact containing:

- `chrome.zip`
- `firefox.zip`
- `firefox-source.zip`
- `firefox-build-instructions.md`

The files are built from the exact release pull request head SHA shown in the comment. They are
candidate and reviewer artifacts, not consumer store-install links. Download and extract
`chrome.zip`, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select the extracted directory. For Firefox, extract `firefox.zip`, open
`about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select its
`manifest.json`. Temporary loads disappear when the browser profile closes.

Review both themes and complete at least one capture and export in each browser before merging.
Confirm that the tiny version marker at the bottom-right of the injected toolbar, notes and plan
views, popup, and options page matches the candidate version.

To reproduce the package checks from a local checkout of the release pull request, run:

```bash
mise exec -- deno task release:artifacts
mise exec -- deno task release:validate
```

The validator rejects a missing manifest key, version drift, remote URL, sourcemap, unsafe archive
path, leaked `dist/` path, missing reviewer artifact, or reviewer version/commit drift. It reports
each artifact size and the combined size.

## Verify the Firefox reviewer build

`firefox-source.zip` is an allowlisted snapshot of the tracked build inputs, not a repository
archive. Its companion instructions record the exact version, commit, pinned setup, and build
commands. To perform the same check expected of a Mozilla reviewer:

1. Extract `firefox-source.zip` into an empty directory.
2. Run the pinned setup and release build shown in `firefox-build-instructions.md`.
3. Compare the rebuilt package with the submitted Firefox package:

   ```bash
   mise exec -- deno task release:compare /path/to/submitted-firefox.zip dist/firefox.zip
   ```

The comparison intentionally ignores ZIP container metadata. It requires the same sorted paths and
the same uncompressed bytes for every entry.

## Publish

Confirm that the release pull request updates these version sources to the same candidate:

- `.release-please-manifest.json`
- `version.txt`
- `build/manifest.ts`
- the new `CHANGELOG.md` heading

Merge the release pull request. The next `main` run recognizes the merged release commit, creates
the matching `v`-prefixed CalVer tag and GitHub release, checks out the exact tagged SHA, rebuilds
both packages, and validates the tag against their manifests. It then attaches all four candidate
and reviewer artifacts to the release.

Do not create or push the tag by hand. Release Please's `autorelease: pending` and
`autorelease: tagged` labels track whether the pull request is waiting to merge or has been
released.

## Recover a failed release

If preview packaging fails, fix the release pull request or its source configuration and rerun the
failed workflow. Do not merge without all four artifacts.

If tagging succeeds but an asset upload fails, rerun the failed workflow. Uploads use replacement
semantics, so a retry repairs a partial release without failing because one ZIP already exists. The
workflow remains red until all four asset names are present.

If released code is faulty, revert or fix it on `main` and publish a new CalVer release. Do not move
or replace a published tag: an immutable tag keeps installed packages and audit history tied to the
bytes reviewers tested.

Chrome Web Store and Firefox Add-ons submission remain manual. The GitHub release packages are
installable artifacts, not evidence that either store has reviewed or published them.

For the underlying automation behavior, see Release Please's
[manifest-driven configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
and the [Release Please action](https://github.com/googleapis/release-please-action).
