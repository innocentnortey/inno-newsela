// NL-110 unit tests: claim ordering, backoff, stop, one log line. Fake database, fake job, FakeClock.
import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import type { TxRunner } from "@ls/core/ports/tx";
import { create_logger } from "@ls/obs/logger";
import Decimal from "decimal.js";
import { JudgeClaimLoop, type JudgeJobPort } from "./claim-loop.ts";
import type { JudgeRunReport } from "./judge-job.ts";

const H = ("sha256:" + "b".repeat(64)) as Sha256;
const report = (over: Partial<JudgeRunReport> = {}): JudgeRunReport =>
  ({ lesson_id: "L" as LessonId, pairs: 2, verdicts_no: 0, skipped: 0, failed: 0, cost_usd: new Decimal(0), ...over });

function make(candidates: string[], run: JudgeJobPort["run"], nos: { address: string; code: string; question: string }[] = []) {
  const clock = new FakeClock();
  const lines: string[] = [];
  const logger = create_logger({ service: "w", build_id: "t", write: (l) => lines.push(l) });
  const written: unknown[] = [];
  const db: TxRunner = {
    async with_tx(fn) {
      return fn({
        query: async (sql: string) => ({ rows: sql.includes("FROM lesson_doc") ? candidates.map((c) => ({ lesson_id: c, content_hash: H })) : nos }),
      } as never);
    },
  };
  const issues = { append_advisory: async (...a: unknown[]) => (written.push(a), nos.length) };
  const loop = new JudgeClaimLoop(db, { run }, issues, clock, logger, { poll_ms: 10, backoff_ms: 100, backoff_max_ms: 250 });
  return { loop, clock, lines, written };
}

describe("JudgeClaimLoop", () => {
  it("claims the first candidate and writes advisory issues for the no verdicts", async () => {
    const seen: string[] = [];
    const nos = [{ address: "a", code: "RL.6.1", question: "teaches_standard" }];
    const { loop, written } = make(["A", "B"], async (l) => (seen.push(l), report({ verdicts_no: 1 })), nos);
    const r = await loop.run_once();
    expect(seen).toEqual(["A"]);
    expect(r).toMatchObject({ lesson_id: "A", verdicts_no: 1, issues_written: 1 });
    expect(written).toHaveLength(1);
  });

  it("returns null when nothing is claimable", async () => {
    const { loop } = make([], async () => report());
    expect(await loop.run_once()).toBeNull();
  });

  it("unavailable judge: one log line, backoff doubles and is capped, then the next lesson is tried", async () => {
    const seen: string[] = [];
    const { loop, clock, lines } = make(["A", "B"], async (l) => (seen.push(l), report({ failed: 2 })));
    await loop.run_once(); // A fails, backoff 100
    expect(lines.filter((l) => l.includes("judge.unavailable"))).toHaveLength(1);
    await loop.run_once(); // A in backoff, B tried
    expect(seen).toEqual(["A", "B"]);
    expect(await loop.run_once()).toBeNull(); // both backing off
    clock.advance(100);
    await loop.run_once(); // A again, backoff now 200
    clock.advance(150);
    expect(await loop.run_once()).toMatchObject({ lesson_id: "B" }); // B (fails=2 -> 200?) due at 100+200; A due at 100+200
    expect(seen.length).toBeGreaterThanOrEqual(3);
    clock.advance(10_000);
    await loop.run_once();
    clock.advance(250); // cap: fails grow but the wait never exceeds 250
    expect(await loop.run_once()).not.toBeNull();
  });

  it("a throwing job logs judge.failed with the name only and returns null", async () => {
    const { loop, lines } = make(["A"], async () => {
      throw new TypeError("secret sk-ant-leak");
    });
    expect(await loop.run_once()).toBeNull();
    const out = lines.join("\n");
    expect(out).toContain("judge.failed");
    expect(out).toContain("TypeError");
    expect(out).not.toContain("sk-ant-leak");
  });

  it("run_until stops when the stop flag is set and claims nothing new after", async () => {
    const seen: string[] = [];
    const { loop, clock } = make(["A"], async (l) => (seen.push(l), await new Promise((r) => setTimeout(r, 2)), report()));
    let stop = false;
    const done = loop.run_until({ is_set: () => stop });
    await new Promise((r) => setTimeout(r, 20));
    stop = true;
    clock.advance(1000);
    const r = await done;
    expect(r.judged).toBeGreaterThanOrEqual(1);
    const n = seen.length;
    await new Promise((r2) => setTimeout(r2, 20));
    expect(seen.length).toBe(n);
  });
});
