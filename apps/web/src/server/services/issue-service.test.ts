// NL-45 service tests: one in-memory world behind every port, a rollback-capable TxRunner and a recording collab double.
import { describe, expect, it } from "vitest";
import { CollabUnavailable } from "@ls/core/errors";
import { NON_RESOLVABLE } from "@ls/core/checks/gates";
import { FakeClock } from "@ls/core/ports/clock";
import type { AlignmentLinkRow } from "@ls/core/ports/alignment";
import type { StandardDecisionRow } from "@ls/core/ports/audit";
import type { StoreAck, EditCommand } from "@ls/core/ports/collab-commands";
import type { CheckKind, IssueLevelName, LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import type { IssueRow } from "@ls/core/ports/issues";
import type { SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { Standard } from "@ls/schema/lesson";
import { Issue } from "@ls/schema/api/lessons";
import { IssueService, blocks_for } from "./issue-service.ts";

const id = (p: string, n: number): string => `${p}_${String(n).padStart(26, "0")}`.slice(0, 4 + 26);
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const LESSON = "G6.U4.L4";
const LESSON5 = "G6.U4.L5";
const FLAG = "sf:G6.U4.L5:39";

const mk_user = (role: RequestUser["role"], n: number): RequestUser => ({
  user_id: id("usr", n), name: `Test ${role} ${n}`, email: `${role}${n}@example.test`, role, synthetic: true, request_id: id("req", n),
});
export const reviewer = mk_user("reviewer", 1);
const reviewer2 = mk_user("reviewer", 2);
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

export function make_world(state: LessonStateName = "in_review") {
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

const code_of = async (p: Promise<unknown>): Promise<string> => {
  try { await p; return "OK"; } catch (e) { return (e as { code: string }).code; }
};

const ALL_KINDS = Issue.shape.kind.options as CheckKind[];

describe("IssueService", () => {
  it("pending_until_checked", async () => {
    const { w, service } = make_world();
    w.hash = H2; w.checked_hash = H1; w.queue_pending = true;
    w.issues = [issue("section_missing", "blocking"), issue("arc_repeat", "advisory"), issue("quote_unmatched", "blocking", { resolved_at: new Date(), resolved_by: reviewer.user_id as never, resolution_reason: "ok", cleared_by: "resolution" }), issue("judge_no", "blocking", { cleared_by: "fix" })];
    let list = await service.get_issues(author, LESSON);
    expect(list).toMatchObject({ stored_hash: H2, checked_hash: H1, pending: true, counts: { blocking: 1, confirmation: 0, advisory: 1 } });
    expect(list.issues).toHaveLength(3);
    expect(list.issues.find((i) => i.kind === "quote_unmatched")!.resolution).toMatchObject({ by: reviewer.user_id, reason: "ok" });
    w.checked_hash = H2; w.queue_pending = false;
    list = await service.get_issues(author, LESSON);
    expect(list).toMatchObject({ checked_hash: H2, pending: false });
    expect(w.writes).toEqual([]);
  });

  it("blocks_and_resolvable", async () => {
    const { w, service } = make_world();
    expect(ALL_KINDS).toHaveLength(28);
    const levels: IssueLevelName[] = ["blocking", "confirmation", "advisory"];
    w.issues = ALL_KINDS.map((k, i) => issue(k, k === "standard_confirmation" ? "confirmation" : levels[i % 3]!, k === "standard_confirmation" ? { code: "L.6.4.b" } : {}));
    const list = await service.get_issues(author, LESSON);
    for (const it of list.issues) {
      expect(it.resolvable).toBe(!NON_RESOLVABLE.has(it.kind));
      expect(it.blocks).toEqual(it.level === "advisory" ? [] : ["submit", "approve"]);
    }
    const std = list.issues.find((i) => i.kind === "standard_confirmation")!;
    expect(std).toMatchObject({ level: "confirmation", blocks: ["submit", "approve"], resolvable: false });
  });

  it("cross_lesson_blocks_by_phase", () => {
    const row = issue("cross_lesson_link", "blocking", { related_lesson_id: LESSON5 as never });
    const dep = (slot_filled: boolean, source_state: LessonStateName): DependencyState => ({ direction: "waits_on", lesson_id: LESSON5 as never, slot_id: "s", source_state, slot_filled, source_approved_hash: null });
    expect(blocks_for(row, [dep(false, "in_review")])).toEqual(["submit", "approve"]);
    expect(blocks_for(row, [dep(true, "in_review")])).toEqual(["approve"]);
    expect(blocks_for(row, [dep(true, "approved")])).toEqual(["submit", "approve"]);
    expect(blocks_for(row, [])).toEqual(["submit", "approve"]);
  });

  it("cross_overlay_reaches_the_list", async () => {
    const { w, service } = make_world();
    w.issues = [issue("cross_lesson_link", "blocking", { related_lesson_id: LESSON5 as never })];
    w.deps = [{ direction: "waits_on", lesson_id: LESSON5 as never, slot_id: "s", source_state: "in_review", slot_filled: true, source_approved_hash: null }];
    expect((await service.get_issues(author, LESSON)).issues[0]!.blocks).toEqual(["approve"]);
  });

  it("resolution_refusals_write_nothing", async () => {
    const cases: Array<[string, LessonStateName, RequestUser, "section_missing" | "standard_confirmation" | "unknown", string, string]> = [
      ["ROLE_FORBIDDEN", "in_review", author, "section_missing", "fine", "author"],
      ["ROLE_FORBIDDEN", "in_review", approver, "section_missing", "fine", "approver"],
      ["LESSON_LOCKED", "submitted", reviewer, "section_missing", "fine", "locked"],
      ["REASON_REQUIRED", "in_review", reviewer, "section_missing", "   ", "blank"],
      ["NOT_RESOLVABLE", "in_review", reviewer, "standard_confirmation", "fine", "non-resolvable"],
      ["NOT_FOUND", "in_review", reviewer, "unknown", "fine", "unknown"],
      ["ROLE_FORBIDDEN", "submitted", author, "section_missing", "", "precedence 1"],
      ["LESSON_LOCKED", "submitted", reviewer, "section_missing", "", "precedence 2"],
      ["REASON_REQUIRED", "in_review", reviewer, "standard_confirmation", "", "precedence 3"],
    ];
    for (const [expected, state, user, kind, reason, label] of cases) {
      const { w, service } = make_world(state);
      const row = issue(kind === "unknown" ? "section_missing" : kind, kind === "standard_confirmation" ? "confirmation" : "blocking");
      w.issues = [row];
      const before = JSON.stringify(w.issues);
      const target = kind === "unknown" ? id("iss", 5) : row.issue_id;
      const result = await code_of(service.record_resolution(user, LESSON, target as never, { reason }));
      expect(result, label).toBe(expected);
      expect(JSON.stringify(w.issues), label).toBe(before);
      expect(w.audit, label).toHaveLength(0);
      expect(w.writes, label).toEqual([]);
    }
    const { w, service } = make_world();
    w.issues = [issue("standard_confirmation", "confirmation")];
    await expect(service.record_resolution(reviewer, LESSON, w.issues[0]!.issue_id, { reason: "x" })).rejects.toMatchObject({ details: { kind: "standard_confirmation", use: "decideStandard" } });
  });

  it("resolution_recorded", async () => {
    const { w, service } = make_world();
    const row = issue("section_missing", "blocking");
    w.issues = [row, issue("arc_repeat", "advisory")];
    const res = await service.record_resolution(reviewer, LESSON, row.issue_id, { reason: "Checked with the coach." });
    expect(res).toMatchObject({ item_id: row.issue_id, status: "resolved", by: reviewer.name, counts: { blocking: 0, confirmation: 0, advisory: 1 } });
    expect(w.issues[0]).toMatchObject({ resolved_by: reviewer.user_id, resolution_reason: "Checked with the coach." });
    expect(w.issues[0]!.resolved_at).not.toBeNull();
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: "issue.resolve", version_hash: H1, reason: "Checked with the coach.", actor_id: reviewer.user_id, audit_id: res.audit_id });
    expect(w.hash).toBe(H1);
  });

  it("flag_clear_rules", async () => {
    const run = async (state: LessonStateName, user: RequestUser, note: string) => {
      const m = make_world(state);
      const code = await code_of(m.service.clear_safety_flag(user, LESSON5, FLAG, { note }));
      return { code, w: m.w };
    };
    const blank = await run("in_review", reviewer, "  ");
    expect(blank.code).toBe("NOTE_REQUIRED");
    expect(blank.w.flags[0]!.status).toBe("open");
    expect(blank.w.writes).toEqual([]);
    expect((await run("approved", reviewer, "ok")).code).toBe("LESSON_LOCKED");
    expect((await run("draft", reviewer, "ok")).code).toBe("LESSON_LOCKED");
    expect((await run("in_review", author, "ok")).code).toBe("ROLE_FORBIDDEN");
    expect((await run("submitted", approver, "ok")).code).toBe("OK");
    const m = make_world();
    expect(await code_of(m.service.clear_safety_flag(reviewer, LESSON5, "sf:G6.U4.L5:40", { note: "ok" }))).toBe("NOT_FOUND");
  });

  it("flag_clear_audited", async () => {
    const { w, service } = make_world("submitted");
    const res = await service.clear_safety_flag(approver, LESSON5, FLAG, { note: "Recipe is safe with adult help." });
    expect(res).toMatchObject({ item_id: FLAG, status: "cleared", by: approver.name });
    expect(w.flags[0]).toMatchObject({ status: "cleared", cleared_by: approver.user_id, note: "Recipe is safe with adult help." });
    expect(w.flags[0]!.cleared_at).not.toBeNull();
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: "safety_flag.clear", actor_id: approver.user_id, reason: "Recipe is safe with adult help.", target_id: FLAG });
    expect(w.enqueued).toEqual([{ hash: H1, store_id: expect.any(String) }]);
    expect(w.hash).toBe(H1);
    expect(w.edits).toHaveLength(0);
  });

  it("decide_standard_via_collab", async () => {
    const { w, service } = make_world();
    const before_links = structuredClone(w.links.filter((l) => l.code === "L.6.4.b"));
    const res = await service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "confirm" });
    expect(res.status).toBe("confirmed");
    expect(w.edits).toHaveLength(1);
    expect(w.edits[0]).toMatchObject({ lesson_id: LESSON, tag: "standard-decision", edit: { kind: "standard", code: "L.6.4.b", decision: "confirm", restore: null }, actor: { user_id: reviewer.user_id } });
    expect(w.links.find((l) => l.code === "L.6.4.b")!.confirmed_by).toBe(reviewer.user_id);
    expect(w.writes).toEqual(["alignment.confirm", "collab.apply_edit", "audit.standard.confirm"]);
    expect(w.audit[0]).toMatchObject({ action: "standard.confirm", version_hash: H2 });
    expect(w.audit[0]!.details).toMatchObject({ code: "L.6.4.b", decision: "confirm", undo_of: null, before_entry: STANDARD, before_links });

    // remove
    const r = make_world();
    expect((await r.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "remove" })).status).toBe("removed");
    expect(r.w.links.filter((l) => l.code === "L.6.4.b")).toHaveLength(0);

    // add
    const a = make_world();
    expect((await a.service.decide_standard(reviewer, LESSON, { code: "W.6.2", decision: "add" })).status).toBe("added");
    expect(a.w.links.find((l) => l.code === "W.6.2")).toMatchObject({ origin: "added", asserted_by: "reviewer", confirmed_by: null });
    expect(a.w.audit[0]!.details).toMatchObject({ before_entry: null, before_links: [] });

    // collab down: nothing recorded
    const f = make_world();
    const links0 = JSON.stringify(f.w.links);
    f.w.fail_next = true;
    expect(await code_of(f.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "confirm" }))).toBe("COLLAB_UNAVAILABLE");
    expect(JSON.stringify(f.w.links)).toBe(links0);
    expect(f.w.audit).toHaveLength(0);
    expect(f.w.edits).toHaveLength(1);

    // outline-origin code cannot be confirmed
    const o = make_world();
    expect(await code_of(o.service.decide_standard(reviewer, LESSON, { code: "RL.6.1", decision: "confirm" }))).toBe("INVALID_REQUEST");
    expect(o.w.edits).toHaveLength(0);
    // role and lock
    expect(await code_of(o.service.decide_standard(author, LESSON, { code: "L.6.4.b", decision: "confirm" }))).toBe("ROLE_FORBIDDEN");
    const l = make_world("approved");
    expect(await code_of(l.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "confirm" }))).toBe("LESSON_LOCKED");
  });

  it("undo_window", async () => {
    const decide = async (m: ReturnType<typeof make_world>) => {
      await m.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "confirm" });
      return m.w.audit.at(-1)!.audit_id;
    };
    // (a) +30 s restores
    const a = make_world();
    const pre_links = structuredClone(a.w.links);
    const pre_std = structuredClone(a.w.standards);
    const a_id = await decide(a);
    a.w.clock.advance(30_000);
    const res = await a.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: a_id });
    expect(res.status).toBe("undone");
    expect(a.w.links).toEqual(expect.arrayContaining(pre_links));
    expect(a.w.links).toHaveLength(pre_links.length);
    expect(a.w.edits.at(-1)!.edit).toEqual({ kind: "standard", code: "L.6.4.b", decision: "undo", restore: STANDARD });
    expect(a.w.standards).toEqual(pre_std);
    expect(a.w.audit.at(-1)).toMatchObject({ action: "standard.undo" });
    expect(a.w.audit.at(-1)!.details).toMatchObject({ undo_of: a_id });
    // (b) +61 s
    const b = make_world();
    const b_id = await decide(b);
    b.w.clock.advance(61_000);
    const edits = b.w.edits.length;
    expect(await code_of(b.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: b_id }))).toBe("UNDO_EXPIRED");
    expect(b.w.edits).toHaveLength(edits);
    // (c) a newer row exists (including a first undo)
    const c = make_world();
    const c_id = await decide(c);
    c.w.clock.advance(5_000);
    await c.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: c_id });
    expect(await code_of(c.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: c_id }))).toBe("UNDO_EXPIRED");
    // (d) another reviewer
    const d = make_world();
    const d_id = await decide(d);
    expect(await code_of(d.service.decide_standard(reviewer2, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: d_id }))).toBe("NOT_FOUND");
    expect(await code_of(d.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: null }))).toBe("INVALID_REQUEST");
    // (e) exactly 60 s
    const e = make_world();
    const e_id = await decide(e);
    e.w.clock.advance(60_000);
    expect((await e.service.decide_standard(reviewer, LESSON, { code: "L.6.4.b", decision: "undo", undo_of: e_id })).status).toBe("undone");
    // undo of an add deletes the added rows
    const f = make_world();
    await f.service.decide_standard(reviewer, LESSON, { code: "W.6.2", decision: "add" });
    f.w.clock.advance(1_000);
    await f.service.decide_standard(reviewer, LESSON, { code: "W.6.2", decision: "undo", undo_of: f.w.audit[0]!.audit_id });
    expect(f.w.links.filter((l) => l.code === "W.6.2")).toHaveLength(0);
    expect(f.w.standards.find((s) => s.code === "W.6.2")).toBeUndefined();
  });

  it("no_content_write_and_text_only", async () => {
    const { w, service } = make_world();
    const row = issue("section_missing", "blocking");
    w.issues = [row];
    const text = "<script>x</script>";
    await service.record_resolution(reviewer, LESSON, row.issue_id, { reason: text });
    await service.clear_safety_flag(reviewer, LESSON5, FLAG, { note: text });
    expect(w.hash).toBe(H1);
    expect(w.edits).toHaveLength(0);
    expect(w.writes.filter((x) => x.startsWith("collab") || x.startsWith("alignment"))).toEqual([]);
    expect(w.issues[0]!.resolution_reason).toBe(text);
    const list = await service.get_issues(author, LESSON);
    expect(list.issues[0]!.resolution!.reason).toBe(text);
  });
});
