// NL-92 test helper: a migrated test database with standards, a reviewer, a source lesson, and a temp repo root.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { insert_row } from "@ls/db/testing/insert-row";
import { seed_standards } from "@ls/db/testing/outline-seed";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import type { StoredLesson } from "@ls/schema/lesson";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import type { CliDeps } from "../cli.ts";
import { default_suite_factory } from "../registry.ts";
import type { SeedState } from "./plant.ts";

export const REPO = path.join(import.meta.dirname, "../../..");
export const KEY_FIXTURE = path.join(REPO, "evals/tests/fixtures/seed/key-5-plants.json");
export const REVIEWER_EMAIL = "reviewer.one@example.test";

export interface World {
  t: TestDb;
  root: string;
  ids: PrefixedIdGenerator;
  clock: FakeClock;
  evidence: PgEvidenceRepo;
  out: string[];
  errs: string[];
  logs: string[];
  deps(over?: Partial<CliDeps>): CliDeps;
  write_key(name: string, take?: number): string;
  store: PgLessonDocStore;
  reviewer_id: string;
  close(): Promise<void>;
}

export const wp1 = (): StoredLesson =>
  JSON.parse(fs.readFileSync(path.join(REPO, "packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as StoredLesson;

export async function make_world(seed_source = true): Promise<World> {
  const t = await create_test_db({ pool_max: 6 });
  const ids = new PrefixedIdGenerator();
  const clock = new FakeClock(new Date("2026-10-25T10:00:00.000Z"));
  const base = { db: t.db, ids, clock };
  const store = new PgLessonDocStore({ ...base, checks: new PgCheckQueue(base), states: new PgLessonRepo(base), audit: new PgAuditLog(base) });
  await seed_standards(t.db);
  const reviewer_id = ids.new_id("usr");
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: reviewer_id, email: REVIEWER_EMAIL, name: "Reviewer One", role: "reviewer", synthetic: true, password_hash: "x" });
    if (seed_source) {
      await insert_row(tx, "lesson", { id: "G6.U4.L4", unit_id: "G6.U4", state: "in_review" });
      await store.seed_initial("G6.U4.L4", wp1(), { user_id: null, name: "system", role: null, synthetic: true }, tx);
    }
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nl92-world-"));
  fs.mkdirSync(path.join(root, "evals/local"), { recursive: true });
  const evidence = new PgEvidenceRepo(base);
  const out: string[] = [];
  const errs: string[] = [];
  const logs: string[] = [];
  return {
    t, root, ids, clock, evidence, out, errs, logs, store, reviewer_id,
    deps: (over = {}) => ({
      evidence, clock, suite_factory: default_suite_factory, git_sha: "abc123def456", repo_root: root, prompt_version_id: null,
      models: { generation: "m" }, env: { ANTHROPIC_API_KEY: "sk-test-NL92-key" }, seed: { db: t.db, ids },
      out: (l) => { out.push(l); logs.push(l); }, err: (l) => { errs.push(l); logs.push(l); }, ...over,
    }),
    write_key(name, take = 5) {
      const plants = (JSON.parse(fs.readFileSync(KEY_FIXTURE, "utf8")) as unknown[]).slice(0, take);
      fs.writeFileSync(path.join(root, "evals/local", name), JSON.stringify(plants));
      return `evals/local/${name}`;
    },
    async close() {
      fs.rmSync(root, { recursive: true, force: true });
      await t.drop();
    },
  };
}

export const read_state = (w: World, run_id: string): SeedState =>
  JSON.parse(fs.readFileSync(path.join(w.root, "evals/local", `seed-state-${run_id}.json`), "utf8")) as SeedState;

export const run_id_of = (w: World): string => {
  const m = w.out.map((l) => /run_id=(\S+)/.exec(l)?.[1]).find((x) => x !== undefined);
  if (m === undefined) throw new Error("no run id printed");
  return m;
};

export async function store_version(w: World, lesson: StoredLesson, by: string): Promise<void> {
  const bytes = lesson_to_ydoc(lesson);
  await w.store.store({
    lesson_id: lesson.lesson_id, ydoc_bytes: bytes, derived: lesson, content_hash: content_hash(lesson), state_vector: state_vector_of(bytes),
    stored_by: by, request_id: null, tag: null,
  });
}

export async function send_back(w: World, lesson_id: string, note: string): Promise<void> {
  await w.t.db.with_tx(async (tx) => {
    await tx.query("UPDATE lesson SET state='changes_requested', reviewer_id=$2 WHERE id=$1", [lesson_id, w.reviewer_id]);
    await insert_row(tx, "review_event", { lesson_id, from_state: "in_review", to_state: "changes_requested", actor_id: w.reviewer_id, note });
  });
}

export async function approve(w: World, lesson_id: string): Promise<void> {
  await w.t.db.with_tx(async (tx) => {
    await tx.query("UPDATE lesson SET state='approved', reviewer_id=$2 WHERE id=$1", [lesson_id, w.reviewer_id]);
    await insert_row(tx, "review_event", { lesson_id, from_state: "in_review", to_state: "approved", actor_id: w.reviewer_id });
  });
}

export async function raise_issue(w: World, lesson_id: string, content_hash_: string, kind: string): Promise<void> {
  await w.t.db.with_tx(async (tx) => {
    await insert_row(tx, "issue", { id: w.ids.new_id("iss"), lesson_id, content_hash: content_hash_, level: "blocking", kind, message: "A check raised this." });
  });
}
