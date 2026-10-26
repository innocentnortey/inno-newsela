import { readFileSync } from "node:fs";
import type { ProviderError } from "@ls/core/errors";
import { FakeClock, type Clock } from "@ls/core/ports/clock";
import type { CallPurpose, ModelAlias } from "@ls/core/ports/common";
import type { JudgeClient, JudgeRequest, JudgeVerdictResult } from "@ls/core/ports/judge-client";
import type { ModelClient, ModelResponse, StructuredCallRequest } from "@ls/core/ports/model-client";

export type StubScriptItem =
  | { kind: "text"; text: string; stop_reason?: ModelResponse["stop_reason"] }
  | { kind: "error"; error: ProviderError }
  | { kind: "delay"; ms: number; then: StubScriptItem };
export type StubScriptFn = (req: StructuredCallRequest) => StubScriptItem;
export interface StubModelClientInit {
  clock?: Clock;
  on_enter?: (req: StructuredCallRequest) => void | Promise<void>;
}

const PURPOSE_OF: Readonly<Record<string, CallPurpose>> = {
  UnitPlanDraft: "unit_plan",
  LessonDraft: "lesson_draft",
  AssistRewrite: "assist",
  JudgeVerdict: "judge",
};

const quarter = (n: number): number => Math.ceil(n / 4);

export class StubModelClient implements ModelClient {
  readonly calls: StructuredCallRequest[] = [];
  readonly #clock: Clock;
  readonly #on_enter: StubModelClientInit["on_enter"];
  readonly #scripts = new Map<string, StubScriptItem[] | StubScriptFn>();

  constructor(init: StubModelClientInit = {}) {
    this.#clock = init.clock ?? new FakeClock();
    this.#on_enter = init.on_enter;
  }

  script(alias: ModelAlias, purpose: CallPurpose | "*", items: StubScriptItem[] | StubScriptFn): this {
    this.#scripts.set(`${alias}/${purpose}`, Array.isArray(items) ? [...items] : items);
    return this;
  }

  #next(req: StructuredCallRequest): StubScriptItem {
    const purpose = PURPOSE_OF[req.output_schema_name] ?? "*";
    for (const key of [`${req.alias}/${purpose}`, `${req.alias}/*`]) {
      const s = this.#scripts.get(key);
      if (s === undefined) continue;
      if (typeof s === "function") return s(req);
      const item = s.shift();
      if (item !== undefined) return item;
    }
    throw new Error("unscripted stub call: " + req.alias);
  }

  async complete(req: StructuredCallRequest): Promise<ModelResponse> {
    this.calls.push(req);
    await this.#on_enter?.(req);
    let item = this.#next(req);
    while (item.kind === "delay") {
      await this.#clock.sleep(item.ms);
      item = item.then;
    }
    if (item.kind === "error") throw item.error;
    const in_chars = [...req.system_blocks, ...req.user_blocks].reduce((n, b) => n + b.text.length, 0);
    return {
      raw_text: item.text,
      stop_reason: item.stop_reason ?? "end_turn",
      usage: {
        input_tokens: quarter(in_chars),
        output_tokens: quarter(item.text.length),
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      },
      requested_model: "stub-requested-" + req.alias.toLowerCase(),
      served_model: "stub-model",
      provider_request_id: "stub-req-" + this.calls.length,
      latency_ms: 0,
    };
  }
}

export function wp1_lesson_draft_text(): string {
  const raw = readFileSync(new URL("./fixtures/draft-wp1.json", import.meta.url), "utf8");
  return JSON.stringify(JSON.parse(raw));
}

/** WP-1 after the repair round (the repaired L4 draft). draft-wp1.json above is the first, defective draft. */
export function wp1_repaired_draft_text(): string {
  const raw = readFileSync(new URL("./fixtures/draft-wp1-repaired.json", import.meta.url), "utf8");
  return JSON.stringify(JSON.parse(raw));
}

export function wp2_lesson_draft_text(): string {
  const raw = readFileSync(new URL("./fixtures/draft-wp2.json", import.meta.url), "utf8");
  return JSON.stringify(JSON.parse(raw));
}

type JudgeScript = { verdict: "yes" | "no"; rationale?: string } | ProviderError;

export class StubJudgeClient implements JudgeClient {
  readonly calls: JudgeRequest[] = [];
  readonly #queue: JudgeScript[];

  constructor(verdicts: JudgeScript[]) {
    this.#queue = [...verdicts];
  }

  async verdict(req: JudgeRequest): Promise<JudgeVerdictResult> {
    this.calls.push(req);
    const next = this.#queue.shift();
    if (next === undefined) throw new Error("unscripted stub judge call");
    if (!("verdict" in next)) throw next;
    const rationale = next.rationale ?? "stub rationale";
    const raw_text = JSON.stringify({ verdict: next.verdict, rationale });
    return {
      verdict: next.verdict,
      rationale,
      served_model: "stub-judge",
      usage: {
        input_tokens: quarter(JSON.stringify(req).length),
        output_tokens: quarter(raw_text.length),
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      },
      raw_text,
      provider_request_id: "stub-judge-" + this.calls.length,
    };
  }
}
