# Visual regression

The visual suite captures the component gallery, injected toolbar, notes panel, plan view, popup,
and options page in forced dark and light themes. It compares each PNG with its committed baseline
and allows at most 0.1% of pixels to differ.

## Run comparisons

Use the pinned Ubuntu 24.04 Playwright image so the browser, fonts, and operating system match CI:

```bash
docker run --rm --platform linux/amd64 \
  --env PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  --volume "$PWD:/work" \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.62.0-noble \
  bash -lc 'npx --yes deno@2.9.4 task visual'
```

Do not use a macOS comparison to decide whether a committed Linux baseline is correct. Font
rendering differs across operating systems.

## Update baselines intentionally

Run the update task only when the visual change is expected:

```bash
docker run --rm --platform linux/amd64 \
  --env PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  --volume "$PWD:/work" \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.62.0-noble \
  bash -lc 'npx --yes deno@2.9.4 task visual:update'
```

Review every changed PNG under `tests/visual/baselines/` and include it in the pull request diff.
Never update a baseline merely to make an unexplained failure pass.

## Review a failure

When a comparison exceeds the tolerance, the suite writes three images to
`playwright-report/visual/diffs/`:

- `<surface>-<theme>-actual.png`
- `<surface>-<theme>-expected.png`
- `<surface>-<theme>-diff.png`

The visual CI job can upload that directory when it fails, so the change can be reviewed without
reproducing it locally.
