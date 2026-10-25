// NL-86: runtime shape checks for the responses the driver reads (the OpenAPI `required:` keys it uses).
import { DriverError, type RunProgressT, type RunSummaryT, type Schemas } from "./types.ts";

type Rec = Record<string, unknown>;
type Kind = "string" | "number" | "boolean" | "array" | "object";

function need(op: string, body: unknown, spec: Record<string, Kind>): Rec {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new DriverError("SHAPE", `${op}: body is not an object`);
  const r = body as Rec;
  for (const [key, kind] of Object.entries(spec)) {
    const v = r[key];
    const ok = kind === "array" ? Array.isArray(v) : kind === "object" ? typeof v === "object" && v !== null : typeof v === kind;
    if (!ok) throw new DriverError("SHAPE", `${op}: key ${key} is missing or not a ${kind}`);
  }
  return r;
}

export function as_session(body: unknown): Schemas["Session"] {
  return need("signIn", body, { user: "object", expires_at: "string" }) as unknown as Schemas["Session"];
}
export function as_outline_version(body: unknown): Schemas["OutlineVersion"] {
  return need("uploadOutline", body, { outline_version_id: "string", unit_id: "string", version_number: "number", row_counts: "object" }) as unknown as Schemas["OutlineVersion"];
}
export function as_report(body: unknown): Schemas["ValidationReport"] {
  const r = need("getValidationReport", body, { outline_version_id: "string", counts: "object", rows: "array", generate_allowed: "boolean" });
  for (const row of r["rows"] as unknown[]) {
    const rr = need("getValidationReport.rows", row, { row_number: "number", level: "string", findings: "array" });
    for (const f of rr["findings"] as unknown[]) need("getValidationReport.findings", f, { finding_id: "string", level: "string", kind: "string" });
  }
  return r as unknown as Schemas["ValidationReport"];
}
export function as_choice_result(body: unknown): Schemas["IntakeChoiceResult"] {
  return need("recordIntakeChoice", body, { row: "object", counts: "object", generate_allowed: "boolean" }) as unknown as Schemas["IntakeChoiceResult"];
}
export function as_prompt_versions(body: unknown): Schemas["PromptVersions"] {
  return need("listPromptVersions", body, { current_prompt_version_id: "string", guidance_versions: "array" }) as unknown as Schemas["PromptVersions"];
}
export function as_run(body: unknown): Schemas["Run"] {
  return need("startRun", body, { run_id: "string", state: "string", outline_version_id: "string", cap_usd: "number" }) as unknown as Schemas["Run"];
}
export function as_progress(body: unknown): RunProgressT {
  return need("getRunProgress", body, { run_id: "string", state: "string", spent_usd: "number", reserved_usd: "number", cap_usd: "number", counts_by_tile_state: "object" }) as unknown as RunProgressT;
}
export function as_summary(body: unknown): RunSummaryT {
  return need("getRunSummary", body, {
    run_id: "string", state: "string", n: "number", wall_time_seconds: "number", cost_usd: "number", lessons: "object", retries: "number",
    failures_by_reason: "array", placeholders_left: "number", calls_lost_in_flight: "number", truncation_retries: "number",
  }) as unknown as RunSummaryT;
}
