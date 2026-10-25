// @vitest-environment node
// NL-77: getValidationReport (CON-3), AC-1 to AC-6.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build_validation_report } from "@ls/core/intake/report";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import type { ValidationReport } from "@ls/schema/api/outlines";
import { load_syn3_grid } from "../../../../../../../packages/core/tests/fixtures/outline/index.ts";
import { csv_with_snippet } from "../../../../../src/server/services/testing/outline-harness.ts";
import { make_intake_stack, type IntakeStack } from "../../../../../src/server/services/testing/intake-harness.ts";

let s: IntakeStack;
beforeAll(async () => {
  s = await make_intake_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});

const report_of = (r: { body: unknown }) => r.body as ValidationReport;
const err_of = (r: { body: unknown }) => (r.body as { error: { code: string } }).error;
const SYN3 = resolve(import.meta.dirname, "../../../../../../../packages/core/tests/fixtures/outline/syn3-clean-control-row10.csv");

describe("NL-77 getValidationReport", () => {
  it("issued_sheet_counts: the issued sheet reports the pinned counts and blocks Generate", async () => {
    const id = await s.uploads_issued();
    const res = await s.report(id);
    expect(res.status).toBe(200);
    const r = report_of(res);
    expect(r.outline_version_id).toBe(id);
    expect(r.counts).toMatchObject({
      teaching_days: 47,
      unit_conflicts: 1,
      malformed_codes: 1,
      rows_with_nonexistent_code: 3,
      bad_filenames: 2,
    });
    // The ticket says "7 ELD mismatches"; the merged report builder counts findings (one per row and code), which is 16
    // on the real normalizer output (NL-17's unit test reaches 7 only on a hand-shaped outline). See the plan's Deviations.
    expect(r.counts.eld_mismatches).toBe(16);
    expect(r.counts.errors_unconfirmed).toBe(r.counts.errors);
    expect(r.generate_allowed).toBe(false);
    expect(r.runs_from_this_version).toEqual([]);
  });

  it("wp5_clean_control: the WP-5 row is ok with no findings and the sheet equals the pure builder's numbers", async () => {
    const up = await s.upload(new Uint8Array(readFileSync(SYN3)), "syn3.csv");
    expect(up.status).toBe(201);
    const id = (up.body as { outline_version_id: string }).outline_version_id;
    const r = report_of(await s.report(id));
    const row10 = r.rows.find((x) => x.row_number === 10)!;
    expect(row10.level).toBe("ok");
    expect(row10.findings).toEqual([]);
    // SYN-3 is the whole issued sheet with row 10 cleaned, so the sheet still has its other findings.
    const pure = build_validation_report(
      { outline_version_id: id, unit_id: "G6.U4", number: 1, sha256: r.sha256, same_as_version: null, source_kind: "upload_csv", uploaded_by: "x", created_at: "2026-10-25T00:00:00.000Z", confirmed_at: null } as never,
      normalize_outline(load_syn3_grid(), load_standards_index(), 200),
      [],
    );
    expect(r.counts).toEqual(pure.counts);
    expect(r.generate_allowed).toBe(pure.generate_allowed);
  });

  it("reads_are_byte_identical_and_modelless: two reads match and write nothing", async () => {
    const id = await s.uploads_issued();
    const tables = async () => [
      Number((await s.query("select count(*)::int as n from model_call"))[0].n),
      await s.count("audit_event"),
      Number((await s.query("select count(*)::int as n from intake_choice"))[0].n),
    ];
    const before = await tables();
    const a = await s.report(id);
    const b = await s.report(id);
    expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
    expect(await tables()).toEqual(before);
    expect(before[0]).toBe(0);
  });

  it("runs_from_this_version: newest first, empty before", async () => {
    const id = await s.uploads_issued();
    expect(report_of(await s.report(id)).runs_from_this_version).toEqual([]);
    for (const [n, at] of [[1, "2026-10-25T10:00:00Z"], [2, "2026-10-25T11:00:00Z"]] as const) {
      await s.query(
        `insert into run (id, unit_id, outline_version_id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by, created_at)
         values ($1,'G6.U4',$2,'full','complete','{}','pv_1','[]',$3,1,$4,'usr_synthetic_author',$5)`,
        [`run_rep_${id}_${n}`, id, String(n).repeat(64), `rep-${id}-${n}`, at],
      );
    }
    const runs = report_of(await s.report(id)).runs_from_this_version;
    expect(runs.map((r) => r.run_id)).toEqual([`run_rep_${id}_2`, `run_rep_${id}_1`]);
    expect(runs[0]).toMatchObject({ started_at: "2026-10-25T11:00:00.000Z", choices_hash: "2".repeat(64) });
  });

  it("unknown_version_and_all_roles_read: unknown id is 404, every role reads", async () => {
    const id = await s.uploads_issued();
    const missing = await s.report("G9.U9.ov9");
    expect(missing.status).toBe(404);
    expect(err_of(missing).code).toBe("NOT_FOUND");
    for (const token of ["valid-token", "reviewer-token", "approver-token"]) expect((await s.report(id, token)).status).toBe(200);
    expect((await s.report(id, "nobody")).status).toBe(401);
  });

  it("cell_text_is_text_only: cell text stays JSON text and out of logs and headers", async () => {
    const up = await s.upload(csv_with_snippet("<script>alert(1)</script> ZQX-CELL-77"), "marker.csv");
    expect(up.status).toBe(201);
    const id = (up.body as { outline_version_id: string }).outline_version_id;
    const res = await s.report(id);
    const text = JSON.stringify(res.body);
    expect(text).toContain("ZQX-CELL-77");
    const back = JSON.parse(text) as ValidationReport;
    const seg = back.rows.flatMap((r) => r.segments).find((x) => x.text.includes("ZQX-CELL-77"))!;
    expect(seg.text).toContain("<script>alert(1)</script>");
    expect(s.all_log_text()).not.toContain("ZQX-CELL-77");
    expect(JSON.stringify(res.headers)).not.toContain("ZQX-CELL-77");
  });
});
