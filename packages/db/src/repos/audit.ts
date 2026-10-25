import { z } from "zod";
import type { AlignmentLinkRow } from "@ls/core/ports/alignment";
import type { AuditLog, HistoryRow, NewAuditEvent, StandardDecisionRow } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "@ls/core/ports/tx";
import { InvariantViolation } from "@ls/core/errors";
import { Standard } from "@ls/schema/lesson";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";

// DO-4 PgRepo_ctor: every Pg repository is built from these three.
export interface PgRepoDeps {
  db: PgDatabase;
  ids: IdGenerator;
  clock: Clock;
}

const MAX_STRING = 120;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function reject(path: string, rule: "too_long" | "email" | "not_json"): never {
  // OBS-7: the error names the path and the rule, never the offending text.
  throw new InvariantViolation("audit details must hold ids and codes only", { path, rule });
}

function check_string(s: string, path: string): void {
  if (s.length > MAX_STRING) reject(path, "too_long");
  if (EMAIL.test(s)) reject(path, "email");
}

export function check_details(value: unknown, path = "details"): void {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") return check_string(value, path);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject(path, "not_json");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => check_details(v, `${path}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      check_string(k, `${path}.<key>`);
      check_details(v, `${path}.${k}`);
    }
    return;
  }
  reject(path, "not_json"); // undefined, function, bigint, symbol
}

const BeforeLinks = z.array(
  z.object({
    lesson_id: z.string(),
    content_hash: z.string(),
    code: z.string(),
    address: z.string(),
    role: z.enum(["I", "P", "A"]),
    origin: z.enum(["outline", "narrowed", "added"]),
    asserted_by: z.enum(["outline", "generator", "judge", "reviewer"]),
    confirmed_by: z.string().nullable(),
  }),
);

const DECISIONS = ["confirm", "remove", "add", "undo"] as const;

export class PgAuditLog implements AuditLog {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  // Joins the caller's transaction; never opens its own, so a rollback removes the row.
  async append(e: NewAuditEvent, tx: Tx): Promise<string> {
    check_details(e.details);
    if (!(tx instanceof DbTx)) throw new InvariantViolation("audit append needs a real transaction");
    const id = this.ids.new_id("ae");
    await tx.query(
      `INSERT INTO audit_event (id, actor_id, action, target_kind, target_id, version_hash, reason, details_json, request_id, store_id, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::timestamptz)`,
      [id, e.actor_id, e.action, e.target_kind, e.target_id, e.version_hash, e.reason, JSON.stringify(e.details), e.request_id, e.store_id, this.clock.now().toISOString()],
    );
    return id;
  }

  async history(lesson_id: string): Promise<HistoryRow[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<{
            at: Date; source: HistoryRow["source"]; actor_name: string | null; action: string;
            from_state: HistoryRow["from_state"]; to_state: HistoryRow["to_state"]; version_hash: string | null; reason: string | null;
          }>(
            `SELECT at, source, actor_name, action, from_state, to_state, version_hash, reason
             FROM audit_log_v WHERE lesson_id = $1 ORDER BY at ASC, source ASC`,
            [lesson_id],
          )
        ).rows,
    );
    return rows.map((r) => ({
      at: r.at, source: r.source, actor_name: r.actor_name, action: r.action,
      from_state: r.from_state, to_state: r.to_state, version_hash: r.version_hash, reason: r.reason,
    }));
  }

  async standard_decisions(lesson_id: string, code: string): Promise<StandardDecisionRow[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<{ id: string; actor_id: string | null; action: string; at: Date; details_json: unknown }>(
            `SELECT id, actor_id, action, at, details_json FROM audit_event
             WHERE target_kind = 'lesson' AND target_id = $1 AND action LIKE 'standard.%' AND details_json ->> 'code' = $2
             ORDER BY at DESC, id DESC`,
            [lesson_id, code],
          )
        ).rows,
    );
    return rows.map((r) => {
      const decision = r.action.slice("standard.".length);
      if (!(DECISIONS as readonly string[]).includes(decision)) throw new InvariantViolation("unknown standard decision", { audit_id: r.id });
      if (r.actor_id === null) throw new InvariantViolation("standard decision without actor", { audit_id: r.id });
      const d = (r.details_json ?? {}) as Record<string, unknown>;
      const before_entry = d["before_entry"] == null ? null : Standard.parse(d["before_entry"]);
      const before_links: AlignmentLinkRow[] = BeforeLinks.parse(d["before_links"] ?? []);
      return { audit_id: r.id, lesson_id, code, decision: decision as StandardDecisionRow["decision"], by: r.actor_id, at: r.at, before_entry, before_links };
    });
  }
}
