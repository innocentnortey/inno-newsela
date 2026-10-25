// NL-78 test kit: a real RunService + the four run handlers over a real test database, and synthetic seeders.
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { insert_row } from "@ls/db/testing/insert-row";
import { seed_job, seed_run } from "@ls/db/testing/seed-run";
import type { TestDb } from "@ls/db/testing/test-db";
import type { Tx } from "@ls/db/tx";
import type { WebDeps } from "../../deps.ts";
import { APP_ORIGIN, make_log, make_request, SETTINGS } from "../../http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type HttpResponse, type RequestUser, type RouteHandler, type SessionResolver } from "../../http/with-route.ts";
import { make_run_handlers } from "../../routes/run-routes.ts";
import { wire_runs } from "../../wiring/runs.ts";

export type Q = Pick<Tx, "query">;
export const BASE_ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };

const ROLES = { "author-token": "author", "reviewer-token": "reviewer", "approver-token": "approver" } as const;
const resolver: SessionResolver = {
  async require(token, request_id) {
    const role = token === null ? undefined : (ROLES as Record<string, RequestUser["role"] | undefined>)[token];
    if (!role) throw Object.assign(new Error("Sign in again."), { name: "DomainRefusal", code: "UNAUTHENTICATED" });
    return { user_id: `usr_synthetic_${role}`, name: `Test ${role}`, email: `${role}@example.test`, role, synthetic: true, request_id };
  },
};

export function make_run_kit(t: TestDb) {
  const log = make_log();
  const notified: string[] = [];
  const deps = {
    db: t.db, ids: new PrefixedIdGenerator(), clock: { now: () => new Date(), sleep: async () => {} }, logger: log.logger,
    settings: load_web_settings(BASE_ENV), model_client: {} as never,
  } as unknown as WebDeps;
  const { runs } = wire_runs(deps, { notify: async (run_id) => void notified.push(run_id) });
  const handlers = make_run_handlers({ with_route: make_with_route({ sessions: () => resolver, logger: log.logger, settings: SETTINGS }), runs: () => runs });
  return { service: runs, handlers, lines: log.lines, notified };
}
export type RunKit = ReturnType<typeof make_run_kit>;

export function call(
  handler: RouteHandler,
  o: { token?: string; run_id: string; body?: unknown; method?: string },
): Promise<HttpResponse> {
  const method = o.method ?? "GET";
  const req: HttpRequest = make_request({
    token: o.token ?? "author-token", path_params: { runId: o.run_id }, method,
    body: (method === "GET" ? null : (o.body ?? null)) as never, origin: APP_ORIGIN,
  });
  return handler(req);
}

export const body_of = <T = Record<string, any>>(r: HttpResponse): T => r.body as unknown as T;
export const code_of = (r: HttpResponse): string => (r.body as unknown as { error: { code: string } }).error.code;

export async function seed_lessons(q: Q, n: number): Promise<string[]> {
  const out: string[] = [];
  for (let k = 1; k <= n; k++) {
    const id = `G6.U4.L${k}`;
    await insert_row(q, "lesson", { id, unit_id: "G6.U4", number: k, type: "Reading", title: `Synthetic lesson ${k}`, state: "draft", schema_version: 1 });
    out.push(id);
  }
  return out;
}

/** WP-1-style stub run: one unit_plan job and three lesson jobs (lessons seeded once per database). */
export async function seed_stub_run(
  q: Q,
  o: { state?: string; cap_usd?: string; lesson_ids?: string[]; statuses?: string[]; plan_stored_at?: Date | null; paused_check?: string | null; queued_at?: Date } = {},
): Promise<{ run_id: string; plan_job: string; jobs: string[]; lesson_ids: string[] }> {
  const lesson_ids = o.lesson_ids ?? ["G6.U4.L1", "G6.U4.L2", "G6.U4.L3"];
  const run_id = await seed_run(q, { state: o.state ?? "running", plan_stored_at: o.plan_stored_at === undefined ? new Date() : o.plan_stored_at });
  await q.query("UPDATE run SET cap_usd = $2::numeric, paused_check = $3 WHERE id = $1", [run_id, o.cap_usd ?? "13", o.paused_check ?? null]);
  const plan_job = await seed_job(q, { run_id, kind: "unit_plan", status: "ready" });
  await q.query("UPDATE lesson_job SET tile_state = 'ready' WHERE id = $1", [plan_job]);
  const jobs: string[] = [];
  for (const [i, lesson_id] of lesson_ids.entries()) {
    const status = o.statuses?.[i] ?? "queued";
    const id = await seed_job(q, { run_id, kind: "lesson", lesson_id, status, ...(o.queued_at ? { queued_at: o.queued_at } : {}) });
    if (status === "ready" || status === "generation_failed" || status === "cancelled") {
      await set_job(q, id, { tile_state: status === "ready" ? "ready" : "failed" });
    }
    jobs.push(id);
  }
  return { run_id, plan_job, jobs, lesson_ids };
}

const JSON_COLS = new Set(["failure_reasons_json", "brakes_fired"]);
export async function set_job(q: Q, job_id: string, patch: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(patch);
  const sets = cols.map((c, i) => `${c} = $${i + 2}${JSON_COLS.has(c) ? "::jsonb" : ""}`);
  const vals = cols.map((c) => (JSON_COLS.has(c) && typeof patch[c] !== "string" ? JSON.stringify(patch[c]) : patch[c]));
  await q.query(`UPDATE lesson_job SET ${sets.join(", ")} WHERE id = $1`, [job_id, ...vals]);
}

const ids = new PrefixedIdGenerator();
export async function seed_call(
  q: Q,
  o: { run_id: string; job_id?: string | null; lesson_id?: string | null; status?: "completed" | "failed" | "lost"; purpose?: string; cost_usd?: string; retries?: number; rendered_prompt?: string },
): Promise<void> {
  await insert_row(q, "model_call", {
    id: ids.new_id("mc"), run_id: o.run_id, lesson_id: o.lesson_id ?? null, job_id: o.job_id ?? null, attempt: 1, purpose: o.purpose ?? "draft",
    alias: "draft", requested_model: "synthetic-model", rendered_prompt: o.rendered_prompt ?? "synthetic prompt", status: o.status ?? "completed",
    cost_usd: o.cost_usd ?? "0", retries: o.retries ?? 0,
  });
}

export async function seed_reservation(q: Q, o: { run_id: string; status?: string; reserved_usd?: string; settled_usd?: string }): Promise<void> {
  await insert_row(q, "spend_reservation", {
    id: ids.new_id("sr"), run_id: o.run_id, user_id: "usr_synthetic_author", purpose: "draft", status: o.status ?? "settled",
    reserved_usd: o.reserved_usd ?? "0", settled_usd: o.settled_usd ?? "0", day: "2026-10-25",
  });
}

export async function count(q: Q, table: string, where = "true", values: unknown[] = []): Promise<number> {
  return Number((await q.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, values as never)).rows[0]?.["n"]);
}
