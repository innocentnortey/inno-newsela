// NL-92 AC-1, AC-2, AC-6: planting against the real Postgres repos through the real CLI entry. Needs scripts/test-db.sh up.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StoredLesson } from "@ls/schema/lesson";
import { planted_in } from "./mutations.ts";
import { run_cli } from "../cli.ts";
import { SEEDED_UNIT_ID } from "./deps.ts";
import { REPO, REVIEWER_EMAIL, make_world, read_state, run_id_of, type World } from "./test-world.ts";

let w: World;
let rows: (sql: string, v?: unknown[]) => Promise<Record<string, unknown>[]>;
const markers = JSON.parse(fs.readFileSync(path.join(REPO, "evals/tests/fixtures/seed/key-5-plants.json"), "utf8")) as { plant_id: string; marker: string }[];

beforeAll(async () => {
  w = await make_world();
  rows = (sql, v = []) => w.t.db.with_tx(async (tx) => (await tx.query(sql, v)).rows as Record<string, unknown>[]);
}, 120_000);
afterAll(async () => w.close());

describe("WF-26 planting", () => {
  it("plants_five_copies_by_planter", async () => {
    const key = w.write_key("seed-key-a.json");
    expect(await run_cli(["seed", "--plan", key], w.deps())).toBe(0);
    const run_id = run_id_of(w);
    const lessons = await rows("SELECT id, state FROM lesson WHERE unit_id=$1 ORDER BY id", [SEEDED_UNIT_ID]);
    expect(lessons.map((l) => l["id"])).toEqual(["G6.U99.L1", "G6.U99.L2", "G6.U99.L3", "G6.U99.L4", "G6.U99.L5"]);
    const state = read_state(w, run_id);
    for (const p of state.plants) {
      const doc = await rows("SELECT derived_json, content_hash, stored_by FROM lesson_doc WHERE lesson_id=$1", [p.lesson_id]);
      expect(doc).toHaveLength(1);
      expect(doc[0]?.["content_hash"]).toBe(p.content_hash);
      expect(doc[0]?.["stored_by"]).toBe(state.planter_id);
      expect(planted_in(doc[0]?.["derived_json"] as StoredLesson, p)).toBe(true);
    }
    const audits = await rows("SELECT actor_id, details_json FROM audit_event WHERE action='eval.seed_plant'");
    expect(audits).toHaveLength(5);
    for (const a of audits) expect(a["details_json"]).toMatchObject({ planted_by: state.planter_id });
    const planter = await rows("SELECT role, synthetic FROM app_user WHERE id=$1", [state.planter_id]);
    expect(planter[0]).toMatchObject({ role: "author", synthetic: true });
    expect(state.planter_id).not.toBe(w.reviewer_id);
    const runs = await rows("SELECT suite, provider_mode FROM eval_run WHERE id=$1", [run_id]);
    expect(runs).toEqual([{ suite: "S10", provider_mode: "stub" }]);
    // the source lesson is untouched
    expect(await rows("SELECT 1 FROM lesson_doc WHERE lesson_id='G6.U4.L4'")).toHaveLength(1);
  });

  it("key_hidden_from_reviewer_surfaces", async () => {
    // Every table the review API reads, plus everything printed, must hold no plant id, marker kind label or key file name.
    const secrets = [...markers.flatMap((m) => [m.plant_id]), "seed-key-a", "wrong_standard_code", "invented_quote", "missing_section", "page_out_of_range", "safety_in_student_block"];
    const surfaces: string[] = [];
    for (const table of ["issue", "review_event", "audit_event", "lesson", "unit", "app_user"]) {
      surfaces.push(JSON.stringify(await rows(`SELECT * FROM ${table}`)));
    }
    surfaces.push(JSON.stringify(await rows("SELECT lesson_id, content_hash, stored_by FROM lesson_doc")), w.logs.join("\n"));
    for (const s of surfaces) for (const secret of secrets) expect(s).not.toContain(secret);
    expect(execFileSync("git", ["check-ignore", "evals/local/seed-key-x.json"], { cwd: REPO }).toString()).toContain("seed-key-x.json");
  });
});

describe("WF-26 refusals", () => {
  const counts = async () => ({
    lessons: (await rows("SELECT id FROM lesson")).length,
    docs: (await rows("SELECT 1 FROM lesson_doc")).length,
    audits: (await rows("SELECT 1 FROM audit_event")).length,
    runs: (await rows("SELECT 1 FROM eval_run")).length,
  });

  it("refuses_non_seeded_unit_and_planter_equals_reviewer", async () => {
    const before = await counts();
    // (a) a plant whose target lesson is in a real unit
    const bad = JSON.parse(fs.readFileSync(path.join(w.root, "evals/local/seed-key-a.json"), "utf8")) as Record<string, unknown>[];
    bad[0] = { ...bad[0], lesson_id: "G6.U4.L9" };
    fs.writeFileSync(path.join(w.root, "evals/local/seed-key-b.json"), JSON.stringify(bad));
    w.errs.length = 0;
    expect(await run_cli(["seed", "--plan", "evals/local/seed-key-b.json"], w.deps())).toBe(2);
    expect(w.errs.join(" ")).toContain("seeded unit");
    expect(await counts()).toEqual(before);

    // (b) planter account equals a reviewer account
    const fresh = w.write_key("seed-key-c.json").replace(/c\.json$/, "c.json");
    fs.writeFileSync(
      path.join(w.root, fresh),
      JSON.stringify((JSON.parse(fs.readFileSync(path.join(w.root, fresh), "utf8")) as { lesson_id: string }[]).map((p, i) => ({ ...p, lesson_id: `G6.U99.L${i + 11}` }))),
    );
    const d = w.deps({ seed: { db: w.t.db, ids: w.ids, planter_email: REVIEWER_EMAIL } });
    w.errs.length = 0;
    expect(await run_cli(["seed", "--plan", fresh], d)).toBe(2);
    expect(w.errs.join(" ")).toContain("reviewer");
    expect(await counts()).toEqual(before);
  });
});
