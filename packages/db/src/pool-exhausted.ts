export type PoolName = "web" | "collab" | "worker";

export class PoolExhausted extends Error {
  readonly pool: PoolName;
  readonly waited_ms: number;

  constructor(pool: PoolName, waited_ms: number) {
    super(`pool exhausted: ${pool} waited ${waited_ms}ms`);
    this.name = "PoolExhausted";
    this.pool = pool;
    this.waited_ms = waited_ms;
  }
}
