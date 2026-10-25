// @vitest-environment node
// NL-26 frozen test (risk::security): AC-12, WF-2 test_upload_capture. Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
import { afterAll, beforeAll, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import { issued_xlsx_bytes, make_stack, type Stack } from "../../../src/server/services/testing/outline-harness.ts";

let s: Stack;
beforeAll(async () => {
  s = await make_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});

it("test_upload_capture: two identical uploads give two versions with one hash; a private link refuses and leaves one log line and no rows", async () => {
  const a = await s.upload(issued_xlsx_bytes(), "issued.xlsx", "valid-token", "req_capture_1");
  const b = await s.upload(issued_xlsx_bytes(), "issued.xlsx", "valid-token", "req_capture_2");
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);

  const versions = await s.query("select id, number, sha256 from outline_version order by number");
  expect(versions).toHaveLength(2);
  expect(versions[0].sha256).toBe(versions[1].sha256);
  expect((b.body as any).changed_lessons).toBe(0);
  const audits = await s.query("select action, target_kind, version_hash, request_id from audit_event order by at, id");
  expect(audits).toHaveLength(2);
  expect(audits.every((r) => r.action === "outline.upload" && r.target_kind === "outline_version")).toBe(true);
  expect(audits.map((r) => r.request_id)).toEqual(["req_capture_1", "req_capture_2"]);

  const counts_before = [await s.count("outline_version"), await s.count("outline_row"), await s.count("audit_event")];
  s.fetcher.next = async () => {
    throw new DomainRefusal("SHEET_NOT_PUBLIC", "This sheet is private; share it publicly or upload the file.", {});
  };
  const url = "https://docs.google.com/spreadsheets/d/privatesheetid123/edit";
  const refused = await s.import_link(url, "valid-token", "req_capture_refused");
  expect(refused.status).toBe(422);
  expect((refused.body as any).error.code).toBe("SHEET_NOT_PUBLIC");
  expect([await s.count("outline_version"), await s.count("outline_row"), await s.count("audit_event")]).toEqual(counts_before);

  const mine = s.log_lines.filter((l) => l.includes("req_capture_refused") && l.includes("route.refused"));
  expect(mine).toHaveLength(1);
  expect(mine[0]).toContain("route.refused");
  expect(mine[0]).toContain("SHEET_NOT_PUBLIC");
  for (const l of s.log_lines) {
    expect(l).not.toContain("privatesheetid123");
    expect(l).not.toContain("docs.google.com");
  }
  console.log(JSON.stringify({ versions, log_line: mine[0] }));
});
