import { randomUUID } from "node:crypto";
import { PgDatabase } from "./pool.ts";
import { Tx } from "./tx.ts";

export interface OpsEventInput {
  kind: string;
  service: string;
  build_id: string;
  details: Record<string, unknown>;
  id?: string;
  at?: Date;
}

export async function record_ops_event(
  target: PgDatabase | Tx,
  e: OpsEventInput,
): Promise<string> {
  const id = e.id ?? `ops_${randomUUID()}`;
  const write = async (tx: Tx): Promise<void> => {
    await tx.query(
      `INSERT INTO ops_event (id, kind, build_id, service, details_json, at)
       VALUES ($1, $2, $3, $4, $5::jsonb, coalesce($6::timestamptz, now()))`,
      [
        id,
        e.kind,
        e.build_id,
        e.service,
        JSON.stringify(e.details),
        e.at ?? null,
      ],
    );
  };
  if (target instanceof Tx) await write(target);
  else await target.with_tx(write);
  return id;
}
