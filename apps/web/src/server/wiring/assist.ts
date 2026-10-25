// NL-116: AI-assist wiring (WF-14, CON-17). Builds SuggestionService (NL-50) with its 11 constructor arguments.
// Constructors must not touch d.db (the stub container passes a throwing proxy).
//
// Test-only seam (stub mode only): in MODEL_PROVIDER_MODE=stub the web process has no scripted model output, and
// StubModelClient throws "unscripted stub call". So the ASSIST alias is scripted from a JSON control file named by
// the env var ASSIST_STUB_FILE, re-read on every call, so a real-stack e2e can vary the model output per test:
//   { "kind": "text", "text": "<suggested_text>" }
//   { "kind": "delay", "ms": N, "then": <item> }
//   { "kind": "error", "code": "<message>", "error_kind": "timeout" | "server_error" | ... }   (error_kind defaults to timeout)
// StubModelClient does not enforce timeout_ms, so a provider timeout is simulated as an error item (usually after a delay).
// Unset or missing file: the fixed text DEFAULT_ASSIST_TEXT. The file can only choose stub output; in real mode
// nothing is scripted and neither the env var nor the file is read.
import { readFileSync } from "node:fs";
import { max_call_cost, settle_cost } from "@ls/core/spend/reservation";
import { ProviderError, type ProviderErrorKind } from "@ls/core/errors";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { PaidCaller } from "@ls/llm/paid-call";
import { PRICE_TABLE } from "@ls/llm/prices";
import { ModelCallRecorder, type PriceLookup } from "@ls/llm/recorder";
import { StubModelClient, type StubScriptItem } from "@ls/llm/stub";
import { LOCKED_DIR } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { WebDeps } from "../deps.ts";
import { HttpCollabCommandClient } from "../adapters/collab-commands.ts";
import { SuggestionService } from "../services/suggestion-service.ts";

export interface AssistWiring {
  suggestions: SuggestionService;
}

const COLLAB_TIMEOUT_MS = 5000;
export const DEFAULT_ASSIST_TEXT = "A short, clear rewrite of the selected passage.";

const ERROR_KINDS: ReadonlySet<string> = new Set(["rate_limited", "overloaded", "server_error", "timeout", "connection", "bad_request", "auth", "refusal"]);

type Control =
  | { kind: "text"; text: string }
  | { kind: "delay"; ms: number; then: Control }
  | { kind: "error"; code: string; error_kind: ProviderErrorKind };

function parse_control(v: unknown, depth = 0): Control | null {
  if (typeof v !== "object" || v === null || depth > 4) return null;
  const c = v as Record<string, unknown>;
  if (c["kind"] === "text" && typeof c["text"] === "string") return { kind: "text", text: c["text"] };
  if (c["kind"] === "error" && typeof c["code"] === "string") {
    const k = c["error_kind"];
    return { kind: "error", code: c["code"], error_kind: typeof k === "string" && ERROR_KINDS.has(k) ? (k as ProviderErrorKind) : "timeout" };
  }
  if (c["kind"] === "delay" && typeof c["ms"] === "number" && c["ms"] >= 0) {
    const then = parse_control(c["then"], depth + 1);
    return then === null ? null : { kind: "delay", ms: c["ms"], then };
  }
  return null;
}

function to_item(c: Control): StubScriptItem {
  switch (c.kind) {
    case "text": return { kind: "text", text: JSON.stringify({ suggested_text: c.text }) };
    case "delay": return { kind: "delay", ms: c.ms, then: to_item(c.then) };
    case "error": return { kind: "error", error: new ProviderError({ kind: c.error_kind, message: c.code }) };
  }
}

/** Read the control file named by `file` (env ASSIST_STUB_FILE). Any problem falls back to the default text. */
export function read_assist_script(file: string | undefined): StubScriptItem {
  let control: Control | null = null;
  if (file !== undefined && file !== "") {
    try {
      control = parse_control(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      control = null;
    }
  }
  return to_item(control ?? { kind: "text", text: DEFAULT_ASSIST_TEXT });
}

/** Stub mode only: script the ASSIST alias from the control file. Returns true when it scripted. */
export function script_stub_assist(d: Pick<WebDeps, "settings" | "model_client">, env: Record<string, string | undefined> = process.env): boolean {
  if (d.settings.model.model_provider_mode !== "stub") return false;
  if (!(d.model_client instanceof StubModelClient)) return false;
  d.model_client.script("ASSIST", "assist", () => read_assist_script(env["ASSIST_STUB_FILE"]));
  return true;
}

// Stub mode only: StubModelClient answers as the model "stub-model", which the real price table does not list, and the
// recorder refuses an unpriced call. Price it like the real model so spend is recorded the same way (same as the worker's
// test price lookup). In real mode the real table is used unchanged.
function stub_priced(d: Pick<WebDeps, "settings" | "model_client">): PriceLookup {
  if (d.settings.model.model_provider_mode !== "stub" || !(d.model_client instanceof StubModelClient)) return PRICE_TABLE;
  const real = PRICE_TABLE.price_for("claude-sonnet-5-5");
  const prices = [...PRICE_TABLE.prices, { ...real, model_id: "stub-model" }];
  return {
    prices,
    confirmed_on: PRICE_TABLE.confirmed_on,
    price_for: (id: string) => prices.find((p) => p.model_id === id) ?? PRICE_TABLE.price_for(id),
  } as PriceLookup;
}

export function wire_assist(d: WebDeps): AssistWiring {
  const rd = { db: d.db, ids: d.ids, clock: d.clock };
  const cost = { settle_cost, max_call_cost };
  const prices = stub_priced(d);
  const recorder = new ModelCallRecorder(d.model_client, new PgModelCallLog(rd), d.clock, prices, d.settings.model, cost, {
    logger: d.logger,
  });
  const spend = new PgSpendLedger({ ...rd, settings: d.settings.spend, logger: d.logger });
  const paid = new PaidCaller(recorder, spend, prices, cost, d.logger);
  const renderer = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
  const collab = new HttpCollabCommandClient(
    { base_url: d.settings.collab_internal_url, token: d.settings.collab_internal_token, timeout_ms: COLLAB_TIMEOUT_MS },
    { clock: d.clock, logger: d.logger },
  );
  script_stub_assist(d);
  return {
    suggestions: new SuggestionService(
      paid,
      renderer,
      new PgPromptRepo(rd),
      new PgSuggestionRepo(rd),
      new PgLessonRepo(rd),
      collab,
      new PgAuditLog(rd),
      d.db,
      d.clock,
      d.settings,
      new PgLessonDocReader({ db: d.db }),
    ),
  };
}
