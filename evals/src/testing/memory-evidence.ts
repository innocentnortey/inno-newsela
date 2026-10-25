// NL-49 test helper
import { InvariantViolation } from "@ls/core/errors";
import type {
  EvalCaseResultRecord, EvalRunRow, EvidenceRepo, ExperimentRunRecord, NewEvalRun, OpsEventRecord, ProbeRunRecord,
} from "@ls/core/ports/evidence";

export class MemoryEvidenceRepo implements EvidenceRepo {
  runs: EvalRunRow[] = [];
  cases: EvalCaseResultRecord[] = [];
  probes: ProbeRunRecord[] = [];
  experiments: ExperimentRunRecord[] = [];
  ops: OpsEventRecord[] = [];
  private n = 0;

  async start_eval_run(r: NewEvalRun): Promise<EvalRunRow> {
    const row: EvalRunRow = { eval_run_id: `ev_mem_${++this.n}`, suite: r.suite, passed: 0, total: 0, report_path: null, started_at: new Date(0), finished_at: null };
    this.runs.push(row);
    return row;
  }
  async add_case_result(r: EvalCaseResultRecord): Promise<void> {
    this.cases.push(r);
  }
  async finish_eval_run(id: string, passed: number, total: number, report_path: string): Promise<EvalRunRow> {
    const row = this.runs.find((r) => r.eval_run_id === id);
    if (row === undefined) throw new InvariantViolation("eval run not found", { eval_run_id: id });
    Object.assign(row, { passed, total, report_path, finished_at: new Date(0) });
    return row;
  }
  async insert_probe_run(p: ProbeRunRecord): Promise<string> { this.probes.push(p); return p.probe_run_id; }
  async insert_experiment_run(e: ExperimentRunRecord): Promise<string> { this.experiments.push(e); return e.experiment_id; }
  async ops_event(e: OpsEventRecord): Promise<string> { this.ops.push(e); return `ops_mem_${++this.n}`; }
}
