// Test helper: raw-SQL seeds for run, lesson_job and model_call rows. Imports no repository.
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "../tx.ts";
import { insert_row } from "./insert-row.ts";

const ids = new PrefixedIdGenerator();
let n = 0;

export async function seed_run(
  q: Pick<Tx, "query">,
  opts: { run_id?: string; state?: string; plan_stored_at?: Date | null; created_at?: Date; unit_id?: string; choices_json?: unknown } = {},
): Promise<string> {
  n += 1;
  const id = opts.run_id ?? ids.new_id("run");
  await insert_row(q, "run", {
    id, state: opts.state ?? "running", unit_id: opts.unit_id ?? "G6.U4", idempotency_key: `seed-run-${n}-${id}`,
    started_by: `seed-user-${n}`, plan_stored_at: opts.plan_stored_at ?? null,
    ...(opts.created_at ? { created_at: opts.created_at } : {}),
    ...(opts.choices_json !== undefined ? { choices_json: opts.choices_json } : {}),
  });
  return id;
}

export async function seed_job(
  q: Pick<Tx, "query">,
  o: { run_id: string; kind?: string; status?: string; lesson_id?: string | null; idempotency_key?: string; lease_until?: Date | null; queued_at?: Date; attempt?: number },
): Promise<string> {
  n += 1;
  const id = ids.new_id("job");
  await insert_row(q, "lesson_job", {
    id, run_id: o.run_id, kind: o.kind ?? "lesson", status: o.status ?? "queued",
    tile_state: o.status === "running" ? "drafting" : "queued", lesson_id: o.lesson_id ?? null,
    idempotency_key: o.idempotency_key ?? `seed-job-${n}-${id}`, lease_until: o.lease_until ?? null,
    ...(o.queued_at ? { queued_at: o.queued_at } : {}), ...(o.attempt !== undefined ? { attempt: o.attempt } : {}),
  });
  return id;
}

export async function seed_lost_calls(q: Pick<Tx, "query">, job_id: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await insert_row(q, "model_call", { id: ids.new_id("mc"), job_id, status: "lost" });
}
