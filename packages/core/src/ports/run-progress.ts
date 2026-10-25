// NL-78 (R1): the read seam behind the progress route. Additive port: run + spend + job rows with lesson titles + queued_ahead
// in a fixed number of statements, which no existing port can answer. RunService takes it as an optional constructor extra.
import type { RunId, Usd } from "./common.ts";
import type { JobRow } from "./job-queue.ts";
import type { RunRow } from "./runs.ts";

export interface ProgressJobRow extends JobRow {
  lesson_title: string | null;
  lesson_number: number | null;
}

export interface RunProgressRows {
  run: RunRow;
  settled_usd: Usd;
  reserved_usd: Usd;
  jobs: ProgressJobRow[];
  queued_ahead: number;
}

export interface RunProgressReader {
  /** null = unknown run. Reads only; never writes. */
  progress_rows(run_id: RunId): Promise<RunProgressRows | null>;
}
