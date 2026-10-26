// NL-121: the report may only be written to a git-ignored, untracked path (AC-3).
import { spawnSync } from "node:child_process";

export class RefusedPath extends Error {} // message is a fixed sentence, never path contents

export function assert_output_ignored(
  repo_root: string,
  rel_path: string,
  run: (args: string[]) => number = (args) => spawnSync("git", args, { cwd: repo_root }).status ?? 1,
): void {
  const ignored = run(["check-ignore", "-q", "--", rel_path]) === 0;
  const tracked = run(["ls-files", "--error-unmatch", "--", rel_path]) === 0;
  if (!ignored || tracked) throw new RefusedPath("output path is not git-ignored or is tracked");
}
