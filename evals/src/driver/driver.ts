// NL-86 AC-1/AC-2: walks the public API from sign-in to the run summary. No database, no service imports.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { as_choice_result, as_outline_version, as_progress, as_prompt_versions, as_report, as_run, as_session, as_summary } from "./guards.ts";
import { make_http } from "./http.ts";
import { DriverError, type DriverConfig, type DriverResult } from "./types.ts";

const TERMINAL = new Set(["complete", "partial", "capped", "cancelled"]);

export class FullRunDriver {
  constructor(private readonly cfg: DriverConfig) {}

  async run(): Promise<DriverResult> {
    const cfg = this.cfg;
    if (cfg.email === "" || cfg.password === "") throw new DriverError("NO_CREDENTIALS", "set DRIVER_EMAIL and DRIVER_PASSWORD");
    const call = make_http(cfg);

    as_session((await call("signIn", "POST", "/session", { json: { email: cfg.email, password: cfg.password } })).body);

    const bytes = fs.readFileSync(cfg.outline_path);
    const ov = as_outline_version((await call("uploadOutline", "POST", "/outline-versions", { form: { field: "file", bytes, filename: cfg.outline_path } })).body);
    const ovid = encodeURIComponent(ov.outline_version_id);

    const report = as_report((await call("getValidationReport", "GET", `/outline-versions/${ovid}/report`)).body);
    for (const row of report.rows) {
      for (const f of row.findings) {
        if (f.level !== "error" || f.choice?.source === "confirmed") continue;
        // One POST per finding; the server itself refuses a start with VALIDATION_INCOMPLETE.
        as_choice_result((await call("recordIntakeChoice", "POST", `/outline-versions/${ovid}/choices`, {
          json: { target_id: f.finding_id, kind: "confirm_fix", value: f.proposed_fix },
        })).body);
      }
    }

    const prompt_version_id = cfg.prompt_version_id ?? as_prompt_versions((await call("listPromptVersions", "GET", "/prompt-versions")).body).current_prompt_version_id;
    const key_hash = createHash("sha256").update(`${ov.outline_version_id}|${prompt_version_id}|${cfg.cap_usd}`).digest("hex").slice(0, 16);
    const run = as_run((await call("startRun", "POST", "/runs", {
      headers: { "Idempotency-Key": `full-run-${cfg.unit}-${key_hash}` },
      json: { outline_version_id: ov.outline_version_id, mode: "run", scope: { kind: "all" }, lesson_id: null, prompt_version_id, cap_usd: cfg.cap_usd },
    })).body);

    let polls = 0;
    let state: string;
    let paused_logged = false;
    for (;;) {
      const p = as_progress((await call("getRunProgress", "GET", `/runs/${encodeURIComponent(run.run_id)}/progress`)).body);
      polls++;
      state = p.state;
      if (TERMINAL.has(state)) break;
      if (state === "paused" && !paused_logged) {
        cfg.log("run paused");
        paused_logged = true;
      }
      if (polls * cfg.poll_ms > cfg.max_wall_ms) throw new DriverError("TIMEOUT", `run not finished after ${polls} polls`);
      await cfg.sleep(cfg.poll_ms);
    }

    const summary = as_summary((await call("getRunSummary", "GET", `/runs/${encodeURIComponent(run.run_id)}/summary`)).body);
    return { run_id: run.run_id, final_state: state, summary, polls };
  }
}
