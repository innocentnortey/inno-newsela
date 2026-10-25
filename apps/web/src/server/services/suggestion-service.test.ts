// NL-50 implementer tests (AC-1, AC-4, AC-5, AC-6, D-6, D-7, D-10).
import { describe, expect, it } from "vitest";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import {
  AI_ACCEPT_ACTION,
  flatten_text,
  section_name_for,
} from "./suggestion-service.ts";
import {
  ack,
  build_service,
  HASH,
  LID,
  make_lesson,
  MIN,
  NOTE,
  REVIEWER_USER,
  req_body,
  SECTION,
  SELECTION,
  SUG_A,
  T0,
} from "./suggestion-service.fixtures.ts";

const refused = (p: Promise<unknown>, code: string) =>
  expect(p).rejects.toMatchObject({ name: "DomainRefusal", code });

describe("request", () => {
  it("request_stores_pending", async () => {
    const t = build_service();
    const res = await t.service.request(REVIEWER_USER, LID, req_body());
    expect(t.paid.calls).toHaveLength(1);
    const call = t.paid.calls[0]!;
    expect(call.ctx).toMatchObject({ purpose: "assist", run_id: null, lesson_id: LID });
    expect(call.req).toMatchObject({
      alias: "ASSIST",
      timeout_ms: 20000,
      output_schema_name: "AssistRewrite",
    });
    expect(call.run_id).toBeNull();
    expect(call.user_id).toBe(REVIEWER_USER.user_id);
    expect(t.repo.rows).toHaveLength(1);
    const row = t.repo.rows[0]!;
    expect(row.status).toBe("pending");
    expect(row.expires_at.getTime()).toBe(T0.getTime() + 30 * MIN);
    expect(row.model_call_id).toBe("mc_" + "1".repeat(26));
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]).toMatchObject({
      action: "suggestion.request",
      target_id: row.suggestion_id,
    });
    expect(res.status).toBe("pending");
    expect(res.suggestion_id).toBe(row.suggestion_id);
    expect(NOTE.length).toBeGreaterThan(0);
  });

  it("section_name_resolution", async () => {
    const t = build_service();
    await t.service.request(REVIEWER_USER, LID, req_body());
    const blocks = (t.paid.calls[0]!.rendered as { user_blocks: Array<{ text: string }> }).user_blocks;
    expect(blocks.find((b) => b.text.includes("kind=section_name"))!.text).toContain(SECTION);

    const lesson = make_lesson();
    expect(section_name_for(lesson, "no such text anywhere")).toBe("Lesson");
    // whitespace differs and the selection spans two paragraphs
    lesson.sections[1]!.content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First  line" }] },
        { type: "paragraph", content: [{ type: "text", text: "second\nline" }] },
      ],
    } as never;
    expect(flatten_text(lesson.sections[1]!.content)).toBe("First line second line");
    expect(section_name_for(lesson, "line   second")).toBe(SECTION);

    // no derived row -> "Lesson"
    const t2 = build_service();
    (t2.service as unknown as { reader: unknown }).reader = { latest_derived: async () => null };
    await t2.service.request(REVIEWER_USER, LID, req_body());
    const b2 = (t2.paid.calls[0]!.rendered as { user_blocks: Array<{ text: string }> }).user_blocks;
    expect(b2.find((b) => b.text.includes("kind=section_name"))!.text).toContain("Lesson");
    expect(SELECTION.length).toBeGreaterThan(0);
  });
});

describe("decide", () => {
  it("accept_via_collab_tagged", async () => {
    const t = build_service();
    const row = t.repo.seed();
    const res = await t.service.decide(REVIEWER_USER, LID, row.suggestion_id, { decision: "accept" });
    expect(t.collab.calls).toHaveLength(1);
    const cmd = t.collab.calls[0]!;
    expect(cmd.tag).toBe("ai-assist");
    expect(cmd.actor.user_id).toBe(REVIEWER_USER.user_id);
    expect(cmd.actor.name).toBe(REVIEWER_USER.name);
    expect(cmd.edit).toMatchObject({
      kind: "suggestion_accept",
      replacement_text: row.suggested_text,
      expected_text: row.selected_text,
    });
    expect(t.repo.status_of(SUG_A)).toBe("accepted");
    expect(t.repo.rows[0]!.decided_by).toBe(REVIEWER_USER.user_id);
    expect(t.audit.events).toHaveLength(1);
    expect(t.audit.events[0]).toMatchObject({ action: AI_ACCEPT_ACTION, version_hash: ack().content_hash });
    expect(AI_ACCEPT_ACTION).toBe("suggestion.accept");
    expect(res.content_hash).toBe(HASH);
    expect(res.status).toBe("accepted");
  });

  it("decide_refusals_and_reject", async () => {
    // collab unavailable: stays pending, no audit
    {
      const t = build_service();
      t.repo.seed();
      t.collab.behave = async () => {
        throw new CollabUnavailable({ lesson_id: LID, command: "apply_edit" });
      };
      await refused(
        t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "accept" }),
        "COLLAB_UNAVAILABLE",
      );
      expect(t.repo.status_of(SUG_A)).toBe("pending");
      expect(t.audit.events).toHaveLength(0);
    }
    // not pending: no collab call
    for (const status of ["accepted", "rejected", "closed"] as const) {
      const t = build_service();
      t.repo.seed({ status });
      await refused(
        t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "accept" }),
        "INVALID_TRANSITION",
      );
      expect(t.collab.calls).toHaveLength(0);
    }
    {
      const t = build_service();
      t.repo.seed();
      t.clock.advance(31 * MIN);
      await refused(
        t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "accept" }),
        "INVALID_TRANSITION",
      );
      expect(t.collab.calls).toHaveLength(0);
    }
    // reject
    {
      const t = build_service();
      t.repo.seed();
      const res = await t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "reject" });
      expect(res.status).toBe("rejected");
      expect(t.collab.calls).toHaveLength(0);
      expect(t.audit.events.map((e) => e.action)).toEqual(["suggestion.reject"]);
    }
  });

  it("anchor_changed_closes_without_audit", async () => {
    const t = build_service();
    t.repo.seed();
    t.collab.behave = async () => {
      throw new DomainRefusal("ANCHOR_CHANGED", "x");
    };
    await refused(t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "accept" }), "ANCHOR_CHANGED");
    expect(t.repo.status_of(SUG_A)).toBe("closed");
    expect(t.audit.events).toHaveLength(0);
  });

  it("lesson_locked_on_accept_stays_pending", async () => {
    const t = build_service();
    t.repo.seed();
    t.collab.behave = async () => {
      throw new DomainRefusal("LESSON_LOCKED", "locked");
    };
    await refused(t.service.decide(REVIEWER_USER, LID, SUG_A, { decision: "accept" }), "LESSON_LOCKED");
    expect(t.repo.status_of(SUG_A)).toBe("pending");
    expect(t.audit.events).toHaveLength(0);
  });
});

describe("list", () => {
  it("list_excludes_expired", async () => {
    const t = build_service();
    t.repo.seed();
    t.repo.seed({ suggestion_id: ("sug_" + "A".repeat(26)) as never });
    t.clock.advance(29 * MIN);
    expect((await t.service.list_pending(REVIEWER_USER, LID)).suggestions).toHaveLength(2);
    t.clock.advance(2 * MIN);
    expect((await t.service.list_pending(REVIEWER_USER, LID)).suggestions).toHaveLength(0);
    expect((await t.repo.get(SUG_A))!.status).toBe("closed");
  });
});
