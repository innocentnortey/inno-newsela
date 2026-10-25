import type { Tx, TxFunction, TxRunner } from "../ports/tx.ts";

export class FakeTxRunner implements TxRunner {
  readonly locks: (string | null)[] = [];

  async with_tx<T>(fn: TxFunction<T>, advisory_lock: string | null = null): Promise<T> {
    this.locks.push(advisory_lock);
    const tx: Tx = {};
    return fn(tx);
  }
}
