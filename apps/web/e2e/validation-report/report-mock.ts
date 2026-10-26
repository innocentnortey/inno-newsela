// Test double of the server for SCR-4 (GET units, GET report, POST choices). Never imported from src/.
import type { Page, Route } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { errorStatus, type ErrorCode } from "../../src/test-utils/operations";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import { CHEN, CONFIRMED_AT, issuedShapeReport, unitsFixture, type Report, type Row, type UnitList } from "./fixtures";

type ChoiceRequest = components["schemas"]["IntakeChoiceRequest"];

export interface ReportMock {
  report(): Report;
  setReport(r: Report): void;
  failNext(code: ErrorCode, message?: string): void;
  choiceCalls: ChoiceRequest[];
}

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id", "x-request-id": "req-test" };

function recount(r: Report) {
  const errs = r.rows.flatMap((x) => x.findings).filter((f) => f.level === "error");
  r.counts.errors_unconfirmed = errs.filter((f) => f.choice.source !== "confirmed").length;
  r.generate_allowed = r.counts.errors_unconfirmed === 0;
}

function apply(r: Report, req: ChoiceRequest): Row | { error: string } | null {
  const revert = req.kind === "revert";
  for (const row of r.rows) {
    const f = row.findings.find((x) => x.finding_id === req.target_id);
    if (f) {
      if (req.kind === "edit_fix" && String(req.value).includes(".a")) {
        return { error: `"${String(req.value)}" is not a California standard. Use a code from the standards list, e.g. RL.6.9.` };
      }
      if (req.kind === "confirm_unit" && req.value != null && !/^G\d{1,2}\.U\d{1,2}$/.test(String(req.value))) {
        return { error: "That is not a unit id such as G6.U4." };
      }
      f.choice = revert ? { value: null, source: "default", by: null, at: null } : { value: (req.value as string | null) ?? null, source: "confirmed", by: CHEN, at: CONFIRMED_AT };
      return row;
    }
    const s = row.segments.find((x) => x.segment_id === req.target_id);
    if (s) {
      if (revert) Object.assign(s, { action: "apply", source: "default", by: null });
      else Object.assign(s, { action: req.value as "apply", source: "confirmed", by: CHEN });
      return row;
    }
  }
  const owners = r.rows.filter((row) => row.eld.some((e) => e.code === req.target_id));
  if (owners.length === 0) return null;
  for (const row of owners) for (const e of row.eld) if (e.code === req.target_id) e.choice = req.kind === "eld_remap" ? "remap" : "keep";
  return owners[0] ?? null;
}

export async function installReportMock(
  page: Page,
  opts: { report?: Report; units?: UnitList; delayMs?: number } = {},
): Promise<ReportMock> {
  let current = structuredClone(opts.report ?? issuedShapeReport());
  const units = opts.units ?? unitsFixture(1);
  let fail: { code: ErrorCode; message?: string } | null = null;
  const choiceCalls: ChoiceRequest[] = [];
  const fulfill = (route: Route, status: number, body: unknown) => route.fulfill({ status, headers: HEADERS, body: JSON.stringify(body) });
  const isApi = (route: Route) => ["fetch", "xhr"].includes(route.request().resourceType());

  await page.route(apiGlob("/units"), (route) => {
    if (!isApi(route) || route.request().method() !== "GET") return route.fallback();
    return fulfill(route, 200, units);
  });
  await page.route(apiGlob("/outline-versions/*/report"), async (route) => {
    if (!isApi(route) || route.request().method() !== "GET") return route.fallback();
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    return fulfill(route, 200, current);
  });
  await page.route(apiGlob("/outline-versions/*/choices"), (route) => {
    if (!isApi(route) || route.request().method() !== "POST") return route.fallback();
    const req = route.request().postDataJSON() as ChoiceRequest;
    choiceCalls.push(req);
    if (fail) {
      const f = fail;
      fail = null;
      return fulfill(route, errorStatus(f.code), { error: { code: f.code, message: f.message ?? "Test message for " + f.code, details: {} } });
    }
    const next = structuredClone(current);
    const hit = apply(next, req);
    if (hit === null) return fulfill(route, 404, { error: { code: "NOT_FOUND", message: "No such target", details: {} } });
    if ("error" in hit) return fulfill(route, errorStatus("INVALID_CHOICE"), { error: { code: "INVALID_CHOICE", message: hit.error, details: {} } });
    recount(next);
    current = next;
    return fulfill(route, 200, { row: hit, counts: next.counts, generate_allowed: next.generate_allowed });
  });

  return {
    report: () => current,
    setReport: (r) => {
      current = structuredClone(r);
    },
    failNext: (code, message) => {
      fail = { code, message };
    },
    choiceCalls,
  };
}
