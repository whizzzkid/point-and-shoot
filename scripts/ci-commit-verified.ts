import { encodeBase64 } from "@std/encoding/base64";

/**
 * Commits generated files back to a pull-request branch through GitHub's GraphQL
 * `createCommitOnBranch` mutation instead of `git commit` + `git push`. Commits
 * authored through the API are signed by GitHub, so the branch stays composed of
 * verified commits — a plain `git push` from CI produces unverified commits that
 * a "require signed commits" ruleset would reject.
 */

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const CREATE_COMMIT_MUTATION = `
mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) {
    commit { oid }
  }
}`;

/** A single file the commit adds or overwrites, with base64-encoded contents. */
export interface FileAddition {
  readonly path: string;
  readonly contents: string;
}

/** Repo-relative paths a commit adds/overwrites and removes, split by change kind. */
export interface ChangedFiles {
  readonly additions: readonly string[];
  readonly deletions: readonly string[];
}

/** Inputs for one `createCommitOnBranch` mutation, matching the GraphQL schema. */
export interface CommitInput {
  readonly branch: {
    readonly repositoryNameWithOwner: string;
    readonly branchName: string;
  };
  readonly message: { readonly headline: string };
  readonly expectedHeadOid: string;
  readonly fileChanges: {
    readonly additions: readonly FileAddition[];
    readonly deletions: readonly { readonly path: string }[];
  };
}

/** Injected side effects so the orchestration stays unit-testable without a network or repo. */
export interface CommitDependencies {
  readonly runGit: (args: readonly string[]) => Promise<string>;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly fetch: typeof fetch;
  readonly log: (message: string) => void;
  readonly token: string;
  readonly nameWithOwner: string;
  readonly branchName: string;
}

/**
 * Splits `git status --porcelain=v1 -z` output into added/overwritten vs. deleted paths.
 *
 * @param porcelainZ - The NUL-separated porcelain-v1 status output for the target pathspec.
 * @returns The repo-relative paths to add/overwrite and the paths to delete.
 */
export function parseChangedFiles(porcelainZ: string): ChangedFiles {
  const tokens = porcelainZ.split("\0").filter((token) => token.length > 0);
  const additions: string[] = [];
  const deletions: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const entry = tokens[index];
    if (entry === undefined) {
      continue;
    }
    const staged = entry[0];
    const unstaged = entry[1];
    const path = entry.slice(3);
    if (staged === "R" || staged === "C" || unstaged === "R" || unstaged === "C") {
      // With -z a rename/copy is followed by its source path as the next token.
      const source = tokens[index + 1];
      index += 1;
      if (source !== undefined) {
        deletions.push(source);
      }
      additions.push(path);
    } else if (staged === "D" || unstaged === "D") {
      deletions.push(path);
    } else {
      additions.push(path);
    }
  }
  return { additions, deletions };
}

/**
 * Assembles the `CreateCommitOnBranchInput` payload for the mutation.
 *
 * @param options - The target branch identity, expected head, message, and file changes.
 * @returns The GraphQL input object for `createCommitOnBranch`.
 */
export function buildCommitInput(options: {
  readonly nameWithOwner: string;
  readonly branchName: string;
  readonly headOid: string;
  readonly headline: string;
  readonly additions: readonly FileAddition[];
  readonly deletions: readonly string[];
}): CommitInput {
  return {
    branch: {
      repositoryNameWithOwner: options.nameWithOwner,
      branchName: options.branchName,
    },
    message: { headline: options.headline },
    expectedHeadOid: options.headOid,
    fileChanges: {
      additions: options.additions.map((addition) => ({
        path: addition.path,
        contents: addition.contents,
      })),
      deletions: options.deletions.map((path) => ({ path })),
    },
  };
}

/**
 * Regenerated files under `pathspec` are committed to the branch as one verified commit.
 *
 * @param pathspec - The repo-relative directory or path to inspect for changes.
 * @param headline - The commit message headline.
 * @param deps - Injected git, filesystem, network, and configuration dependencies.
 * @returns The new commit OID, or null when nothing under `pathspec` changed.
 */
export async function createVerifiedCommit(
  pathspec: string,
  headline: string,
  deps: CommitDependencies,
): Promise<string | null> {
  const status = await deps.runGit(["status", "--porcelain=v1", "-z", "--", pathspec]);
  const { additions, deletions } = parseChangedFiles(status);
  if (additions.length === 0 && deletions.length === 0) {
    deps.log(`no changes under ${pathspec}; nothing to commit`);
    return null;
  }

  const headOid = (await deps.runGit(["rev-parse", "HEAD"])).trim();
  const encodedAdditions: FileAddition[] = [];
  for (const path of additions) {
    encodedAdditions.push({ path, contents: encodeBase64(await deps.readFile(path)) });
  }

  const input = buildCommitInput({
    nameWithOwner: deps.nameWithOwner,
    branchName: deps.branchName,
    headOid,
    headline,
    additions: encodedAdditions,
    deletions,
  });

  const response = await deps.fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `bearer ${deps.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: CREATE_COMMIT_MUTATION, variables: { input } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as {
    data?: { createCommitOnBranch?: { commit?: { oid?: string } } };
    errors?: readonly { message: string }[];
  };
  if (payload.errors !== undefined && payload.errors.length > 0) {
    throw new Error(
      `GitHub GraphQL errors: ${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }

  const oid = payload.data?.createCommitOnBranch?.commit?.oid;
  if (oid === undefined) {
    throw new Error("GitHub GraphQL response did not include a commit oid");
  }
  deps.log(`committed ${additions.length} addition(s), ${deletions.length} deletion(s) as ${oid}`);
  return oid;
}

/**
 * Reads a required environment variable, throwing when it is unset or empty.
 *
 * @param name - The environment-variable name.
 * @returns The variable's value.
 */
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * CLI entrypoint: `ci-commit-verified.ts <pathspec> <headline>`.
 *
 * @param args - Positional arguments: the pathspec to inspect and the commit headline.
 */
export async function runCommand(args: readonly string[]): Promise<void> {
  const [pathspec, headline] = args;
  if (pathspec === undefined || headline === undefined) {
    throw new Error("usage: ci-commit-verified.ts <pathspec> <headline>");
  }
  await createVerifiedCommit(pathspec, headline, {
    runGit: async (gitArgs) => {
      const command = new Deno.Command("git", {
        args: [...gitArgs],
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stdout, stderr } = await command.output();
      if (!success) {
        throw new Error(`git ${gitArgs.join(" ")} failed: ${new TextDecoder().decode(stderr)}`);
      }
      return new TextDecoder().decode(stdout);
    },
    readFile: (path) => Deno.readFile(path),
    fetch,
    log: (message) => console.log(message),
    token: requireEnv("GITHUB_TOKEN"),
    nameWithOwner: requireEnv("GITHUB_REPOSITORY"),
    branchName: requireEnv("GITHUB_HEAD_REF"),
  });
}

if (import.meta.main) {
  await runCommand(Deno.args);
}
