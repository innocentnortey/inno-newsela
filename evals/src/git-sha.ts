// NL-49
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
