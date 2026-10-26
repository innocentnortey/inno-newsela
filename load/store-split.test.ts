import { describe, expect, it } from "vitest";
import { summarise_store_split } from "./store-split.ts";

const line = (wait: number | null, db: number) => JSON.stringify({ event: "collab.stored", extra: { seq: 1, store_wait_ms: wait, db_write_ms: db } });

describe("summarise_store_split", () => {
  it("0 samples gives n 0 and null percentiles", () => {
    expect(summarise_store_split([])).toEqual({ n: 0, wait_p50: null, wait_p95: null, db_p50: null, db_p95: null, total_p95: null, wait_null: 0 });
  });
  it("1 sample", () => {
    expect(summarise_store_split([line(2500, 12)])).toMatchObject({ n: 1, wait_p50: 2500, wait_p95: 2500, db_p50: 12, total_p95: 2512 });
  });
  it("10 samples use nearest-rank percentiles", () => {
    const ls = Array.from({ length: 10 }, (_, i) => line((i + 1) * 100, i + 1));
    expect(summarise_store_split(ls)).toMatchObject({ n: 10, wait_p50: 500, wait_p95: 1000, db_p50: 5, db_p95: 10, total_p95: 1010 });
  });
  it("skips malformed lines and other messages; counts null waits apart", () => {
    const r = summarise_store_split(["not json", JSON.stringify({ event: "other", extra: { store_wait_ms: 9 } }), "", line(null, 7), line(100, 3)]);
    expect(r).toMatchObject({ n: 2, wait_null: 1, wait_p95: 100, db_p95: 7, total_p95: 103 });
  });
});
