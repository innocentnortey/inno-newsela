// NL-108 (WF-46): gather the facts the kickoff page shows. Pure reads of tracked files, sync node:fs, no DB/model/network.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { locked_hash } from "@ls/prompts/locked";
import { resolve_git_sha } from "../git-sha.ts";

export interface PromptLayer {
  file: string;
  kind: "common" | "task";
  task: "plan" | "draft" | "repair" | "assist" | "judge" | "all";
  text: string;
  sha256: string;
  version: string;
}
export interface PipelineNode { name: string; file: string; cls: string }
export interface FcRow { id: string; title: string; means: string; fix_lives_in: string }
export interface FtRow { id: string; title: string; file: string }
export interface KickoffData {
  layers: PromptLayer[];
  locked_hash: string;
  guidance_v1: string;
  nodes: PipelineNode[];
  renderers: string[];
  route_table: string[];
  hp1_card: string;
  settled: Record<string, string>;
  fc: FcRow[];
  ft: FtRow[];
  footer: { git_sha: string; generator_version: string; generated_at: string };
}
export interface CollectOpts {
  now?: () => Date;
  git_sha?: string;
  env?: Record<string, string | undefined>;
}

export const GENERATOR_VERSION = "1";
/** PgPromptRepo.sync_locked_layer (packages/db/src/repos/prompts.ts ~line 106) seeds guidance v1 with guidance_text = "". */
export const GUIDANCE_V1_SEEDED = "";

const COMMON = new Set(["content-rules.md", "data-delimiters.md", "grounding-rules.md", "lesson-shape.md"]);
const TASK_OF: Record<string, PromptLayer["task"]> = {
  "unit-plan.md": "plan",
  "lesson-draft.md": "draft",
  "repair.md": "repair",
  "assist.md": "assist",
  "judge.md": "judge",
};
const NODE_ORDER = ["draft", "compile_check", "repair", "store", "fail"];
export const SETTLED_KEYS = ["model", "effort", "max_tokens", "concurrency", "per_run_cap", "per_call_timeout"] as const;

/** The refusal check: no collector may read a path under the git-ignored source folder. */
export function assert_not_restricted(p: string): void {
  if (/restricted/i.test(path.resolve(p))) throw new Error("refusing to read a withheld path");
}

function read(p: string): string {
  assert_not_restricted(p);
  return readFileSync(p, "utf8");
}

function list(dir: string): string[] {
  assert_not_restricted(dir);
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function collect_layers(root: string): PromptLayer[] {
  const dir = path.join(root, "packages/prompts/locked");
  return list(dir)
    .filter((n) => n.endsWith(".md"))
    .map((file) => {
      const text = read(path.join(dir, file));
      const sha256 = createHash("sha256").update(readFileSync(path.join(dir, file))).digest("hex");
      const common = COMMON.has(file);
      return {
        file,
        kind: common ? "common" : "task",
        task: common ? "all" : (TASK_OF[file] ?? "all"),
        text,
        sha256,
        version: sha256.slice(0, 12),
      } satisfies PromptLayer;
    });
}

function collect_nodes(root: string): PipelineNode[] {
  const dir = path.join(root, "apps/worker/src/generation/nodes");
  const found = list(dir)
    .filter((n) => n.endsWith("-node.ts"))
    .map((file) => {
      const m = /export class (\w+)/.exec(read(path.join(dir, file)));
      return { name: file.replace(/-node\.ts$/, "").replace(/-/g, "_"), file, cls: m?.[1] ?? "(no class)" };
    });
  const rank = (n: string): number => {
    const i = NODE_ORDER.indexOf(n);
    return i < 0 ? NODE_ORDER.length : i;
  };
  return found.sort((a, b) => rank(a.name) - rank(b.name));
}

function collect_renderers(root: string): string[] {
  const f = path.join(root, "packages/prompts/src/render.ts");
  return [...read(f).matchAll(/^\s+(render_\w+)\(/gm)].map((m) => m[1] as string);
}

function collect_route_table(root: string): string[] {
  const lines = read(path.join(root, "docs/design/component-contracts.md")).split("\n");
  const at = lines.findIndex((l) => l.startsWith("# Decision table (G-22)"));
  if (at < 0) throw new Error("decision table not found");
  const rows: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^# {3}(\S.*)$/.exec(l);
    if (!m) break;
    rows.push((m[1] as string).trim());
  }
  if (rows.length === 0) throw new Error("decision table not found");
  return rows;
}

function collect_hp1(root: string): string {
  const text = read(path.join(root, "docs/design/hard-problems.md"));
  const a = text.indexOf('<a id="hp-1"></a>');
  const b = text.indexOf('<a id="hp-2"></a>');
  if (a < 0 || b < a) throw new Error("HP-1 card not found");
  return text.slice(a, b).trimEnd();
}

function collect_settled(root: string): Record<string, string> {
  const text = read(path.join(root, "docs/analysis/spikes/SP-1-one-call-draft.md"));
  const grab = (re: RegExp): string => re.exec(text)?.[1]?.trim() ?? "not found in SP-1";
  return {
    model: grab(/Model `([^`]+)`/),
    effort: grab(/effort (\w+),/),
    max_tokens: grab(/`max_tokens` ([\d,]+)(?:\s*\(|;|\.|,|$)/m),
    concurrency: grab(/PD-13 concurrency cap:\*\* \*\*(\d+)\*\*/),
    per_run_cap: grab(/\*\*(\$[\d.]+) per run\*\*/),
    per_call_timeout: grab(/Per-call timeout \*\*(\d+ s)\*\*/),
  };
}

function collect_fc(root: string): FcRow[] {
  const text = read(path.join(root, "docs/design/eval-plan.md"));
  const rows: FcRow[] = [];
  for (const l of text.split("\n")) {
    const m = /^\| (FC-\d+) ([^|]+)\|([^|]*)\|([^|]*)\|/.exec(l);
    if (m) rows.push({ id: m[1] as string, title: (m[2] as string).trim(), means: (m[3] as string).trim(), fix_lives_in: (m[4] as string).trim() });
  }
  return rows;
}

function collect_ft(root: string): FtRow[] {
  const dir = path.join(root, "docs/testing/error-analysis");
  const rows: FtRow[] = [];
  for (const file of list(dir).filter((n) => n.endsWith(".md"))) {
    for (const m of read(path.join(dir, file)).matchAll(/^#{1,6}\s*(FT-\d+)\b[:.\s-]*(.*)$/gm)) {
      rows.push({ id: m[1] as string, title: (m[2] as string).trim(), file });
    }
  }
  return rows;
}

export function collect_kickoff(root: string, opts: CollectOpts = {}): KickoffData {
  const now = opts.now ?? (() => new Date());
  return {
    layers: collect_layers(root),
    locked_hash: locked_hash(path.join(root, "packages/prompts/locked")),
    guidance_v1: GUIDANCE_V1_SEEDED,
    nodes: collect_nodes(root),
    renderers: collect_renderers(root),
    route_table: collect_route_table(root),
    hp1_card: collect_hp1(root),
    settled: collect_settled(root),
    fc: collect_fc(root),
    ft: collect_ft(root),
    footer: {
      git_sha: opts.git_sha ?? resolve_git_sha(opts.env ?? {}),
      generator_version: GENERATOR_VERSION,
      generated_at: now().toISOString(),
    },
  };
}
