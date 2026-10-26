// Provenance for the offline replay (F4-2, F4-5): which code, schema, template, check and prompt identities produced a
// result, a hash of the stored inputs, and the omissions (with timestamps) that keep the replay from being a lifecycle
// equivalent. Root is resolved from this file's location, so a copy inside a worktree reports that worktree.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import type { ReviewContextMode } from "./replay-finals.ts";
import type { ReadOnlyEvidence } from "./replay-finals-readonly.ts";

export const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface DirtyFile { status: string; path: string; sha256: string | null }
export interface CodeIdentity { commit: string; commit_date: string; dirty_files: DirtyFile[]; dirty_other_count: number; tracked_diff_sha256: string }
export interface TreeIdentity { sha256: string; files: Record<string, string> }
type Run = (cmd: string, args: string[]) => string;

const sha_of = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `git status --porcelain=v1 -z --untracked-files=all`: "XY path\0", and for renames/copies "XY new\0old\0". */
export function parse_porcelain_z(s: string): { status: string; path: string }[] {
  const parts = s.split("\0");
  const out: { status: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i] ?? "";
    if (e.length < 4) continue;
    const status = e.slice(0, 2);
    out.push({ status, path: e.slice(3) });
    if (status.includes("R") || status.includes("C")) i += 1; // the origin path is the next NUL field
  }
  return out;
}

const CODE_PREFIXES = ["packages/", "apps/worker/", "apps/collab/", "evals/src/", "evals/cases/", "scripts/", "docs/testing/"];
const DIFF_PATHS = ["packages", "apps/worker", "apps/collab", "evals/src", "evals/cases", "scripts"];

export function collect_code_identity(root: string = repo_root, run: Run = (c, a) => execFileSync(c, a, { encoding: "utf8", cwd: root, maxBuffer: 256 * 1024 * 1024 })): CodeIdentity {
  const commit = run("git", ["rev-parse", "HEAD"]).trim();
  const commit_date = run("git", ["show", "-s", "--format=%cI", "HEAD"]).trim();
  const entries = parse_porcelain_z(run("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]));
  const dirty_files: DirtyFile[] = [];
  let dirty_other_count = 0;
  for (const e of entries.sort((a, b) => cmp(a.path, b.path))) {
    if (!CODE_PREFIXES.some((p) => e.path.startsWith(p))) { dirty_other_count += 1; continue; }
    const abs = path.join(root, e.path);
    dirty_files.push({ status: e.status.trim(), path: e.path, sha256: existsSync(abs) && statSync(abs).isFile() ? sha_of(readFileSync(abs)) : null });
  }
  const tracked_diff_sha256 = sha_of(run("git", ["diff", "HEAD", "--", ...DIFF_PATHS]));
  return { commit, commit_date, dirty_files, dirty_other_count, tracked_diff_sha256 };
}

const SKIP_DIRS = new Set(["node_modules", "fixtures", "testing", "tests"]);
const is_test_file = (n: string): boolean => n.endsWith(".test.ts") || n.endsWith(".int.test.ts") || n === "test-helpers.ts";

function walk(dir: string, rel: string, out: Record<string, string>): void {
  for (const name of readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const r = rel === "" ? name : `${rel}/${name}`;
    const st = statSync(abs);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) walk(abs, r, out); }
    else if (!is_test_file(name)) out[r] = sha_of(readFileSync(abs));
  }
}
function combine(files: Record<string, string>): TreeIdentity {
  const lines = Object.keys(files).sort(cmp).map((k) => `${k}\0${files[k]}\n`).join("");
  return { sha256: sha_of(lines), files };
}

/** Non-test files under rel_dir (tests, fixtures, testing dirs and test-helpers.ts excluded). */
export function tree_identity(root: string, rel_dir: string): TreeIdentity {
  const abs = path.join(root, rel_dir);
  if (!existsSync(abs)) return { sha256: "absent", files: {} };
  const files: Record<string, string> = {};
  walk(abs, "", files);
  return combine(files);
}

const WIRING = ["apps/worker/src/wiring/generation.ts", "apps/worker/src/generation/nodes/compile-check-node.ts", "apps/worker/src/generation/nodes/front-matter-standards.ts"];
export function collect_identities(root: string = repo_root) {
  const wiring: Record<string, string> = {};
  for (const f of WIRING) wiring[f] = existsSync(path.join(root, f)) ? sha_of(readFileSync(path.join(root, f))) : "absent";
  return {
    schema: tree_identity(root, "packages/schema/src"),
    template_and_compile: tree_identity(root, "packages/core/src/compile"),
    checks: tree_identity(root, "packages/core/src/checks"),
    check_wiring: combine(wiring),
    prompt_locked_hash_current: locked_hash(LOCKED_DIR),
  };
}

export function omissions(as_of: Date, mode: ReviewContextMode, counts: { links: number; linked_lessons: number; dependency_states: number }): { item: string; effect: string; as_of: string }[] {
  const t = as_of.toISOString();
  return [
    { item: "cross-lesson links, linked lessons and dependency states cleared", effect: `affects cross_lesson_link, linked_text_changed and the waiting phase; cleared ${counts.links} links, ${counts.linked_lessons} linked lessons, ${counts.dependency_states} dependency states`, as_of: t },
    { item: "reviewer state", effect: mode === "generation_time"
      ? "safety flags, pending suggestions, confirmations, previous-lesson flags and unit coverage are emptied (the lesson was not stored when the original gate ran; StoreNode creates flags after the gate); affects safety_flag_open, suggestion_pending, standard_confirmation and coverage kinds"
      : "safety flags, pending suggestions, confirmations, previous-lesson flags and unit coverage are today's values (as_of is the database time) and are NOT what the original gate saw; affects safety_flag_open, suggestion_pending, standard_confirmation and coverage kinds", as_of: t },
    { item: "standards texts", effect: "read from today's database, not versioned; affects standard_not_taught, standard_not_checked, code_not_allowed and eld_label_mismatch", as_of: t },
    { item: "prompt not re-rendered", effect: "drafts were written under the run's prompt version; the run's and the current locked prompt hashes are recorded in provenance, no prompt rendering is replayed", as_of: t },
    { item: "no model call, no spend, no repair re-executed", effect: "a repair prompt built from today's findings would differ from the stored one; repairs are replayed only as stored outputs", as_of: t },
  ];
}

export interface ReplayProvenance {
  tool: "replay-finals"; label: string; analysis: "current-code reanalysis"; claims: string;
  started_at: string; finished_at: string; db_now: string;
  read_only: ReadOnlyEvidence; row_counts_before: Record<string, number>; row_counts_after: Record<string, number>;
  run: { run_id: string; unit_id: string; outline_version_id: string; prompt_version_id: string; prompt_locked_hash: string | null; choices_hash: string; choices_hash_basis: string; choices_count: number; created_at: string };
  code: CodeIdentity; identities: ReturnType<typeof collect_identities>;
  review_context: ReviewContextMode; lift: boolean; whiches: string[]; input_hash: string;
  omissions: ReturnType<typeof omissions>; calls_by_purpose: Record<string, number>;
}

export const claims_text = (commit: string): string =>
  `Re-checks stored model outputs on the code at ${commit}; it is not the original run's metric, not a forecast, and not a full lifecycle equivalent.`;
