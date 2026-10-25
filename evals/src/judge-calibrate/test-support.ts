// NL-111 test doubles: synthetic lesson and standards readers, a recording call log, and the deps for run_judge_calibrate.
import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import type { SecretStr } from "@ls/config/secret";
import type { ModelCallId, ModelPrice } from "@ls/core/ports/common";
import type { JudgeClient } from "@ls/core/ports/judge-client";
import type { DerivedRow, LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { ModelCallCompletion, ModelCallLog, ModelCallStart, ProviderErrorRecord } from "@ls/core/ports/model-call-log";
import type { StandardRepo, StandardRow } from "@ls/core/ports/standards";
import { StubJudgeClient } from "@ls/llm/stub";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import { parse_labels, type LabelRow } from "./labels.ts";
import type { MainDeps, Repos } from "./main.ts";

export const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, "fixtures/labels-30.csv"), "utf8");
export const HASH = "0123456789abcdef".repeat(4);
export const PRICE: ModelPrice = {
  model_id: "judge-test", input_per_mtok: new Decimal("1"), output_per_mtok: new Decimal("2"),
  cache_read_per_mtok: new Decimal("0.1"), cache_write_per_mtok: new Decimal("1.25"),
};

export const labels = (): LabelRow[] => parse_labels(FIXTURE);
/** Dev rows first, then holdout, as the run processes them. */
export const ordered = (): LabelRow[] => [...labels().filter((r) => r.split === "dev"), ...labels().filter((r) => r.split === "holdout")];

/** A stub that agrees with every label except the pair_ids in `flip`. */
export function scripted_judge(flip: string[]): StubJudgeClient {
  return new StubJudgeClient(ordered().map((r) => ({ verdict: flip.includes(r.pair_id) ? (r.label === "yes" ? "no" : "yes") : r.label })));
}
// 26 agreements: 3 dev and 1 holdout disagree (dev 17/20 = 0.85, holdout 9/10 = 0.90)
export const FLIP_4 = ["p01", "p02", "p04", "p21"];

export class SyntheticLessons implements LessonDocReader {
  constructor(private readonly hash = HASH, private readonly present = true) {}
  async latest(): Promise<null> { return null; }
  async latest_derived(): Promise<DerivedRow | null> {
    if (!this.present) return null;
    const sections = Array.from({ length: 30 }, (_, i) => {
      const address = `sec-${String(i + 1).padStart(2, "0")}`;
      return {
        address, name: address, minutes: 5,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `synthetic activity ${address}` }] }] },
      };
    });
    return { content_hash: this.hash, lesson: { sections } } as unknown as DerivedRow;
  }
}

export class SyntheticStandards implements StandardRepo {
  async index(): Promise<never> { throw new Error("unused"); }
  async texts(codes: readonly string[]): Promise<StandardRow[]> {
    return codes.map((code) => ({ code, set: "CA_CCSS_ELA_6", text: `synthetic standard ${code}`, parent_code: null, is_leaf: true, eld_strand: null }));
  }
}

export class RecordingCallLog implements ModelCallLog {
  starts: ModelCallStart[] = [];
  done: ModelCallCompletion[] = [];
  failed: ProviderErrorRecord[] = [];
  events: string[] = [];
  async insert_sent(s: ModelCallStart): Promise<ModelCallId> { this.starts.push(s); this.events.push("insert_sent"); return `mc_${this.starts.length}` as ModelCallId; }
  async complete(_id: ModelCallId, d: ModelCallCompletion): Promise<void> { this.done.push(d); this.events.push("complete"); }
  async fail(_id: ModelCallId, e: ProviderErrorRecord): Promise<void> { this.failed.push(e); }
  async mark_lost(): Promise<number> { return 0; }
  async completed_for(): Promise<null> { return null; }
  async totals_for_run(): Promise<never> { throw new Error("unused"); }
}

export interface Harness {
  deps: MainDeps;
  evidence: MemoryEvidenceRepo;
  call_log: RecordingCallLog;
  files: Map<string, string>;
  out: string[];
  err: string[];
  repos_calls: number;
  real_judge_calls: number;
}

export function harness(over: { labels?: string | null; judge?: JudgeClient; env?: Record<string, string>; hash?: string; ledger?: Repos["ledger"]; events?: string[] } = {}): Harness {
  const h: Harness = { evidence: new MemoryEvidenceRepo(), call_log: new RecordingCallLog(), files: new Map(), out: [], err: [], repos_calls: 0, real_judge_calls: 0 } as unknown as Harness;
  const labels_text = over.labels === undefined ? FIXTURE : over.labels;
  h.deps = {
    env: over.env ?? {}, out: (l) => h.out.push(l), err: (l) => h.err.push(l), git_sha: "abc123def456",
    read_labels: () => labels_text,
    write_report: (f, lines) => { over.events?.push("write_report"); h.files.set(f, lines.join("\n") + "\n"); },
    repos: async () => {
      h.repos_calls++;
      return {
        lessons: new SyntheticLessons(over.hash ?? HASH), standards: new SyntheticStandards(), call_log: h.call_log, ledger: over.ledger ?? null,
        evidence: h.evidence, user_id: "usr_01JTESTTESTTESTTESTTESTTES" as never, close: async () => {},
      };
    },
    ...(over.judge !== undefined ? { judge: over.judge } : {}),
    make_real_judge: (_k: SecretStr, _m: string) => {
      h.real_judge_calls++;
      return over.judge ?? scripted_judge([]);
    },
    price_for: () => PRICE,
  };
  return h;
}
