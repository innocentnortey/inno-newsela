import pg from "pg";
import type { SharedSettings } from "@ls/config/settings";
import { PoolExhausted, type PoolName } from "./pool-exhausted.ts";
import { run_in_tx, type TxFunction } from "./tx.ts";

export class PgDatabase {
  readonly #pool: pg.Pool;
  readonly #acquire_timeout_ms: number;
  readonly #pool_name: PoolName;

  constructor(
    settings: SharedSettings,
    pool_max: number,
    acquire_timeout_ms: number,
    pool_name: PoolName = "web",
  ) {
    this.#pool = new pg.Pool({
      connectionString: settings.database_url.reveal(),
      max: pool_max,
      connectionTimeoutMillis: acquire_timeout_ms,
    });
    // An idle client's error must not crash the process; the next acquire reports it.
    this.#pool.on("error", () => {});
    this.#acquire_timeout_ms = acquire_timeout_ms;
    this.#pool_name = pool_name;
  }

  async #acquire(): Promise<pg.PoolClient> {
    const started = performance.now();
    try {
      return await this.#pool.connect();
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("timeout exceeded when trying to connect")
      ) {
        const elapsed = Math.round(performance.now() - started);
        throw new PoolExhausted(
          this.#pool_name,
          Math.max(this.#acquire_timeout_ms, elapsed),
        );
      }
      throw err;
    }
  }

  async with_tx<T>(
    fn: TxFunction<T>,
    advisory_lock: string | null = null,
  ): Promise<T> {
    const client = await this.#acquire();
    let release_error: Error | undefined;
    try {
      return await run_in_tx(client, fn, advisory_lock);
    } catch (err) {
      if (err instanceof Error && "rollback_error" in err) release_error = err;
      throw err;
    } finally {
      client.release(release_error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.#acquire();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
