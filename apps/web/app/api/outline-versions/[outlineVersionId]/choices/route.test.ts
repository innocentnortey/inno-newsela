// @vitest-environment node
// NL-77: recordIntakeChoice (CON-4), AC-7 to AC-14.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HttpResponse } from "../../../../../src/server/http/with-route.ts";
import type { IntakeChoiceResult, ValidationReport } from "@ls/schema/api/outlines";
import { make_intake_stack, type IntakeStack } from "../../../../../src/server/services/testing/intake-harness.ts";

let s: IntakeStack;
beforeAll(async () => {
  s = await make_intake_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});

type F = ValidationReport["rows"][number]["findings"][number];
const body = (r: HttpResponse) => r.body as any;
const get_report = async (id: string, token = "valid-token") => body(await s.report(id, token)) as ValidationReport;
const findings = (r: ValidationReport): F[] => r.rows.flatMap((x) => x.findings);
const one = (r: ValidationReport, kind: string): F => findings(r).find((f) => f.kind === kind)!;
// The unit conflict has no sheet row, so the report's rows never carry it; the stored outline does.
const stored_errors = async (id: string) => (await s.repo.outline(id)).findings.filter((f) => f.level === "error");
const confirm_body = (f: { finding_id: string; kind: string }) => ({ target_id: f.finding_id, kind: f.kind === "unit_conflict" ? "confirm_unit" : "confirm_fix" });
const n = async (sql: string, v: unknown[] = []) => Number((await s.query(sql, v))[0].n);
const choice_rows = (id: string) => n("select count(*)::int as n from intake_choice where outline_version_id=$1", [id]);
const audit_rows = () => n("select count(*)::int as n from audit_event where action='outline.choice'");
const confirmed_at = async (id: string) => (await s.query("select confirmed_at from outline_version where id=$1", [id]))[0].confirmed_at as Date | null;

describe("NL-77 recordIntakeChoice", () => {
  it("confirm_last_error_unlocks_generate: the last confirmed error opens the gate and stamps confirmed_at once", async () => {
    const id = await s.uploads_issued();
    const errors = await stored_errors(id);
    expect(errors.length).toBeGreaterThan(1);
    expect(await confirmed_at(id)).toBeNull();
    let last: any = null;
    for (const [i, f] of errors.entries()) {
      const res = await s.choose(id, confirm_body(f));
      expect(res.status).toBe(200);
      last = body(res) as IntakeChoiceResult;
      expect(last.generate_allowed).toBe(i === errors.length - 1);
    }
    expect(last.counts.errors_unconfirmed).toBe(0);
    const after = await get_report(id);
    expect(after.generate_allowed).toBe(true);
    const done = findings(after).find((f) => f.finding_id === errors.find((e) => e.row_number !== null && e.kind !== "unit_conflict")!.finding_id)!;
    expect(done.choice).toMatchObject({ source: "confirmed", by: "Test author" });
    expect(Number.isNaN(Date.parse(done.choice.at as string))).toBe(false);
    const rows = await s.query("select status from intake_choice where outline_version_id=$1 and finding_id=$2", [id, done.finding_id]);
    expect(rows).toEqual([{ status: "confirmed" }]);
    const stamp = await confirmed_at(id);
    expect(stamp).not.toBeNull();
    s.clock.advance(60_000);
    const more = await s.choose(id, { target_id: one(after, "eld_mismatch").finding_id, kind: "eld_remap" });
    expect(more.status).toBe(200);
    expect((await confirmed_at(id))?.toISOString()).toBe(stamp!.toISOString());
    const remapped = await get_report(id);
    expect(remapped.rows.flatMap((x) => x.eld).some((e) => e.choice === "remap")).toBe(true);
  });

  it("untouched_warning_stays_default: a warning nobody touched has source default and no confirmed row", async () => {
    const id = await s.uploads_issued();
    const w = findings(await get_report(id)).find((f) => f.level === "warning")!;
    await s.choose(id, confirm_body(one(await get_report(id), "malformed_code")));
    const again = findings(await get_report(id)).find((f) => f.finding_id === w.finding_id)!;
    expect(again.choice.source).toBe("default");
    expect(await n("select count(*)::int as n from intake_choice where outline_version_id=$1 and finding_id=$2 and status='confirmed'", [id, w.finding_id])).toBe(0);
  });

  it("revert_and_last_write_wins: revert restores the counts; the second author's write is the final choice", async () => {
    const id = await s.uploads_issued();
    const start = await get_report(id);
    const m = one(start, "malformed_code");
    await s.choose(id, confirm_body(m));
    expect((await get_report(id)).counts.errors_unconfirmed).toBe(start.counts.errors_unconfirmed - 1);
    const reverted = await s.choose(id, { target_id: m.finding_id, kind: "revert" });
    expect(reverted.status).toBe(200);
    expect(body(reverted).counts).toEqual(start.counts);
    expect(findings(await get_report(id)).find((f) => f.finding_id === m.finding_id)!.choice.source).toBe("default");

    const audits = await audit_rows();
    await s.choose(id, { target_id: m.finding_id, kind: "confirm_fix" }, "valid-token");
    await s.choose(id, { target_id: m.finding_id, kind: "edit_fix", value: "RL.6.2" }, "author2-token");
    const final = findings(await get_report(id)).find((f) => f.finding_id === m.finding_id)!;
    expect(final.choice).toMatchObject({ value: "RL.6.2", source: "confirmed", by: "Second author" });
    expect(await audit_rows()).toBeGreaterThanOrEqual(audits + 2);
  });

  it("role_forbidden_writes_nothing: reviewer and approver get 403 and nothing is written", async () => {
    const id = await s.uploads_issued();
    const f = one(await get_report(id), "malformed_code");
    const before = [await choice_rows(id), await audit_rows(), await s.count("audit_event")];
    for (const token of ["reviewer-token", "approver-token"]) {
      const res = await s.choose(id, confirm_body(f), token);
      expect(res.status).toBe(403);
      expect(body(res).error.code).toBe("ROLE_FORBIDDEN");
    }
    expect([await choice_rows(id), await audit_rows(), await s.count("audit_event")]).toEqual(before);
  });

  it("invalid_choice_and_unknown_target: a bad code is 422, an unknown target 404, nothing is written", async () => {
    const id = await s.uploads_issued();
    const f = one(await get_report(id), "nonexistent_code");
    const before = [await choice_rows(id), await s.count("audit_event")];
    const bad = await s.choose(id, { target_id: f.finding_id, kind: "edit_fix", value: "ZZ.9.9" });
    expect(bad.status).toBe(422);
    expect(body(bad).error.code).toBe("INVALID_CHOICE");
    expect(body(bad).error.details.reason).toBe("unknown_standard_code");
    const unknown = await s.choose(id, { target_id: "F-nope", kind: "confirm_fix" });
    expect(unknown.status).toBe(404);
    expect(body(unknown).error.code).toBe("NOT_FOUND");
    const missing = await s.choose("G9.U9.ov9", { target_id: f.finding_id, kind: "confirm_fix" });
    expect(missing.status).toBe(404);
    const stray = await s.choose(id, { target_id: f.finding_id, kind: "confirm_fix", extra: 1 });
    expect(stray.status).toBe(400);
    expect([await choice_rows(id), await s.count("audit_event")]).toEqual(before);
  });

  it("late_unit_change_refused_choices_apply_next_run: a unit change after a run is 409; other choices still save", async () => {
    const id = await s.uploads_issued();
    const r = await get_report(id);
    await s.query(
      `insert into run (id, unit_id, outline_version_id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by)
       values ($1,'G6.U4',$2,'full','complete','{}','pv_1','[{"k":1}]',$3,1,$4,'usr_synthetic_author')`,
      [`run_late_${id}`, id, "e".repeat(64), `late-${id}`],
    );
    const unit = (await stored_errors(id)).find((f) => f.kind === "unit_conflict")!;
    const refused = await s.choose(id, { target_id: unit.finding_id, kind: "confirm_unit", value: "G6.U9" });
    expect(refused.status).toBe(409);
    expect(body(refused).error.code).toBe("INVALID_TRANSITION");
    expect((await s.choose(id, { target_id: unit.finding_id, kind: "confirm_unit", value: "G6.U4" })).status).toBe(200);
    expect((await s.choose(id, confirm_body(one(r, "malformed_code")))).status).toBe(200);
    const run = (await s.query("select choices_hash, choices_json from run where id=$1", [`run_late_${id}`]))[0];
    expect(run.choices_hash).toBe("e".repeat(64));
    expect(run.choices_json).toEqual([{ k: 1 }]);
  });

  it("foreign_origin_refused: a foreign Origin is refused and writes nothing", async () => {
    const id = await s.uploads_issued();
    const f = one(await get_report(id), "malformed_code");
    const before = [await choice_rows(id), await s.count("audit_event")];
    const res = await s.choose(id, confirm_body(f), "valid-token", { origin: "https://evil.example.test" });
    expect(res.status).toBe(401);
    expect(body(res).error.code).toBe("UNAUTHENTICATED");
    expect([await choice_rows(id), await s.count("audit_event")]).toEqual(before);
  });

  it("test_intake_confirm_capture: a confirm and a revert are stored and audited by name and id; a refusal leaves no trace but a log line", async () => {
    const id = await s.uploads_issued();
    const r = await get_report(id);
    const err = one(r, "malformed_code");
    const warn = one(r, "parent_code");
    expect((await s.choose(id, confirm_body(err), "valid-token", {}, "req_cap_1")).status).toBe(200);
    expect((await s.choose(id, { target_id: warn.finding_id, kind: "revert" }, "valid-token", {}, "req_cap_2")).status).toBe(200);
    const stored = await s.query("select finding_id, status, confirmed_by from intake_choice where outline_version_id=$1 order by status", [id]);
    expect(stored).toHaveLength(2);
    expect(stored.map((x) => x.status)).toEqual(["confirmed", "default"]);
    const audits = await s.query("select actor_id, request_id, details_json from audit_event where action='outline.choice' and target_id=$1 order by at, id", [id]);
    const first = audits.find((a) => a.request_id === "req_cap_1");
    expect(first).toMatchObject({ actor_id: "usr_synthetic_author" });
    expect(first.details_json).toMatchObject({ status: "confirmed", kind: "confirm_fix", target_id: err.finding_id });

    const rows_before = [await choice_rows(id), await audit_rows()];
    const refused = await s.choose(id, { target_id: err.finding_id, kind: "edit_fix", value: "ZZ.9.9" }, "valid-token", {}, "req_cap_3");
    expect(refused.status).toBe(422);
    expect([await choice_rows(id), await audit_rows()]).toEqual(rows_before);
    const lines = s.all_log_text().split("\n").filter((l) => l.includes("req_cap_3") && l.includes("route.refused"));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("INVALID_CHOICE");

    const dump = JSON.stringify([
      await s.query("select * from intake_choice where outline_version_id=$1", [id]),
      await s.query("select * from audit_event where action='outline.choice'"),
    ]);
    expect(dump).not.toContain("password_hash");
    expect(dump).not.toContain("valid-token");
  });
});
