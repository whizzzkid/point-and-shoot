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

- `chrome-<version>.zip`
- `firefox-<version>.zip`
- `firefox-source.zip`
- `firefox-build-instructions.md`

The `<version>` matches the CalVer identifier the release pull request updated (for example
`chrome-2026.813.1.zip`). The files are built from the exact release pull request head SHA shown in
the comment. They are candidate and reviewer artifacts, not consumer store-install links. Download
and extract `chrome-<version>.zip`, open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select the extracted directory. For Firefox, extract `firefox-<version>.zip`, open
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
   mise exec -- deno task release:compare /path/to/submitted-firefox.zip dist/firefox-<version>.zip
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
and reviewer artifacts to the release. The workflow preserves the generated release notes and adds a
marked **Browser store publication** section with the expected version and both stores set to
`unpublished`. The follow-on browser-store workflow is initially disabled. It records that state in
the release body and completes without reading Chrome or Firefox credentials.

Do not turn an attached ZIP into a public install call to action. The release status must show a
store as `published`, its public version must match the GitHub release, and its live listing URL
must be recorded before the URL is presented as the install path. If the canonical listing summary
changed, update the Chrome Web Store copy in its dashboard and record that manual action during
release closeout; the Chrome publishing API does not own listing-copy updates.

Do not create or push the tag by hand. Release Please's `autorelease: pending` and
`autorelease: tagged` labels track whether the pull request is waiting to merge or has been
released.

## Configure browser-store automation

Both listings are published. The repository is configured so that merging a release PR automatically
submits the new version to both stores. The `publish` job in `.github/workflows/store-publish.yml`
runs in the protected `browser-stores` GitHub environment, which gates credential access.

### Repository variables

Set under **Settings > Secrets and variables > Actions > Variables tab** (not Secrets — none of
these are secret):

| Variable                         | Value                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `STORE_PUBLISH_ENABLED`          | `true` (fail-closed gate; any other value runs the `disabled` job instead of `publish`) |
| `CHROME_EXTENSION_ID`            | `efiaamiohjjhhcgeaihgmbajnamhbahb`                                                      |
| `CHROME_PUBLISHER_ID`            | `d40d655e-e8ab-491b-9fc7-f5220fdca1c7`                                                  |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity Provider resource name (see Chrome OIDC below)                   |
| `GCP_SERVICE_ACCOUNT`            | Service account email linked in the Chrome Web Store developer dashboard                |

### Protected environment secrets

Create a GitHub environment named `browser-stores` under **Settings > Environments**. Add two
**secrets** (these are the only actual secrets in the store-publish pipeline):

| Secret               | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| `WEB_EXT_API_KEY`    | AMO JWT issuer from the Firefox Add-ons developer hub API Keys |
| `WEB_EXT_API_SECRET` | AMO JWT secret from the same page                              |

The Firefox stable ID `pointandshoot@whizzzkid.dev` is hardcoded in the workflow; it is verified,
not configurable.

### Chrome OIDC setup (GCP Workload Identity Federation)

The Chrome publishing step authenticates via OIDC — no long-lived API key is stored. GCP setup
requires a **project ID** (human-readable string, e.g. `my-cws-project`) and a **project number**
(numeric, e.g. `123456789012`); both are shown at https://console.cloud.google.com/welcome. `gcloud`
commands use the project ID; the Workload Identity Provider resource name uses the project number.

1. Enable the Chrome Web Store API:
   `gcloud services enable chromewebstore.googleapis.com --project=PROJECT_ID`
2. Create a service account:
   `gcloud iam service-accounts create cws-publish --display-name="Chrome Web Store Publisher" --project=PROJECT_ID`
3. Create a Workload Identity Pool:
   `gcloud iam workload-identity-pools create github-actions --location=global --display-name="GitHub Actions" --project=PROJECT_ID`
4. Create an OIDC Provider restricted to this repository:
   `gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github-actions --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.job_workflow_ref=assertion.job_workflow_ref" --attribute-condition="assertion.repository=='whizzzkid/point-and-shoot' && assertion.job_workflow_ref=='whizzzkid/point-and-shoot/.github/workflows/store-publish.yml@refs/heads/main'" --project=PROJECT_ID`
5. Grant the pool permission to impersonate the service account:
   `gcloud iam service-accounts add-iam-policy-binding cws-publish@PROJECT_ID.iam.gserviceaccount.com --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/whizzzkid/point-and-shoot" --project=PROJECT_ID`
6. In the Chrome Web Store developer dashboard under **Settings > API Access**, add the service
   account email (`cws-publish@PROJECT_ID.iam.gserviceaccount.com`) directly.
7. Set repository variables:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` =
     `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github`
   - `GCP_SERVICE_ACCOUNT` = `cws-publish@PROJECT_ID.iam.gserviceaccount.com`

The workflow requests the `chromewebstore` OAuth scope through `google-github-actions/auth@v3`. Do
not create or store a long-lived service-account JSON key. See the official
[Chrome Web Store service-account setup](https://developer.chrome.com/docs/webstore/service-accounts)
and
[GitHub-to-Google OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform).

New releases then upload the exact attached Chrome ZIP and a Firefox package deterministically
created from the attached Firefox ZIP. They never rebuild store inputs from a moving branch. Chrome
warnings block publication. Firefox submissions include the reviewer source archive and the current
version summary as release notes.

## Reconcile, retry, and disable publication

Run **Browser store publication** from the Actions page with `operation` set to `reconcile`, the
exact `v`-prefixed tag, and the tag's commit SHA to refresh review and public-version state without
uploading. Use `submit` with the same exact inputs to retry a partial vendor failure. Matching
versions are idempotent; a different pending version is a hard failure.

For a vendor rejection, leave the immutable tag and existing release assets unchanged. Address the
review finding in a new pull request and CalVer release, unless the vendor explicitly permits a
metadata-only correction. Chrome listing-copy changes remain a dashboard action because API v2 does
not expose listing-copy mutation.

For emergency disablement, set `STORE_PUBLISH_ENABLED` to `false`. Future releases then record a
disabled status without resolving vendor secrets. Rotate the AMO credentials in the protected
environment; rotate the Google federation binding or service account in Google Cloud and update the
two repository variables. Never print a credential while testing rotation.

Vendor behavior is defined by the current
[Chrome Web Store API v2 reference](https://developer.chrome.com/docs/webstore/api/reference/rest)
and Mozilla's
[`web-ext sign` reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).

## Recover a failed release

If preview packaging fails, fix the release pull request or its source configuration and rerun the
failed workflow. Do not merge without all four artifacts.

If tagging succeeds but an asset upload fails, rerun the failed workflow. Uploads use replacement
semantics, so a retry repairs a partial release without failing because one ZIP already exists. The
workflow remains red until all four asset names are present. If release-body seeding fails after the
assets upload, rerun the failed job; the marked update is idempotent and leaves existing release
notes unchanged.

If released code is faulty, revert or fix it on `main` and publish a new CalVer release. Do not move
or replace a published tag: an immutable tag keeps installed packages and audit history tied to the
bytes reviewers tested.

While `STORE_PUBLISH_ENABLED` is `false`, Chrome Web Store and Firefox Add-ons submission remain
manual. In either mode, GitHub release packages are not evidence that a store has reviewed or
published them; rely on the reconciled public version and live listing URL.

For the underlying automation behavior, see Release Please's
[manifest-driven configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
and the [Release Please action](https://github.com/googleapis/release-please-action).
