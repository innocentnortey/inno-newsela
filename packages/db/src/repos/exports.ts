// NL-51: PgExportRepo (CON-23). The payload is not stored: it is rebuilt from the immutable approve snapshots
// the bundle names, and re-hashed, so a file that no longer matches its hash is never served.
import { createHash } from "node:crypto";
import { InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { ExportBundleRow, ExportRepo, NewExportBundle } from "@ls/core/ports/exports";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "@ls/core/ports/tx";
import { canonical_json } from "@ls/schema/content-hash";
import { ExportBundleFile } from "@ls/schema/export";
import { StoredLesson } from "@ls/schema/lesson";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; mapped at the edge
type Row = Record<string, any>;

const EPOCH = "1970-01-01T00:00:00.000Z";

function assert_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("export repo needs a real transaction");
  return tx;
}

const sha256_hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

function to_row(r: Row): ExportBundleRow {
  return {
    export_id: r["id"],
    unit_id: r["unit_id"],
    version_number: r["version_number"],
    payload_sha256: r["payload_sha256"],
    lesson_versions: r["lesson_versions_json"],
    held_back: r["held_back_json"],
    created_by: r["created_by"],
    created_at: r["created_at"],
  };
}

export class PgExportRepo implements ExportRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  private read(sql: string, values: unknown[]): Promise<Row[]> {
    return this.db.with_tx(async (tx) => (await tx.query(sql, values)).rows);
  }

  async insert(b: NewExportBundle, tx: Tx): Promise<ExportBundleRow> {
    const t = assert_tx(tx);
    const payload = ExportBundleFile.parse(b.payload);
    const ids = payload.lessons.map((l) => l.version_id);
    if (ids.length !== b.lesson_versions.length || ids.some((v, i) => v !== b.lesson_versions[i])) {
      throw new InvariantViolation("export versions do not match payload");
    }
    if (sha256_hex(canonical_json(payload)) !== b.payload_sha256) {
      throw new InvariantViolation("export hash does not match payload");
    }
    const next = await t.query<{ n: number }>(
      "SELECT COALESCE(MAX(version_number),0)+1 AS n FROM export_bundle WHERE unit_id=$1",
      [b.unit_id],
    );
    const version_number = Number(next.rows[0]!.n);
    const id = this.ids.new_id("exp");
    const created_at = this.clock.now();
    await t.query(
      `INSERT INTO export_bundle (id, unit_id, version_number, payload_sha256, lesson_versions_json, held_back_json, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, b.unit_id, version_number, b.payload_sha256, JSON.stringify(b.lesson_versions), JSON.stringify(b.held_back), b.created_by, created_at],
    );
    return {
      export_id: id,
      unit_id: b.unit_id,
      version_number,
      payload_sha256: b.payload_sha256,
      lesson_versions: [...b.lesson_versions],
      held_back: [...b.held_back],
      created_by: b.created_by,
      created_at,
    };
  }

  async latest(unit_id: string): Promise<ExportBundleRow | null> {
    const rows = await this.read("SELECT * FROM export_bundle WHERE unit_id=$1 ORDER BY version_number DESC LIMIT 1", [unit_id]);
    return rows[0] ? to_row(rows[0]) : null;
  }

  async all_for_unit(unit_id: string): Promise<ExportBundleRow[]> {
    const rows = await this.read("SELECT * FROM export_bundle WHERE unit_id=$1 ORDER BY version_number DESC", [unit_id]);
    return rows.map(to_row);
  }

  async payload(export_id: string): Promise<ExportBundleFile | null> {
    const found = await this.read("SELECT * FROM export_bundle WHERE id=$1", [export_id]);
    if (!found[0]) return null;
    const bundle = to_row(found[0]);
    const rows = await this.read(
      "SELECT id, lesson_id, content_hash, created_by, stored_at, lesson_json FROM lesson_version WHERE id = ANY($1::text[]) AND kind='approve'",
      [bundle.lesson_versions],
    );
    if (rows.length !== bundle.lesson_versions.length) {
      throw new InvariantViolation("export names snapshots that are missing", { export_id });
    }
    const by_id = new Map(rows.map((r) => [r["id"] as string, r]));
    let latest_ms = 0;
    const lessons = bundle.lesson_versions.map((vid) => {
      const r = by_id.get(vid);
      if (!r) throw new InvariantViolation("export names snapshots that are missing", { export_id });
      if (r["created_by"] === null) throw new InvariantViolation("approve snapshot has no approver", { version_id: vid });
      const at = r["stored_at"] as Date;
      latest_ms = Math.max(latest_ms, at.getTime());
      return {
        lesson_id: r["lesson_id"],
        version_id: vid,
        content_hash: r["content_hash"],
        approved_by: r["created_by"],
        approved_at: at.toISOString(),
        lesson: StoredLesson.parse(r["lesson_json"]),
      };
    });
    const file = ExportBundleFile.parse({
      export_version: 1,
      unit_id: bundle.unit_id,
      generated_at: lessons.length === 0 ? EPOCH : new Date(latest_ms).toISOString(),
      lessons,
    });
    if (sha256_hex(canonical_json(file)) !== bundle.payload_sha256) {
      throw new InvariantViolation("export payload no longer matches its hash", { export_id });
    }
    return file;
  }
}
