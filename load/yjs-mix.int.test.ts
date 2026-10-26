// NL-119 AC-1, AC-3, AC-4, AC-5: the Yjs socket load script against the real stack
// (real Postgres via scripts/test-db.sh up, the real Hocuspocus server and lesson_doc store path in this process).
// The server start-up is duplicated on purpose from apps/collab tests: tools do not import each other.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { SYSTEM_ACTOR, rows, wp1 } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { start_collab } from "./src/testing/collab.ts";
import type { SpikeOptions } from "./types.ts";
import { run_yjs_mix_detailed, run_yjs_probe, DEFAULT_TUNING, type YjsDeps } from "./yjs-mix.ts";
import { NotLoadLesson, assert_load_lesson, stored_text } from "./yjs-support.ts";

type P95 = Record<string, number | boolean | string | null>;
const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
}, 90000);
afterAll(async () => {
  await t.drop();
});

const start_server = () => start_collab(t);

function deps_with(log: string[]): YjsDeps {
  return { db: t.db, evidence: new PgEvidenceRepo({ db: t.db, ids, clock }), ids, clock, log: (l) => void log.push(l), git_sha: "test-sha", machine: "test-box 1cpu" };
}
const opts = (url: string, over: Partial<SpikeOptions> = {}): SpikeOptions => ({
  users: 3, ramp_s: 1, plateau_s: 20, socket_editors: 3, base_url: "", collab_url: url, ...over,
});
const probe_row = async (id: string) => (await rows(t, "select kind, users, machine, lost_updates, error_rate, n, p95_json from probe_run where id = $1", [id]))[0]!;

describe("test_yjs_probe_writes_run (AC-1)", () => {
  it("3 editors on 1 lesson write one yjs probe_run row with p95s, 0 lost updates", async () => {
    const h = await start_server();
    const log: string[] = [];
    try {
      const before = Number((await rows(t, "select count(*)::int as n from probe_run where kind = 'yjs'"))[0]!["n"]);
      const out = await run_yjs_probe(opts(h.url), deps_with(log), { typing_share: 1, interval_ms: 500, drop_share: 0 });
      const after = Number((await rows(t, "select count(*)::int as n from probe_run where kind = 'yjs'"))[0]!["n"]);
      expect(after).toBe(before + 1);
      const row = await probe_row(out.record.probe_run_id);
      const p = row["p95_json"] as P95;
      expect(row["kind"]).toBe("yjs");
      expect(row["machine"]).not.toBe("");
      expect(Number(row["lost_updates"])).toBe(0);
      expect(Number(row["n"])).toBeGreaterThanOrEqual(30);
      expect(typeof p["remote_edit"]).toBe("number");
      expect(typeof p["stored"]).toBe("number");
      expect(p["remote_edit"]).toBeGreaterThan(0);
      expect(p["stored"]).toBeGreaterThan(0);
      expect(p["incomplete"]).toBe(false);
      expect(p["remote_edit_n"]).toBeGreaterThan(0);
      expect(p["remote_edit_during_drop_n"]).toBe(0);
      expect(p["incomplete_reason"]).toBeNull();
      expect(out.exit_code).toBe(0);
      expect(log.some((l) => l.startsWith(`wf=WF-30 probe_run_id=${out.record.probe_run_id} `))).toBe(true);
    } finally {
      await h.stop();
    }
  }, 90000);
});

describe("reconnect (AC-3)", () => {
  it("a forced drop reconnects with presence restored, no duplicate tokens", async () => {
    const h = await start_server();
    const log: string[] = [];
    try {
      const token_re = /\[[0-9a-f]{8}-e\d+-\d+\]/g;
      const tokens_before = ((await stored_text(t.db, "G6.U9.L901")).match(token_re) ?? []).length;
      const out = await run_yjs_probe(opts(h.url), deps_with(log), { typing_share: 1, interval_ms: 500, drop_share: 0.34 });
      const p = (await probe_row(out.record.probe_run_id))["p95_json"] as P95;
      expect(typeof p["reconnect_p95_s"]).toBe("number");
      expect(p["reconnect_p95_s"]).toBeGreaterThan(0);
      expect(p["reconnect_p95_s"]).toBeLessThanOrEqual(10); // capacity target: recorded, not tuned
      expect(p["duplicate_tokens"]).toBe(0);
      expect(p["incomplete"]).toBe(false);
      expect(typeof p["stored_n"]).toBe("number");
      expect(typeof p["stored_during_drop_n"]).toBe("number");
      expect(Number(p["stored_n"]) + Number(p["stored_during_drop_n"])).toBe(out.record.n - Number(p["unacknowledged"]));
      const text = await stored_text(t.db, "G6.U9.L901");
      const tokens = text.match(token_re) ?? [];
      expect(new Set(tokens).size).toBe(tokens.length); // each token at most once
      expect(tokens.length - tokens_before).toBe(out.record.n); // every sent token persisted exactly once
      expect(out.record.n).toBeGreaterThan(0);
      expect(out.record.lost_updates).toBe(0);
    } finally {
      await h.stop();
    }
  }, 90000);
});

describe("demo_unit_untouched (AC-4)", () => {
  it("a run changes no lesson_doc or lesson_version row of any non-load lesson", async () => {
    const h = await start_server();
    try {
      const control = "G6.U4.L490";
      const store = new PgLessonDocStore({
        db: t.db, ids, clock, checks: new PgCheckQueue({ db: t.db, ids, clock }), states: new PgLessonRepo({ db: t.db, ids, clock }),
        audit: new PgAuditLog({ db: t.db, ids, clock }),
      });
      await t.db.with_tx(async (tx) => {
        await insert_row(tx as never, "lesson", { id: control, state: "in_review", last_editor_id: null });
        await store.seed_initial(control, { ...wp1(), lesson_id: control }, SYSTEM_ACTOR, tx);
      });
      const snap = async () => {
        const docs = await rows(t, "select lesson_id, seq, md5(ydoc_bytes::text || content_hash) as h from lesson_doc where lesson_id not like 'G6.U9.L9%' order by lesson_id, seq");
        const vers = await rows(t, "select lesson_id, md5(lesson_json::text || content_hash) as h from lesson_version where lesson_id not like 'G6.U9.L9%' order by lesson_id, md5(lesson_json::text || content_hash)");
        return { docs, vers };
      };
      const before = await snap();
      expect(before.docs.length).toBeGreaterThan(0);
      await run_yjs_probe(opts(h.url, { plateau_s: 8 }), deps_with([]), { typing_share: 1, interval_ms: 500, drop_share: 0, drain_ms: 5000 });
      expect(await snap()).toEqual(before);
    } finally {
      await h.stop();
    }
  }, 90000);
  it("refuses_non_load_lesson", () => {
    expect(() => assert_load_lesson("G6.U4.L4")).toThrow(NotLoadLesson);
    expect(() => assert_load_lesson("G6.U9.L901")).not.toThrow();
  });
});

describe("server_down (AC-5)", () => {
  it("a server that goes away mid-plateau still leaves an incomplete row and exit code 1", async () => {
    const h = await start_server();
    const log: string[] = [];
    const run = run_yjs_probe(opts(h.url), deps_with(log), {
      typing_share: 1, interval_ms: 500, drop_share: 0, drain_ms: 2000, reconnect_timeout_ms: 3000,
    });
    await new Promise((r) => setTimeout(r, 5000));
    await h.stop();
    const out = await run;
    expect(out.exit_code).toBe(1);
    const row = await probe_row(out.record.probe_run_id);
    expect((row["p95_json"] as P95)["incomplete"]).toBe(true);
    expect((row["p95_json"] as P95)["incomplete_reason"]).toBeTruthy();
    expect(Number(row["error_rate"])).toBeGreaterThan(0);
  }, 60000);
});

describe("remote_edit_p95_excludes_drop (F-1)", () => {
  it("samples across a dropped socket are counted apart, none lost", async () => {
    const h = await start_server();
    try {
      const d = await run_yjs_mix_detailed(
        opts(h.url, { plateau_s: 12 }),
        { ...DEFAULT_TUNING, typing_share: 1, interval_ms: 200, drop_share: 0.34, drain_ms: 5000 },
        deps_with([]),
      );
      const p = d.result.p95_ms as P95;
      expect(p["remote_edit_during_drop_n"]).toBeGreaterThanOrEqual(1);
      expect(p["remote_edit_n"]).toBeGreaterThanOrEqual(1);
      expect((p["remote_edit_n"] as number) + (p["remote_edit_during_drop_n"] as number)).toBe(d.remote_samples_total);
    } finally {
      await h.stop();
    }
  }, 90000);
});

describe("unacknowledged_after_drain (F-2)", () => {
  it("tokens never acknowledged make the run incomplete with exit code 1", async () => {
    const h = await start_server();
    try {
      const out = await run_yjs_probe(opts(h.url, { plateau_s: 4 }), deps_with([]), { typing_share: 1, interval_ms: 100, drop_share: 0, drain_ms: 0 });
      const p = (await probe_row(out.record.probe_run_id))["p95_json"] as P95;
      expect(out.exit_code).toBe(1);
      expect(p["incomplete"]).toBe(true);
      expect(p["incomplete_reason"]).toBe("unacknowledged_after_drain");
      expect(p["unacknowledged"]).toBeGreaterThan(0);
      expect(out.record.lost_updates).toBe(0);
    } finally {
      await h.stop();
    }
  }, 60000);
});
