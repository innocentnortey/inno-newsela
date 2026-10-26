// NL-118 test helper: a built Next app on a free port + a fresh migrated test database + the seeded demo accounts
// + one unit with 3 lessons. Needs an existing apps/web/.next/BUILD_ID (shared build; never builds on a shared machine).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { insert_row } from "@ls/db/testing/insert-row";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const WEB_DIR = path.join(ROOT, "apps/web");

export interface ProbeStack {
  base_url: string;
  database_url: string;
  password: string;
  emails: { author: string; reviewer: string; approver: string };
  unit_id: string;
  lesson_ids: string[];
  db: TestDb;
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
  stop(): Promise<void>;
}

async function free_port(wanted = 0): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", (e) => (wanted === 0 ? fail(e) : free_port(0).then(ok, fail)));
    s.listen(wanted, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

async function wait_for_200(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status === 200) return;
      last = `status ${r.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`stack did not become ready at ${url} within ${ms} ms (${last})`);
}

function kill_group(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const group = (sig: NodeJS.Signals) => {
      try {
        process.kill(-(child.pid as number), sig);
      } catch {
        child.kill(sig);
      }
    };
    const hard = setTimeout(() => group("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(hard);
      done();
    });
    group("SIGTERM");
  });
}

export async function start_probe_stack(): Promise<ProbeStack> {
  if (!existsSync(path.join(WEB_DIR, ".next", "BUILD_ID"))) {
    throw new Error("run `npx next build` in apps/web first (shared build; the probe tests never build on a shared machine)");
  }
  // LOAD_TEST_PORT is a preference: a second test file started in parallel finds it taken and gets another free port.
  const port = String(await free_port(Number(process.env["LOAD_TEST_PORT"] ?? 0)));
  const base_url = `http://localhost:${port}`;
  const db = await create_test_db({ pool_max: 2 });
  let web: ChildProcess | undefined;
  try {
    const password = randomBytes(15).toString("base64url").replace(/[^A-Za-z0-9]/g, "a").slice(0, 20).padEnd(20, "x");
    const seed_env = { PATH: process.env["PATH"], HOME: process.env["HOME"], DATABASE_URL: db.url, SEED_DEMO_PASSWORD: password } as unknown as NodeJS.ProcessEnv;
    const seeded = spawnSync("npx", ["tsx", "ops/seed.ts"], { cwd: ROOT, env: seed_env, encoding: "utf8", timeout: 120_000 });
    if (seeded.status !== 0) {
      throw new Error(`seed failed (status ${seeded.status}): ${(seeded.stderr || seeded.stdout).replaceAll(password, "***").slice(-1500)}`);
    }
    const run = async (text: string, values: unknown[]): Promise<Record<string, unknown>[]> =>
      db.db.with_tx(async (tx) => (await tx.query(text, values)).rows as Record<string, unknown>[]);
    const q = {
      query: async (text: string, values?: readonly unknown[]) => {
        const rows = await run(text, values ? [...values] : []);
        return { rows, rowCount: rows.length };
      },
    };

    // One unit, three lessons. Content is the WP-1 stored fixture; the Yjs bytes are a placeholder (the reads under load use derived_json only).
    const fixture = JSON.parse(readFileSync(path.join(ROOT, "packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as Record<string, unknown>;
    const unit_id = "G6.U9";
    await insert_row(q, "unit", { id: unit_id });
    const lesson_ids: string[] = [];
    for (let n = 1; n <= 3; n++) {
      const lesson_id = `${unit_id}.L${n}`;
      const vid = `lv_probe_${randomBytes(4).toString("hex")}`;
      const lesson = { ...fixture, lesson_id, title: `Probe lesson ${n}` };
      await insert_row(q, "lesson", {
        id: lesson_id, unit_id, number: n, type: String(fixture["type"]), title: `Probe lesson ${n}`, state: "in_review",
        current_version_id: vid, reviewer_id: null, last_editor_id: null, schema_version: 1,
      });
      await insert_row(q, "lesson_version", {
        id: vid, lesson_id, number: 1, kind: "generated", adopted: false, content_hash: "a".repeat(64), state_vector: null,
        lesson_json: JSON.stringify(lesson), draft_json: "{}", teacher_word_count: 0,
        provenance_json: JSON.stringify({ outline_row_hash: "a".repeat(64), prompt_version_id: "pv_probe", model: "stub", parameters: {}, schema_version: 1, example_set_id: null, run_id: null, model_call_ids: [], cost_usd: "0", ai_assisted_spans: 0, derived_from_version_id: null }),
        model_call_ids: "[]", dependency_record_json: "[]",
      });
      await insert_row(q, "lesson_doc", {
        lesson_id, seq: 1, store_id: `st_probe_${randomBytes(4).toString("hex")}`, ydoc_bytes: Buffer.from("probe"),
        derived_json: JSON.stringify(lesson), content_hash: "a".repeat(64), state_vector: Buffer.from("probe"), schema_version: 1,
      });
      lesson_ids.push(lesson_id);
    }

    const env = {
      PATH: process.env["PATH"], HOME: process.env["HOME"], DATABASE_URL: db.url, AUDIT_HASH_SALT: "e2e-salt-0000000000000000",
      COLLAB_INTERNAL_TOKEN: "e2e-token-00000000000000000", APP_ORIGIN: base_url, MODEL_PROVIDER_MODE: "stub",
      SESSION_COOKIE_NAME: "ls_session", BUILD_ID: "probe", LOG_LEVEL: "warn", PORT: port,
    } as unknown as NodeJS.ProcessEnv;
    web = spawn("npx", ["next", "start", "-p", port, "-H", "localhost"], { cwd: WEB_DIR, env, detached: true, stdio: "ignore" });
    await wait_for_200(`${base_url}/sign-in`, 90_000);
    const child = web;
    return {
      base_url, database_url: db.url, password, emails: { author: "author.demo@example.test", reviewer: "reviewer.demo@example.test", approver: "approver.demo@example.test" },
      unit_id, lesson_ids, db,
      query: ((text: string, values?: unknown[]) => run(text, values ?? [])) as ProbeStack["query"],
      async stop() {
        await kill_group(child);
        await db.drop();
      },
    } as ProbeStack;
  } catch (e) {
    if (web) await kill_group(web);
    await db.drop();
    throw e;
  }
}
