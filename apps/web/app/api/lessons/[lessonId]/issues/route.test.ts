// NL-45 route tests: real make_with_route + handlers over the in-memory world (a copy of the service test's world).
import { describe, expect, it } from "vitest";
import { CollabUnavailable } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { AlignmentLinkRow } from "@ls/core/ports/alignment";
import type { StandardDecisionRow } from "@ls/core/ports/audit";
import type { StoreAck, EditCommand } from "@ls/core/ports/collab-commands";
import type { CheckKind, IssueLevelName, LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import type { IssueRow } from "@ls/core/ports/issues";
import type { SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { Standard } from "@ls/schema/lesson";
import { IssueService } from "@/server/services/issue-service";
import { make_issue_handlers, to_http_request } from "@/server/routes/issue-routes";
import { make_with_route, type SessionResolver } from "@/server/http/with-route";
import { APP_ORIGIN, make_deps, make_request } from "@/server/http/testing/route-fixtures";

const id = (p: string, n: number): string => `${p}_${String(n).padStart(26, "0")}`.slice(0, 4 + 26);
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const LESSON = "G6.U4.L4";
const LESSON5 = "G6.U4.L5";
const FLAG = "sf:G6.U4.L5:39";

const mk_user = (role: RequestUser["role"], n: number): RequestUser => ({
  user_id: id("usr", n), name: `Test ${role} ${n}`, email: `${role}${n}@example.test`, role, synthetic: true, request_id: id("req", n),
});
const reviewer = mk_user("reviewer", 1);
const approver = mk_user("approver", 3);
const author = mk_user("author", 4);

const STANDARD: Standard = {
  code: "L.6.4.b", role: "focus", origin: "narrowed", official_text: "Use Greek or Latin roots as clues.",
  asserted_by: "generator", confirmation: "open",
};
const OUTLINE_STD: Standard = { code: "RL.6.1", role: "focus", origin: "outline", official_text: "Cite textual evidence.", asserted_by: "outline", confirmation: "open" };
const link = (code: string, over: Partial<AlignmentLinkRow> = {}): AlignmentLinkRow => ({
  lesson_id: LESSON, content_hash: H1, code, address: `${LESSON}.s1`, role: "A", origin: "narrowed", asserted_by: "generator", confirmed_by: null, ...over,
});
let issue_n = 100;
const issue = (kind: CheckKind, level: IssueLevelName, over: Partial<IssueRow> = {}): IssueRow => ({
  issue_id: id("iss", ++issue_n), lesson_id: LESSON, content_hash: H1, level, kind, message: `finding ${kind}`, address: "s1", span_anchor: null,
  related_lesson_id: null, code: null, resolved_by: null, resolution_reason: null, resolved_at: null, cleared_by: null, created_at: new Date("2026-01-01T00:00:00Z"), ...over,
});

interface AuditEvt { audit_id: string; actor_id: string | null; action: string; target_id: string; version_hash: string | null; reason: string | null; details: Record<string, unknown>; at: Date }

function make_world(state: LessonStateName = "in_review") {
  const clock = new FakeClock();
  const w = {
    clock,
    state,
    hash: H1,
    standards: [structuredClone(OUTLINE_STD), structuredClone(STANDARD)] as Standard[],
    issues: [] as IssueRow[],
    checked_hash: H1 as string | null,
    queue_pending: false,
    enqueued: [] as Array<{ hash: string; store_id: string }>,
    flags: [{ flag_id: FLAG, lesson_id: LESSON5, source_row: 39, teacher_tip_address: null, status: "open", cleared_by: null, note: null, cleared_at: null }] as SafetyFlagRow[],
    links: [link("L.6.4.b"), link("RL.6.1", { origin: "outline", asserted_by: "outline" })] as AlignmentLinkRow[],
    audit: [] as AuditEvt[],
    deps: [] as DependencyState[],
    edits: [] as EditCommand[],
    writes: [] as string[],
    fail_next: false,
    store_seq: 0,
    n: 0,
  };
  const next = (p: string): string => id(p, 900 + ++w.n);
  const snapshot = (): string => JSON.stringify({ i: w.issues, f: w.flags, l: w.links, a: w.audit, q: w.enqueued });
  const restore_snap = (s: string): void => {
    const o = JSON.parse(s, (k, v: unknown) => (k.endsWith("_at") || k === "at") && typeof v === "string" ? new Date(v) : v) as { i: IssueRow[]; f: SafetyFlagRow[]; l: AlignmentLinkRow[]; a: AuditEvt[]; q: typeof w.enqueued };
    w.issues = o.i; w.flags = o.f; w.links = o.l; w.audit = o.a; w.enqueued = o.q;
  };
  const service = new IssueService(
    {
      current: async () => ({ lesson_id: LESSON, checked_hash: w.checked_hash as never, checked_at: w.checked_hash === null ? null : new Date("2026-01-01T00:00:00Z"), issues: w.issues.map((r) => ({ ...r })) }),
      resolve: async (r: { issue_id: string; by: string; reason: string }) => {
        w.writes.push("issue.resolve");
        const row = w.issues.find((x) => x.issue_id === r.issue_id)!;
        row.resolved_by = r.by; row.resolution_reason = r.reason; row.resolved_at = clock.now(); row.cleared_by = "resolution";
        return { ...row };
      },
    } as never,
    {
      pending_for: async () => ({ lesson_id: LESSON, pending: w.queue_pending, newest_queued_hash: null, latest_stored_hash: w.hash, latest_stored_at: new Date("2026-01-01T00:00:00Z") }),
      enqueue: async (_l: string, hash: string, store_id: string) => { w.writes.push("check.enqueue"); w.enqueued.push({ hash, store_id }); },
    } as never,
    {
      open_for: async () => w.flags.filter((f) => f.status === "open").map((f) => ({ ...f })),
      clear: async (flag_id: string, by: string, note: string) => {
        w.writes.push("flag.clear");
        const f = w.flags.find((x) => x.flag_id === flag_id)!;
        Object.assign(f, { status: "cleared", cleared_by: by, note, cleared_at: clock.now() });
        return { ...f };
      },
    } as never,
    {
      for_lesson: async () => w.links.map((l) => ({ ...l })),
      confirm: async (_l: string, code: string, by: string, decision: string) => {
        w.writes.push(`alignment.${decision}`);
        const rows = w.links.filter((l) => l.code === code);
        if (decision === "add") {
          const row = link(code, { address: LESSON, role: "P", origin: "added", asserted_by: "reviewer", confirmed_by: null });
          w.links.push(row);
          return row;
        }
        if (decision === "remove") { w.links = w.links.filter((l) => l.code !== code); return rows[0]!; }
        for (const r of rows) r.confirmed_by = by;
        return rows[0]!;
      },
      restore: async (_l: string, code: string, rows: AlignmentLinkRow[]) => {
        w.writes.push("alignment.restore");
        w.links = [...w.links.filter((l) => l.code !== code), ...rows.map((r) => ({ ...r }))];
        return rows.length;
      },
    } as never,
    { get: async () => ({ lesson_id: LESSON, unit_id: "G6.U4", state: w.state, reviewer_id: null, last_editor_id: null }) } as never,
    {
      apply_edit: async (cmd: EditCommand): Promise<StoreAck> => {
        w.edits.push(cmd);
        if (w.fail_next) { w.fail_next = false; throw new CollabUnavailable({ lesson_id: LESSON, command: "apply_edit" }); }
        w.writes.push("collab.apply_edit");
        const e = cmd.edit;
        if (e.kind === "standard") {
          const i = w.standards.findIndex((s) => s.code === e.code);
          if (e.decision === "confirm" || e.decision === "remove") w.standards[i]!.confirmation = e.decision === "confirm" ? "confirmed" : "removed";
          else if (e.decision === "add") {
            const add: Standard = { code: e.code, role: "supporting", origin: "added", official_text: "x", asserted_by: "reviewer", confirmation: "open" };
            if (i >= 0) w.standards[i] = add; else w.standards.push(add);
          } else if (e.restore === null) w.standards = w.standards.filter((s) => s.code !== e.code);
          else if (i >= 0) w.standards[i] = structuredClone(e.restore); else w.standards.push(structuredClone(e.restore));
        }
        w.hash = w.hash === H1 ? H2 : H1;
        return { lesson_id: LESSON, store_id: id("st", ++w.store_seq), seq: w.store_seq, content_hash: w.hash, state_vector: "sv", stored_at: clock.now(), stored_by: cmd.actor.user_id, check_job_enqueued: true } as never;
      },
    } as never,
    {
      append: async (e: { actor_id: string | null; action: string; target_id: string; version_hash: string | null; reason: string | null; details: Record<string, unknown> }) => {
        w.writes.push(`audit.${e.action}`);
        const audit_id = next("ae");
        w.audit.push({ audit_id, actor_id: e.actor_id, action: e.action, target_id: e.target_id, version_hash: e.version_hash, reason: e.reason, details: structuredClone(e.details), at: clock.now() });
        return audit_id;
      },
      standard_decisions: async (_l: string, code: string): Promise<StandardDecisionRow[]> =>
        w.audit
          .filter((a) => a.action.startsWith("standard.") && a.details["code"] === code)
          .map((a) => ({
            audit_id: a.audit_id, lesson_id: LESSON, code, decision: a.action.slice(9) as never, by: a.actor_id as never, at: a.at,
            before_entry: a.details["before_entry"] as Standard | null, before_links: a.details["before_links"] as AlignmentLinkRow[],
          }))
          .reverse(),
    } as never,
    {
      with_tx: async (fn: (tx: object) => Promise<unknown>) => {
        const snap = snapshot();
        const writes = w.writes.length;
        try {
          return await fn({});
        } catch (e) {
          restore_snap(snap);
          w.writes.length = writes;
          throw e;
        }
      },
    } as never,
    clock,
    { undo_window_s: 60 },
    { dependencies: async () => w.deps } as never,
    {
      latest: async () => ({ lesson_id: LESSON, content_hash: w.hash, store_id: id("st", 1) }),
      latest_derived: async () => ({ lesson_id: LESSON, content_hash: w.hash, lesson: { front_matter: { standards: structuredClone(w.standards) } } }),
    } as never,
  );
  return { w, service };
}


const USERS: Record<string, RequestUser> = { "reviewer-token": reviewer, "approver-token": approver, "author-token": author };
const resolver: SessionResolver = {
  require: async (token, request_id) => {
    const u = token === null ? undefined : USERS[token];
    if (u === undefined) throw Object.assign(new Error("Sign in again."), { name: "DomainRefusal", code: "UNAUTHENTICATED" });
    return { ...u, request_id };
  },
};

function harness(state: LessonStateName = "in_review") {
  const m = make_world(state);
  const { deps, lines } = make_deps({ sessions: () => resolver });
  const h = make_issue_handlers({ with_route: make_with_route(deps), issues: () => m.service, logger: deps.logger });
  const call = (handler: keyof typeof h, token: string | null, params: Record<string, string>, body: unknown = null, over: { origin?: string | null } = {}) =>
    h[handler](make_request({ method: handler === "get_issues" ? "GET" : "POST", token, path_params: params, body: body as never, ...over }));
  return { ...m, call, lines };
}
const error_code = (b: unknown): string => (b as { error: { code: string } }).error.code;

describe("issue routes", () => {
  it("test_resolution_capture", async () => {
    const t = harness();
    const row = issue("section_missing", "blocking");
    t.w.issues = [row];

    const r1 = await t.call("record_resolution", "reviewer-token", { lessonId: LESSON, issueId: row.issue_id }, { reason: "Looked at it." });
    expect(r1.status).toBe(200);
    expect(t.w.audit.map((a) => a.action)).toEqual(["issue.resolve"]);
    expect(t.w.issues[0]!.resolution_reason).toBe("Looked at it.");

    const noNote = await t.call("clear_safety_flag", "approver-token", { lessonId: LESSON5, flagId: FLAG }, { note: " " });
    expect(noNote.status).toBe(422);
    expect(error_code(noNote.body)).toBe("NOTE_REQUIRED");
    expect(t.w.flags[0]!.status).toBe("open");
    expect(t.w.audit).toHaveLength(1);

    const r2 = await t.call("clear_safety_flag", "approver-token", { lessonId: LESSON5, flagId: FLAG }, { note: "Adult supervised." });
    expect(r2.status).toBe(200);
    expect(t.w.flags[0]).toMatchObject({ status: "cleared", cleared_by: approver.user_id, note: "Adult supervised." });

    const r3 = await t.call("decide_standard", "reviewer-token", { lessonId: LESSON }, { code: "W.6.2", decision: "add" });
    expect(r3.status).toBe(200);
    expect(t.w.audit.map((a) => a.action)).toEqual(["issue.resolve", "safety_flag.clear", "standard.add"]);
    expect(t.w.links.find((l) => l.code === "W.6.2")).toMatchObject({ asserted_by: "reviewer", origin: "added" });

    const list = await t.call("get_issues", "author-token", { lessonId: LESSON });
    expect(list.status).toBe(200);
    const reads = t.lines.map((l) => JSON.parse(l) as Record<string, unknown>).filter((l) => l["event"] === "issues.read");
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ lesson_id: LESSON });
    expect(typeof reads[0]!["duration_ms"]).toBe("number");
  });

  it("maps refusals to statuses", async () => {
    const row = issue("section_missing", "blocking");
    const std = issue("standard_confirmation", "confirmation", { code: "L.6.4.b" });
    const go = async (state: LessonStateName, token: string, issue_row: IssueRow, reason: string) => {
      const t = harness(state);
      t.w.issues = [issue_row];
      return t.call("record_resolution", token, { lessonId: LESSON, issueId: issue_row.issue_id }, { reason });
    };
    expect((await go("in_review", "author-token", row, "x")).status).toBe(403);
    const locked = await go("submitted", "reviewer-token", row, "x");
    expect([locked.status, error_code(locked.body)]).toEqual([409, "LESSON_LOCKED"]);
    const blank = await go("in_review", "reviewer-token", row, "");
    expect([blank.status, error_code(blank.body)]).toEqual([422, "REASON_REQUIRED"]);
    const nr = await go("in_review", "reviewer-token", std, "x");
    expect([nr.status, error_code(nr.body)]).toEqual([422, "NOT_RESOLVABLE"]);
  });

  it("validates params and origin", async () => {
    const t = harness();
    const bad_flag = await t.call("clear_safety_flag", "approver-token", { lessonId: LESSON5, flagId: "nope" }, { note: "x" });
    expect([bad_flag.status, error_code(bad_flag.body)]).toEqual([400, "INVALID_REQUEST"]);
    const bad_issue = await t.call("record_resolution", "reviewer-token", { lessonId: LESSON, issueId: "iss_short" }, { reason: "x" });
    expect([bad_issue.status, error_code(bad_issue.body)]).toEqual([400, "INVALID_REQUEST"]);
    const no_origin = await t.call("decide_standard", "reviewer-token", { lessonId: LESSON }, { code: "L.6.4.b", decision: "confirm" }, { origin: null });
    expect(no_origin.status).toBe(401);
    expect(t.w.audit).toHaveLength(0);
  });

  it("bridges a Next Request", async () => {
    const req = new Request(`${APP_ORIGIN}/api/x?a=1`, { method: "POST", headers: { Cookie: "ls_session=tok; z=1", Origin: APP_ORIGIN }, body: "{bad" });
    const out = await to_http_request(req, { flagId: encodeURIComponent(FLAG) });
    expect(out).toMatchObject({ path_params: { flagId: FLAG }, query: { a: "1" }, cookies: { ls_session: "tok" }, body: null });
    expect(out.headers["origin"]).toBe(APP_ORIGIN);
  });
});
