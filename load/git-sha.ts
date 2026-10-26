// NL-118: duplicated from evals/src/git-sha.ts on purpose (tools may not import each other).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function default_exec(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8", cwd: repo_root });
}

export function resolve_git_sha(
  env: Record<string, string | undefined>,
  run: (cmd: string, args: string[]) => string = default_exec,
): string {
  let sha: string;
  try {
    sha = run("git", ["rev-parse", "--short=12", "HEAD"]).trim();
  } catch {
    const fallback = env["BUILD_ID"] ?? env["RENDER_GIT_COMMIT"];
    if (fallback === undefined || fallback === "") throw new Error("cannot resolve git sha");
    return fallback.slice(0, 12);
  }
  // Reports are excluded so writing one does not flip the next run to dirty.
  const dirty = run("git", ["status", "--porcelain", "--", ".", ":(exclude)evals/reports"]).trim() !== "";
  return dirty ? `${sha}-dirty` : sha;
}
