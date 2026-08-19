import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { encodeBase64 } from "@std/encoding/base64";

import {
  buildCommitInput,
  type CommitDependencies,
  createVerifiedCommit,
  parseChangedFiles,
} from "./ci-commit-verified.ts";

Deno.test("parseChangedFiles splits modified, untracked, and deleted paths", () => {
  const status = [" M a/mod.png", "?? a/new.png", " D a/gone.png"].join("\0") + "\0";
  assertEquals(parseChangedFiles(status), {
    additions: ["a/mod.png", "a/new.png"],
    deletions: ["a/gone.png"],
  });
});

Deno.test("parseChangedFiles treats a rename as delete-source plus add-target", () => {
  const status = "R  a/new.png\0a/old.png\0";
  assertEquals(parseChangedFiles(status), {
    additions: ["a/new.png"],
    deletions: ["a/old.png"],
  });
});

Deno.test("parseChangedFiles returns empty change sets for empty output", () => {
  assertEquals(parseChangedFiles(""), { additions: [], deletions: [] });
});

Deno.test("buildCommitInput maps additions and deletions to the GraphQL schema shape", () => {
  const input = buildCommitInput({
    nameWithOwner: "owner/repo",
    branchName: "feature",
    headOid: "abc123",
    headline: "chore: refresh",
    additions: [{ path: "a/new.png", contents: "Zm9v" }],
    deletions: ["a/gone.png"],
  });
  assertEquals(input, {
    branch: { repositoryNameWithOwner: "owner/repo", branchName: "feature" },
    message: { headline: "chore: refresh" },
    expectedHeadOid: "abc123",
    fileChanges: {
      additions: [{ path: "a/new.png", contents: "Zm9v" }],
      deletions: [{ path: "a/gone.png" }],
    },
  });
});

function stubDeps(overrides: Partial<CommitDependencies> = {}): CommitDependencies {
  return {
    runGit: (args) =>
      Promise.resolve(
        args[0] === "rev-parse" ? "headoid\n" : " M base/a.png\0",
      ),
    readFile: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    fetch: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: { createCommitOnBranch: { commit: { oid: "new-oid" } } } }),
          {
            status: 200,
          },
        ),
      ),
    log: () => {},
    token: "t",
    nameWithOwner: "owner/repo",
    branchName: "feature",
    ...overrides,
  };
}

Deno.test("createVerifiedCommit posts a verified commit and returns its oid", async () => {
  let captured: { url: string; body: string; auth: string } | null = null;
  const oid = await createVerifiedCommit(
    "base",
    "chore: refresh",
    stubDeps({
      fetch: ((url, init) => {
        captured = {
          url: String(url),
          body: String(init?.body),
          auth: String((init?.headers as Record<string, string>)["Authorization"]),
        };
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { createCommitOnBranch: { commit: { oid: "new-oid" } } } }),
            {
              status: 200,
            },
          ),
        );
      }) as typeof fetch,
    }),
  );

  assertEquals(oid, "new-oid");
  assertStringIncludes(captured!.url, "api.github.com/graphql");
  assertEquals(captured!.auth, "bearer t");
  const parsed = JSON.parse(captured!.body);
  assertEquals(parsed.variables.input.expectedHeadOid, "headoid");
  assertEquals(parsed.variables.input.fileChanges.additions[0].path, "base/a.png");
  assertEquals(
    parsed.variables.input.fileChanges.additions[0].contents,
    encodeBase64(new Uint8Array([1, 2, 3])),
  );
});

Deno.test("createVerifiedCommit skips the request when nothing changed", async () => {
  let fetched = false;
  const oid = await createVerifiedCommit(
    "base",
    "chore: refresh",
    stubDeps({
      runGit: () => Promise.resolve(""),
      fetch: (() => {
        fetched = true;
        return Promise.resolve(new Response("{}", { status: 200 }));
      }) as typeof fetch,
    }),
  );
  assertEquals(oid, null);
  assertEquals(fetched, false);
});

Deno.test("createVerifiedCommit throws on a non-2xx response", async () => {
  await assertRejects(
    () =>
      createVerifiedCommit(
        "base",
        "chore: refresh",
        stubDeps({
          fetch: (() => Promise.resolve(new Response("nope", { status: 403 }))) as typeof fetch,
        }),
      ),
    Error,
    "403",
  );
});

Deno.test("createVerifiedCommit throws when GraphQL returns errors", async () => {
  await assertRejects(
    () =>
      createVerifiedCommit(
        "base",
        "chore: refresh",
        stubDeps({
          fetch: (() =>
            Promise.resolve(
              new Response(JSON.stringify({ errors: [{ message: "stale expectedHeadOid" }] }), {
                status: 200,
              }),
            )) as typeof fetch,
        }),
      ),
    Error,
    "stale expectedHeadOid",
  );
});
