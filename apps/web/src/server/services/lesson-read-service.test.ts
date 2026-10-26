import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import {
  H1, H2, LID, OFFICIAL, SV, V_CAND, V_GEN, V_SUB, XSS, crock, flag, issue, link, lesson_row, make_lesson,
  make_service, make_world, prov, user, version_row,
} from "./lesson-read-fixtures.ts";

describe("LessonReadService", () => {
  it("get_wp1_in_review: derived row for an in_review lesson", async () => {
    const w = make_world();
    const { lesson, version_id } = await make_service(w).get_lesson_traced(user("reviewer"), LID);
    expect(lesson.lesson_key).toBe("L4");
    expect(lesson.unit_id).toBe("G6.U4");
    expect(lesson.state).toBe("in_review");
    expect(lesson.sections.map((s) => s.address)).toContain("G6.U4.L4.LearningInAction.PartA");
    expect(lesson.sections).toHaveLength(5);
    const l6 = lesson.front_matter.standards.find((s) => s.code === "L.6.4.b");
    expect(l6).toMatchObject({ origin: "narrowed", asserted_by: "generator", confirmation: "open", official_text: OFFICIAL });
    expect(lesson.snapshot).toBeNull();
    expect(lesson.content_hash).toBe(H1);
    expect(lesson.version_number).toBe(1);
    expect(version_id).toBe(V_GEN);
    expect(lesson.checklist).toEqual([]);
    expect(w.writes).toBe(0);
  });

  it("frozen_reads_snapshot: a submitted lesson ignores a divergent derived row", async () => {
    const snap = version_row({
      version_id: V_SUB, number: 3, kind: "submit", content_hash: H2, created_by: crock("usr", "4"),
      lesson: make_lesson({ title: "Snapshot" }),
    });
    const w = make_world({
      row: lesson_row({ state: "submitted", current_version_id: V_SUB }),
      snapshot: snap,
      derived: { lesson: make_lesson({ title: "Live" }), content_hash: "d".repeat(64), state_vector: SV, schema_version: 1 },
    });
    const { lesson } = await make_service(w).get_lesson_traced(user("approver"), LID);
    expect(lesson.content_hash).toBe(H2);
    expect(lesson.snapshot).toEqual({ version_id: V_SUB, content_hash: H2, state_vector: SV });
    expect(lesson.version_number).toBe(3);
    expect(lesson.allowed_actions).toEqual(["approve", "request_changes"]);
  });

  it("schema_unknown_service: unknown version and unknown node refuse without content", async () => {
    const bad_version = make_world({
      derived: { lesson: make_lesson({ schema_version: 99 }), content_hash: H1, state_vector: SV, schema_version: 99 },
    });
    const err1 = await make_service(bad_version).get_lesson(user("reviewer"), LID).catch((e: unknown) => e);
    expect(err1).toBeInstanceOf(DomainRefusal);
    expect((err1 as DomainRefusal).code).toBe("SCHEMA_UNKNOWN");
    expect((err1 as DomainRefusal).details).toMatchObject({ lesson_id: LID, schema_version: 99 });

    const lesson = make_lesson();
    (lesson.sections[0] as { content: unknown }).content = { type: "doc", content: [{ type: "blink", content: [{ type: "text", text: "SECRET-TEXT" }] }] };
    const bad_node = make_world({ derived: { lesson, content_hash: H1, state_vector: SV, schema_version: 1 } });
    const err2 = await make_service(bad_node).get_lesson(user("reviewer"), LID).catch((e: unknown) => e);
    expect((err2 as DomainRefusal).code).toBe("SCHEMA_UNKNOWN");
    expect((err2 as DomainRefusal).details).toMatchObject({ unknown_nodes: ["blink"] });
    expect(JSON.stringify((err2 as DomainRefusal).details)).not.toContain("SECRET-TEXT");
  });

  it("open_does_not_start_review: only a reviewer on a draft gets start_review, state unchanged", async () => {
    const w = make_world({ row: lesson_row({ state: "draft", current_version_id: null }) });
    const svc = make_service(w);
    expect((await svc.get_lesson(user("reviewer"), LID)).allowed_actions).toEqual(["start_review"]);
    expect((await svc.get_lesson(user("author"), LID)).allowed_actions).toEqual([]);
    expect((await svc.get_lesson(user("approver"), LID)).allowed_actions).toEqual([]);
    expect(w.row?.state).toBe("draft");
    expect(w.writes).toBe(0);
  });

  it("checklist_statuses: four transitions", async () => {
    const w = make_world({
      row: lesson_row({ state: "submitted", current_version_id: V_SUB }),
      snapshot: version_row({ version_id: V_SUB, number: 2, kind: "submit" }),
      flags: [flag("sf-1")],
    });
    const svc = make_service(w);
    const get = async () => (await svc.get_lesson(user("approver"), LID)).checklist;
    const by_key = (c: Awaited<ReturnType<typeof get>>, k: string) => c.find((i) => i.key === k);

    let c = await get();
    expect(by_key(c, "content_safety")).toMatchObject({ status: "open", evidence_refs: ["sf-1"] });
    expect(by_key(c, "standards")).toMatchObject({ status: "open", evidence_refs: ["L.6.4.b"] });
    expect(c.length).toBeGreaterThanOrEqual(4);

    w.flags = [];
    c = await get();
    expect(by_key(c, "content_safety")?.status).toBe("ok");

    w.links = [link({ confirmed_by: crock("usr", "4") })];
    c = await get();
    expect(by_key(c, "standards")?.status).toBe("ok");

    w.issues = [issue({ kind: "rights_to_clear" })];
    c = await get();
    expect(by_key(c, "quotes_and_rights")).toMatchObject({ status: "open", evidence_refs: [crock("iss", "6")] });
    expect(w.writes).toBe(0);
  });

  it("dependency_status_mapping: source state and slot decide the status", async () => {
    const base = { direction: "waits_on" as const, lesson_id: "G6.U4.L2", slot_id: "s1", source_approved_hash: null };
    const w = make_world({
      deps: [
        { ...base, source_state: "reopened", slot_filled: true },
        { ...base, source_state: "approved", slot_filled: true },
        { ...base, source_state: "draft", slot_filled: true },
        { ...base, source_state: "draft", slot_filled: false },
      ],
    });
    const { dependencies } = await make_service(w).get_lesson(user("reviewer"), LID);
    expect(dependencies.map((d) => d.status)).toEqual([
      "source_reopened", "source_approved", "waiting_for_source_approval", "slot_empty",
    ]);
  });

  it("outline_segments_verbatim: outline text is returned as a plain string", async () => {
    const w = make_world({ outline_segments: [{ kind: "content", text: XSS, instruction_shaped: false, applies: "apply" }] });
    const { outline_row } = await make_service(w).get_lesson(user("reviewer"), LID);
    expect(outline_row.row_number).toBe(8);
    expect(outline_row.segments[0]?.text).toBe(XSS);
  });

  it("history_provenance: three version kinds, ascending audit, accepted AI spans only", async () => {
    const gen = version_row();
    const cand = version_row({
      version_id: V_CAND, number: 2, kind: "candidate", adopted: true, created_by: crock("usr", "4"),
      provenance: prov({ model: "model-y", run_id: crock("run", "6"), cost_usd: new Decimal("1.5") }),
    });
    const sub = version_row({
      version_id: V_SUB, number: 3, kind: "submit", created_by: crock("usr", "4"),
      provenance: prov({ model: null, parameters: null, example_set_id: null, run_id: null, prompt_version_id: null, derived_from_version_id: V_GEN }),
    });
    const t = (m: number) => new Date(Date.UTC(2026, 9, 2, 10, m));
    const h = (m: number, action: string, who: string | null) => ({
      at: t(m), source: "audit_event" as const, actor_name: who, action, from_state: null, to_state: null, version_hash: null, reason: null,
    });
    const w = make_world({
      versions: [sub, cand, gen],
      history: [h(5, "suggestion.accept", "Rae"), h(1, "lesson.store", null), h(3, "suggestion.reject", "Rae")],
    });
    const out = await make_service(w).history(user("reviewer"), LID);
    expect(out.versions.map((v) => v.kind)).toEqual(["generated", "candidate", "submit"]);
    const [g, c, s] = out.versions;
    expect(g?.provenance).toMatchObject({ model: "model-x", cost_usd: 0.42 });
    expect(g?.adopted).toBeNull();
    expect(c).toMatchObject({ adopted: true, provenance: { model: "model-y", run_id: crock("run", "6"), cost_usd: 1.5 } });
    expect(s?.provenance).toEqual({
      outline_row_hash: H1, prompt_version_id: "pr_gen", model: null, parameters: null, schema_version: 1,
      example_set_id: null, run_id: crock("run", "5"), cost_usd: 0, derived_from_version_id: V_GEN,
    });
    expect(out.audit.map((a) => a.action)).toEqual(["lesson.store", "suggestion.reject", "suggestion.accept"]);
    expect(out.audit[0]?.user).toBe("system");
    expect(out.audit[0]?.version_hash).toBe("0".repeat(64));
    expect(out.ai_spans).toEqual([{ accepted_by: "Rae", at: t(5).toISOString() }]);
    expect(w.writes).toBe(0);
  });

  it("history_not_found: unknown lesson refuses NOT_FOUND", async () => {
    const e = await make_service(make_world({ row: null })).history(user("reviewer"), LID).catch((x: unknown) => x);
    expect((e as DomainRefusal).code).toBe("NOT_FOUND");
  });

  it("reviewer and last_editor are names not user ids", async () => {
    const w = make_world({ row: lesson_row({ reviewer_id: "usr_01X" as never, last_editor_id: "usr_01X" as never, reviewer_name: "J. Rivera", last_editor_name: "J. Rivera" }) });
    const { lesson } = await make_service(w).get_lesson_traced(user("reviewer"), LID);
    expect(lesson.reviewer).toBe("J. Rivera");
    expect(lesson.last_editor).toBe("J. Rivera");
    expect(JSON.stringify(lesson)).not.toContain("usr_");
  });

  const sent_back = (reason_tag: string | null) => {
    const w = make_world({
      row: lesson_row({ state: "changes_requested" }),
      history: [{
        at: new Date(Date.UTC(2026, 9, 2, 10, 5)), source: "review_event", actor_name: "Rae", action: "lesson.transition",
        from_state: "submitted", to_state: "changes_requested", version_hash: null, reason: null,
        reason_tag, note: "Check the safety note before resubmitting.",
      }],
    });
    return make_service(w).get_lesson(user("reviewer"), LID);
  };

  it("send_back carries the stored tag and note", async () => {
    const l = await sent_back("content_safety");
    expect(l.send_back).toMatchObject({ tag: "content_safety", note: "Check the safety note before resubmitting.", by: "Rae" });
  });

  it("send_back falls back to other for an unknown tag", async () => {
    expect((await sent_back("nonsense")).send_back?.tag).toBe("other");
  });
});
