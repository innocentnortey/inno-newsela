import type { RunId, Sha256, UserId } from "@ls/core/ports/common";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { NewGuidanceVersion, PromptRepo, PromptVersionRow } from "@ls/core/ports/prompts";
import type { Tx } from "@ls/core/ports/tx";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// NL-34, DO-4 section 3.5. prompt_version is append-only (migration 0013): this class has no update or delete.
const LOCK_KEY = "prompt:sync";

interface Raw {
  id: string;
  locked_hash: string;
  guidance_text: string;
  number: number;
  author_id: string | null;
  reason: string | null;
  diff: string | null;
  created_at: Date;
}

const COLS = "id, locked_hash, guidance_text, number, author_id, reason, diff, created_at";

function map(r: Raw): PromptVersionRow {
  return {
    prompt_version_id: r.id,
    number: r.number,
    locked_hash: r.locked_hash as Sha256,
    guidance_text: r.guidance_text,
    author_id: r.author_id as UserId | null,
    reason: r.reason,
    diff: r.diff,
    created_at: r.created_at,
  };
}

function real_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("prompt writes need a real transaction");
  return tx;
}

export class PgPromptRepo implements PromptRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  async current(): Promise<PromptVersionRow> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query<Raw>(`select ${COLS} from prompt_version order by number desc limit 1`)).rows,
    );
    if (rows[0] === undefined) throw new InvariantViolation("no prompt version");
    return map(rows[0]);
  }

  async get(prompt_version_id: string): Promise<PromptVersionRow | null> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query<Raw>(`select ${COLS} from prompt_version where id = $1`, [prompt_version_id])).rows,
    );
    return rows[0] === undefined ? null : map(rows[0]);
  }

  async all(): Promise<PromptVersionRow[]> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query<Raw>(`select ${COLS} from prompt_version order by number asc`)).rows,
    );
    return rows.map(map);
  }

  async pinned_by_runs(prompt_version_id: string): Promise<RunId[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "select id from run where prompt_version_id = $1 order by created_at asc, id asc",
            [prompt_version_id],
          )
        ).rows,
    );
    return rows.map((r) => r.id as RunId);
  }

  // Repository-level (not on the port): lets the service show author names.
  async author_names(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;
    const rows = await this.db.with_tx(
      async (tx) =>
        (await tx.query<{ id: string; name: string }>("select id, name from app_user where id = any($1::text[])", [ids]))
          .rows,
    );
    for (const r of rows) out.set(r.id, r.name);
    return out;
  }

  // Repository-level (DO-4 3.5, R-6): seed v1, or add a version when the shipped locked layer changed.
  // Takes a hash, never locked text. Returns the new row, or null when nothing changed.
  async sync_locked_layer(locked_hash: string, tx: Tx): Promise<PromptVersionRow | null> {
    const q = real_tx(tx);
    const latest = await this.latest_serialised(q);
    if (latest === null) return this.insert(q, 1, locked_hash, "", null, "initial", null);
    if (latest.locked_hash === locked_hash) return null;
    return this.insert(q, latest.number + 1, locked_hash, latest.guidance_text, null, "locked layer changed", null);
  }

  async insert_guidance(v: NewGuidanceVersion, diff: string, tx: Tx): Promise<PromptVersionRow> {
    const q = real_tx(tx);
    const latest = await this.latest_serialised(q);
    if (latest === null) throw new InvariantViolation("no prompt version");
    if (latest.prompt_version_id !== v.base_version_id) {
      throw new DomainRefusal("STALE_BASE", "The guidance changed since you opened it.", {
        latest_version_id: latest.prompt_version_id,
      });
    }
    return this.insert(q, latest.number + 1, latest.locked_hash, v.guidance_text, v.author_id, v.reason, diff);
  }

  // The advisory lock is the first statement; the read after it sees every committed writer (READ COMMITTED).
  private async latest_serialised(q: DbTx): Promise<PromptVersionRow | null> {
    await q.query("select pg_advisory_xact_lock(hashtext($1))", [LOCK_KEY]);
    const r = await q.query<Raw>(`select ${COLS} from prompt_version order by number desc limit 1`);
    return r.rows[0] === undefined ? null : map(r.rows[0]);
  }

  private async insert(
    q: DbTx,
    number: number,
    locked_hash: string,
    guidance_text: string,
    author_id: string | null,
    reason: string,
    diff: string | null,
  ): Promise<PromptVersionRow> {
    const r = await q.query<Raw>(
      `insert into prompt_version (id, locked_hash, guidance_text, number, author_id, reason, diff, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz) returning ${COLS}`,
      [this.ids.new_id("pr"), locked_hash, guidance_text, number, author_id, reason, diff, this.clock.now().toISOString()],
    );
    return map(r.rows[0]!);
  }
}
