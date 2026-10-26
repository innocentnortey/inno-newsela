// GEN-4: splits the stored wait into the debounce wait and the Postgres write from `collab.stored` log lines.
// Pure aggregation over JSON log lines (numbers only, no lesson text). CLI: tsx load/store-split.ts <collab.log>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { percentile } from "./stats.ts";

export interface StoreSplit {
  n: number;
  wait_p50: number | null;
  wait_p95: number | null;
  db_p50: number | null;
  db_p95: number | null;
  total_p95: number | null;
  wait_null: number;
}

const pct = (v: number[], p: number): number | null => (v.length === 0 ? null : percentile(v, p));
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function summarise_store_split(lines: Iterable<string>): StoreSplit {
  const wait: number[] = [];
  const db: number[] = [];
  const total: number[] = [];
  let n = 0;
  let wait_null = 0;
  for (const line of lines) {
    let o: unknown;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof o !== "object" || o === null) continue;
    const rec = o as { event?: unknown; message?: unknown; extra?: Record<string, unknown> };
    if (rec.event !== "collab.stored" && rec.message !== "collab.stored") continue;
    n += 1;
    const w = rec.extra?.["store_wait_ms"];
    const d = rec.extra?.["db_write_ms"];
    if (num(w)) wait.push(w);
    else wait_null += 1;
    if (num(d)) db.push(d);
    if (num(w) && num(d)) total.push(w + d);
  }
  return { n, wait_p50: pct(wait, 50), wait_p95: pct(wait, 95), db_p50: pct(db, 50), db_p95: pct(db, 95), total_p95: pct(total, 95), wait_null };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (path === undefined) {
    console.error("usage: store-split.ts <collab.log>");
    process.exit(2);
  }
  console.log(JSON.stringify(summarise_store_split(readFileSync(path, "utf8").split("\n"))));
}
