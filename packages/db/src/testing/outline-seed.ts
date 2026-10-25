// Test helper (NL-26): seeds the standards table and users for outline tests.
import { load_standard_rows } from "@ls/core/intake/standards-index";
import type { PgDatabase } from "../pool.ts";
import { insert_row } from "./insert-row.ts";

export async function seed_standards(db: PgDatabase): Promise<void> {
  await db.with_tx(async (tx) => {
    for (const s of load_standard_rows()) {
      await tx.query(
        'INSERT INTO standard (code, "set", text, parent_code, is_leaf, eld_strand) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING',
        [s.code, s.set, s.text, s.parent_code, s.is_leaf, s.eld_strand],
      );
    }
  });
}

export async function seed_users(db: PgDatabase, users: Array<{ id: string; name: string; role?: string }>): Promise<void> {
  await db.with_tx(async (tx) => {
    for (const u of users) {
      const role = u.role ?? "author";
      await insert_row(tx, "app_user", { id: u.id, email: `${role}.${u.id}@example.test`, name: u.name, role, synthetic: true, password_hash: "x" });
    }
  });
}
