// NL-119 AC-8: obligations WF-30 (the Yjs socket load script) inherits, one case per id, driving run_yjs_probe (its real entry)
// on the real stack: real Postgres, real Hocuspocus server. The server start-up is duplicated on purpose (tools do not import each other).
import { readFileSync } from "node:fs";
import { Server } from "@hocuspocus/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { load_collab_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { rows } from "@ls/db/repos/lesson-docs.test-support";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import { wire_collab_server } from "../apps/collab/src/wiring/server.ts";
import { run_yjs_probe, type YjsDeps, type YjsOutcome } from "./yjs-mix.ts";

const here = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
interface Ev { git_sha: string; prompt_version: null; models: string[] }
const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
let out: YjsOutcome;
const log: string[] = [];
const queries: string[] = [];

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
  const logger = create_logger({ service: "collab", build_id: "test", write: () => undefined });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab", SESSION_COOKIE_NAME: "ls_session" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: 500, store_max_debounce_ms: 1000 };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const wiring = wire_collab_server({ settings, logger, db: t.db as never, ids, clock }, { hocuspocus: server.hocuspocus });
  await server.listen();
  // Record every SQL text the script (and the repos it calls) runs, without changing behaviour.
  const spy = new Proxy(t.db, {
    get(target, prop) {
      if (prop !== "with_tx") return Reflect.get(target, prop, target);
      return (cb: (tx: unknown) => Promise<unknown>) =>
        target.with_tx((tx) =>
          cb(
            new Proxy(tx as object, {
              get(tt, p) {
                if (p !== "query") return Reflect.get(tt, p, tt);
                return (text: string, v?: readonly unknown[]) => {
                  queries.push(text);
                  return (tt as { query(t: string, v?: readonly unknown[]): Promise<unknown> }).query(text, v);
                };
              },
            }),
          ),
        );
    },
  });
  const deps: YjsDeps = {
    db: spy, evidence: new PgEvidenceRepo({ db: t.db, ids, clock }), ids, clock, log: (l) => void log.push(l), git_sha: "test-sha", machine: "test-box 1cpu",
  };
  try {
    out = await run_yjs_probe(
      { users: 3, ramp_s: 1, plateau_s: 6, socket_editors: 3, base_url: "", collab_url: `ws://127.0.0.1:${server.address.port}` },
      deps,
      { typing_share: 1, interval_ms: 500, drop_share: 0, drain_ms: 5000 },
    );
  } finally {
    await server.destroy();
    await wiring.close();
  }
}, 120000);
afterAll(async () => {
  await t.drop();
});

describe("WF-30 obligations (NL-119 AC-8)", () => {
  it("GR-9: no log line, no row JSON and no load/yjs-*.ts source mentions or reads docs/source/restricted", async () => {
    const [row] = await rows(t, "select p95_json from probe_run where id = $1", [out.record.probe_run_id]);
    expect(JSON.stringify(row)).not.toContain("restricted");
    expect(log.join("\n")).not.toContain("restricted");
    for (const f of ["yjs-mix.ts", "yjs-stats.ts", "yjs-support.ts"]) expect(here(f)).not.toContain("source/restricted");
  });

  it("GR-13: only synthetic @example.test reviewers, sessions from app_session, no student table read", async () => {
    const users = await rows(t, "select email, synthetic, role from app_user where id like 'load-rev-%'");
    expect(users.length).toBe(3);
    for (const u of users) {
      expect(u["synthetic"]).toBe(true);
      expect(String(u["email"])).toMatch(/@example\.test$/);
      expect(u["role"]).toBe("reviewer");
    }
    expect(queries.some((q) => q.includes("app_session"))).toBe(true);
    expect(queries.filter((q) => /student/i.test(q))).toEqual([]);
    const left = await rows(t, "select count(*)::int as n from app_session where user_id like 'load-rev-%'");
    expect(left[0]!["n"]).toBe(0); // the script removes the sessions it created
  });

  it("EV-R1: the row carries git_sha, prompt_version null and an empty model list", async () => {
    const [row] = await rows(t, "select p95_json from probe_run where id = $1", [out.record.probe_run_id]);
    const ev = (row!["p95_json"] as { evidence: Ev }).evidence;
    expect(typeof ev.git_sha).toBe("string");
    expect(ev.git_sha.length).toBeGreaterThan(0);
    expect(ev.prompt_version).toBeNull();
    expect(ev.models).toEqual([]);
  });

  it("OBS-11: the observability table has the WF-30 row and the log line id equals the row id", async () => {
    expect(here("../docs/design/observability.md")).toMatch(/\| WF-30 \|/);
    const line = log.find((l) => l.startsWith("wf=WF-30 probe_run_id="));
    expect(line).toBeDefined();
    const id = /probe_run_id=(\S+)/.exec(line!)![1];
    const found = await rows(t, "select id from probe_run where id = $1", [id]);
    expect(found.length).toBe(1);
    expect(id).toBe(out.record.probe_run_id);
  });
});
