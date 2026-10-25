// Local structural types for the web dependency set (NL-06).
// NL-12 replaces these bodies with `export type { … } from` the real files (collision-map edit).
// IdPrefix is the one allowed helper export: a type-only union used by IdGenerator.
export interface PgDatabase {
  with_tx<T>(fn: (tx: unknown) => Promise<T>, advisory_lock?: string | null): Promise<T>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
export type IdPrefix = "usr" | "run" | "job" | "mc" | "lv" | "st" | "iss" | "sug" | "sr" | "ae" | "req" | "ov" | "exp" | "ev" | "pr" | "ops";
export interface IdGenerator {
  new_id(prefix: IdPrefix): string;
}
export interface Clock {
  now(): Date;
  sleep(ms: number): Promise<void>;
}
export interface ModelClient {
  complete(req: unknown): Promise<unknown>;
}
