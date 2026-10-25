import { execFileSync } from "node:child_process";

export function resolve_build_id(
  env: Record<string, string | undefined>,
  git: () => string | null,
): string {
  const sha = env.RENDER_GIT_COMMIT;
  if (sha !== undefined && sha !== "") return sha;
  try {
    const g = git();
    return g !== null && g !== "" ? g : "dev";
  } catch {
    return "dev";
  }
}

export function git_short_sha(): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}
