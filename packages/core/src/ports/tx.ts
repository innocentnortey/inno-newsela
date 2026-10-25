export type Tx = object; // opaque: an open transaction handle; only the adapter that issued it looks inside
export type TxFunction<T> = (tx: Tx) => Promise<T>;
export interface TxRunner {
  // Method syntax (not a property) keeps parameter bivariance so PgDatabase is assignable.
  with_tx<T>(fn: TxFunction<T>, advisory_lock?: string | null): Promise<T>;
}
