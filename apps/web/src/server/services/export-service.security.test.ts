// NL-51 frozen security tests (AC-2, AC-6, and the service-level role check behind AC-7). Do not edit.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ExportBundleFile } from "@ls/schema/export";
import {
  SENTINELS, UNIT, all_keys, make_service, make_world, user, type World,
} from "./export-fixtures.ts";

const SCHEMA_PATH = resolve(__dirname, "../../../../../docs/contracts/lesson-export.schema.json");
const FORBIDDEN_KEYS = [
  "rendered_prompt", "raw_output", "draft", "state_vector", "provenance", "dependency_record",
  "email", "note", "review_note", "reviewer_name", "reviewer", "prompt_version_id", "model", "model_call_ids",
];

// L1 approved, L2 in_review (older approve), L3 submitted (older approve), L4 changes_requested (older approve),
// L5 reopened (older approve), L6 draft (generated + candidate rows), L7 exported (legit), L8 generation_failed.
function seeded(): { w: World; approved_ids: string[]; approved_versions: string[]; other_versions: string[] } {
  const w = make_world();
  w.links.length = 0; // no dependants here: this test is about which snapshots, not the graph
  const keep = [w.seed("G6.U4.L1", "approved"), w.seed("G6.U4.L7", "exported")];
  const others = [
    w.seed("G6.U4.L2", "in_review"),
    w.seed("G6.U4.L3", "submitted"),
    w.seed("G6.U4.L4", "changes_requested"),
    w.seed("G6.U4.L5", "reopened"),
  ];
  // a lesson's newer derived/generated row and a candidate, which are not snapshots
  const l6 = w.seed("G6.U4.L6", "draft", { approve: false });
  expect(l6).toBeNull();
  const generated = w.add_version({ ...keep[0]!, version_id: "lv_" + "G".repeat(26), lesson_id: "G6.U4.L6", kind: "generated", number: 2 });
  const candidate = w.add_version({ ...keep[0]!, version_id: "lv_" + "H".repeat(26), lesson_id: "G6.U4.L6", kind: "candidate", number: 3 });
  // newer non-approve snapshots on the approved lesson itself (a reopen row must not replace the approve row)
  const reopen = w.add_version({ ...keep[0]!, version_id: "lv_" + "J".repeat(26), kind: "reopen", number: 5 });
  w.seed("G6.U4.L8", "generation_failed", { approve: false });
  return {
    w,
    approved_ids: keep.map((k) => k!.lesson_id),
    approved_versions: keep.map((k) => k!.version_id),
    other_versions: [...others.map((o) => o!.version_id), generated.version_id, candidate.version_id, reopen.version_id],
  };
}

describe("AC-2 approved_snapshots_only [invariant]", () => {
  it("approved_snapshots_only: payload and included are exactly the approved set", async () => {
    const { w, approved_ids, approved_versions, other_versions } = seeded();
    const svc = make_service(w);
    const created = await svc.create(user("approver"), UNIT);
    expect(created.included.map((i) => i.lesson_id).sort()).toEqual([...approved_ids].sort());
    expect(created.held_back).toEqual([]);
    const listed = await svc.list(user("approver"), UNIT);
    expect(listed.included.map((i) => i.lesson_id).sort()).toEqual([...approved_ids].sort());

    const payload = await svc.download(user("approver"), created.export_id);
    expect(payload.lessons.map((l) => l.lesson_id).sort()).toEqual([...approved_ids].sort());
    expect(payload.lessons.map((l) => l.version_id).sort()).toEqual([...approved_versions].sort());
    const text = JSON.stringify(payload);
    for (const v of other_versions) expect(text).not.toContain(v);
    for (const l of ["L2", "L3", "L4", "L5", "L6", "L8"]) expect(text).not.toContain(`G6.U4.${l}`);
  });

  it("approved_snapshots_only: the service never reads a draft, derived, candidate or non-approved snapshot", async () => {
    const { w } = seeded();
    const svc = make_service(w);
    const c = await svc.create(user("approver"), UNIT);
    await svc.list(user("approver"), UNIT);
    await svc.download(user("approver"), c.export_id);
    expect(w.forbidden_reads).toEqual([]);
  });

  it("approved_snapshots_only: a lesson reopened before the lock is not exported", async () => {
    const { w } = seeded();
    const svc = make_service(w);
    // the lesson is approved when the plan is read and reopened by the time the row is locked
    const real = w.state_repo.lock_for_update;
    w.state_repo.lock_for_update = async (id, tx) => {
      if (id === "G6.U4.L1") w.set_state(id, "reopened");
      return real(id, tx);
    };
    const created = await svc.create(user("approver"), UNIT);
    expect(created.included.map((i) => i.lesson_id)).not.toContain("G6.U4.L1");
    const payload = await svc.download(user("approver"), created.export_id);
    expect(payload.lessons.map((l) => l.lesson_id)).not.toContain("G6.U4.L1");
    expect(w.states.get("G6.U4.L1")?.state).toBe("reopened");
  });
});

describe("AC-6 payload_schema_and_no_internal_fields [invariant]", () => {
  async function exported() {
    const { w } = seeded();
    const svc = make_service(w);
    const c = await svc.create(user("approver"), UNIT);
    const payload = await svc.download(user("approver"), c.export_id);
    return { w, svc, c, payload };
  }

  it("payload_schema_and_no_internal_fields: no sentinel string and no internal key in the payload", async () => {
    const { payload } = await exported();
    const text = JSON.stringify(payload);
    for (const s of Object.values(SENTINELS)) expect(text).not.toContain(s);
    const keys = all_keys(payload);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `forbidden key ${k}`).toBe(false);
    expect(payload.lessons.length).toBeGreaterThan(0);
    for (const l of payload.lessons) {
      expect(l.approved_by).toMatch(/^usr_/); // a user id, never a name or an email
      expect(Object.keys(l).sort()).toEqual(["approved_at", "approved_by", "content_hash", "lesson", "lesson_id", "version_id"]);
    }
  });

  it("payload_schema_and_no_internal_fields: the payload is a strict ExportBundleFile", async () => {
    const { payload } = await exported();
    expect(ExportBundleFile.parse(payload)).toEqual(payload);
    expect(payload.export_version).toBe(1);
    expect(payload.unit_id).toBe(UNIT);
  });

  it("payload_schema_and_no_internal_fields: validates against lesson-export.schema.json; extra keys fail", async () => {
    const { payload } = await exported();
    const spec = "ajv/dist/2020.js";
    const mod = (await import(/* @vite-ignore */ spec)) as { default: unknown };
    const Ajv = ((mod.default as { default?: unknown }).default ?? mod.default) as new (o: object) => {
      compile(s: object): ((d: unknown) => boolean) & { errors?: unknown };
    };
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
    expect(validate(JSON.parse(JSON.stringify(payload))), JSON.stringify(validate.errors)).toBe(true);

    const top = { ...JSON.parse(JSON.stringify(payload)), rendered_prompt: SENTINELS.prompt };
    expect(validate(top)).toBe(false);
    const inner = JSON.parse(JSON.stringify(payload)) as { lessons: Array<Record<string, unknown>> };
    inner.lessons[0]!["raw_output"] = SENTINELS.raw_output;
    expect(validate(inner)).toBe(false);
  });
});

describe("AC-7 service-level role check [negative]", () => {
  it("roles_notfound_download: author and reviewer are refused by the service with no write", async () => {
    const { w } = seeded();
    const svc = make_service(w);
    const c = await svc.create(user("approver"), UNIT);
    const before = w.snapshot();
    for (const role of ["author", "reviewer"] as const) {
      await expect(svc.list(user(role), UNIT)).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
      await expect(svc.create(user(role), UNIT)).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
      await expect(svc.download(user(role), c.export_id)).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    }
    expect(w.snapshot()).toEqual(before);
  });

  it("roles_notfound_download: unknown unit and unknown export id are NOT_FOUND", async () => {
    const { w } = seeded();
    const svc = make_service(w);
    await expect(svc.list(user("approver"), "G9.U9")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.create(user("approver"), "G9.U9")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.download(user("approver"), "exp_" + "0".repeat(26))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(w.writes()).toBe(0);
  });
});
