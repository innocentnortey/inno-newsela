import type { PoolClient, QueryResultRow } from "pg";

export class Tx {
  readonly #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: R[]; rowCount: number }> {
    const r = await this.#client.query<R>(
      text,
      values === undefined ? undefined : [...values],
    );
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  }
}

export type TxFunction<T> = (tx: Tx) => Promise<T>;

/** BEGIN; optional transaction-scoped advisory lock; fn; COMMIT. On a throw: ROLLBACK, then rethrow the original error. */
export async function run_in_tx<T>(
  client: PoolClient,
  fn: TxFunction<T>,
  advisory_lock: string | null,
): Promise<T> {
  await client.query("BEGIN");
  try {
    if (advisory_lock !== null)
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        advisory_lock,
      ]);
    const out = await fn(new Tx(client));
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollback_err) {
      (err as { rollback_error?: unknown }).rollback_error = rollback_err;
      throw err;
    }
    throw err;
  }
}
