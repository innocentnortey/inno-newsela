import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import type { LessonId, RequestUser, UserId } from "@ls/core/ports/common";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type {
  DependencyState,
  LessonGraphRepo,
} from "@ls/core/ports/lesson-graph";
import type { LessonRow } from "@ls/core/ports/lesson-state";
import { FakeCollabCommands } from "@ls/core/testing/fake-collab-commands";
import { FakeLessonStateRepo } from "@ls/core/testing/fake-lesson-state";
import type { FillSlotRequest } from "@ls/schema/api/lessons";
import { SlotService } from "./slot-service.ts";

const user = (role: "reviewer" | "author"): RequestUser =>
  ({
    user_id: `usr_synthetic_${role}` as UserId,
    name: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    synthetic: true,
    request_id: "req_synthetic_1",
  }) as unknown as RequestUser;
const REVIEWER = user("reviewer");
const AUTHOR = user("author");
const L5 = "G6.U4.L5" as LessonId;
const L4 = "G6.U4.L4" as LessonId;
const HASH = "ab".repeat(32);

const row = (state: string, id: LessonId = L4): LessonRow =>
  ({
    lesson_id: id,
    unit_id: "G6.U4",
    number: 5,
    type: "lesson",
    title: "synthetic",
    state,
    current_version_id: null,
    reviewer_id: null,
    last_editor_id: null,
    schema_version: 1,
  }) as unknown as LessonRow;

const ack = (hash = HASH): StoreAck =>
  ({
    lesson_id: L4,
    store_id: "st_01HZSYNTHETICSTORE000001",
    seq: 1,
    content_hash: hash,
    state_vector: "AAAA",
    stored_at: new Date("2026-10-25T15:52:00Z"),
    stored_by: REVIEWER.user_id,
    check_job_enqueued: true,
  }) as unknown as StoreAck;

function graph(
  dependants: LessonId[] = [],
  deps: Record<string, DependencyState[]> = {},
) {
  const calls: string[] = [];
  const repo: LessonGraphRepo = {
    async dependants(id) {
      calls.push(`dependants:${id}`);
      return dependants;
    },
    async dependencies(id) {
      calls.push(`dependencies:${id}`);
      return deps[id] ?? [];
    },
    async source_outline_version() {
      return null;
    },
  };
  return { repo, calls };
}

function setup(state = "in_review", g = graph()) {
  const states = new FakeLessonStateRepo();
  const collab = new FakeCollabCommands();
  states.script.returns("get", row(state));
  const service = new SlotService(states, collab, CHECK_POLICY, g.repo);
  const edits = () =>
    collab.script.calls.filter((c) => c.method === "apply_edit");
  return { states, collab, service, edits, g };
}

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const req = (over: Partial<FillSlotRequest> = {}): FillSlotRequest => ({
  text: words(9),
  source_ref: { title: "The Lightning Thief", chapter: "1", pages: "1-8" },
  rights_status: "short-quote-commentary",
  ...over,
});
const code_of = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as DomainRefusal;
  }
  throw new Error("expected a refusal");
};

describe("SlotService.fill", () => {
  it("fill_wp1_part_a: one slot_fill edit, reviewer as actor, fields from the ack", async () => {
    const { collab, service, edits } = setup();
    collab.script.returns("apply_edit", ack());
    const r = req();
    const out = await service.fill(REVIEWER, L4, "slot-L4-PartA-quote", r);
    expect(edits()).toHaveLength(1);
    expect(edits()[0]!.args[0]).toEqual({
      lesson_id: L4,
      actor: {
        user_id: REVIEWER.user_id,
        name: REVIEWER.name,
        role: "reviewer",
        synthetic: true,
      },
      edit: {
        kind: "slot_fill",
        slot_id: "slot-L4-PartA-quote",
        text: r.text,
        source_ref: r.source_ref,
        rights_status: r.rights_status,
      },
      tag: "slot-fill",
      request_id: "req_synthetic_1",
    });
    expect(out).toMatchObject({
      slot_id: "slot-L4-PartA-quote",
      inserted_by: REVIEWER.name,
      inserted_at: "2026-10-25T15:52:00.000Z",
      content_hash: HASH,
      still_blocking: false,
      blocking_reason: null,
    });
  });

  it("missing_input_before_edit: no source or too long is refused with zero edits; limits are exact", async () => {
    for (const source_ref of [
      { title: "" },
      { title: "   ", chapter: "", pages: null },
    ]) {
      const s = setup();
      const e = await code_of(
        s.service.fill(REVIEWER, L4, "s", req({ source_ref })),
      );
      expect(e.code).toBe("SOURCE_REQUIRED");
      expect(s.edits()).toHaveLength(0);
    }
    const long = setup();
    const e = await code_of(
      long.service.fill(REVIEWER, L4, "s", req({ text: words(13) })),
    );
    expect(e.code).toBe("QUOTE_TOO_LONG");
    expect(long.edits()).toHaveLength(0);

    const passes: FillSlotRequest[] = [
      req({ text: words(12) }),
      req({ text: `${words(12)} - ... —` }),
      req({ text: `${words(12)} --` }),
      req({ text: words(13), rights_status: "public-domain" }),
    ];
    for (const r of passes) {
      const s = setup();
      s.collab.script.returns("apply_edit", ack());
      await s.service.fill(REVIEWER, L4, "s", r);
      expect(s.edits()).toHaveLength(1);
    }
  });

  it("to_clear_then_cleared: a to-clear insert still blocks; a public-domain re-fill clears it", async () => {
    const { collab, service, edits, states } = setup();
    states.script.returns("get", row("in_review", L5));
    collab.script.returns("apply_edit", ack());
    collab.script.returns("apply_edit", ack("cd".repeat(32)));
    const first = await service.fill(
      REVIEWER,
      L5,
      "slot-L5-PartA-excerpt",
      req({ rights_status: "to-clear" }),
    );
    expect(first.still_blocking).toBe(true);
    expect(first.blocking_reason).toBe("rights to clear");
    const second = await service.fill(
      REVIEWER,
      L5,
      "slot-L5-PartA-excerpt",
      req({
        rights_status: "public-domain",
        text: "A different invented line.",
      }),
    );
    expect(second.still_blocking).toBe(false);
    expect(second.blocking_reason).toBeNull();
    expect(edits()).toHaveLength(2);
    expect(
      (edits()[1]!.args[0] as { edit: { rights_status: string } }).edit
        .rights_status,
    ).toBe("public-domain");
  });

  it("precedence_and_collab_refusals: role, lesson, state, then collab outcomes; no graph reads on refusal", async () => {
    expect(SlotService.length).toBe(4); // no AuditLog or Tx: the collab server writes the audit event (WF-12)

    const a = setup();
    expect((await code_of(a.service.fill(AUTHOR, L4, "s", req()))).code).toBe(
      "ROLE_FORBIDDEN",
    );
    expect(a.states.script.calls).toHaveLength(0);

    const missing = new FakeLessonStateRepo();
    missing.script.returns("get", null);
    const g = graph();
    const svc = new SlotService(
      missing,
      new FakeCollabCommands(),
      CHECK_POLICY,
      g.repo,
    );
    expect((await code_of(svc.fill(REVIEWER, L4, "s", req()))).code).toBe(
      "NOT_FOUND",
    );

    for (const state of ["submitted", "approved", "exported"]) {
      const s = setup(state);
      const e = await code_of(
        s.service.fill(REVIEWER, L4, "s", req({ source_ref: { title: "" } })),
      );
      expect(e.code).toBe("LESSON_LOCKED");
      expect(s.edits()).toHaveLength(0);
    }

    const outcomes: [Error, string][] = [
      [new DomainRefusal("NOT_FOUND", "gone"), "NOT_FOUND"],
      [
        new CollabUnavailable({ lesson_id: L4, command: "apply_edit" }),
        "COLLAB_UNAVAILABLE",
      ],
      [new DomainRefusal("LESSON_LOCKED", "locked"), "LESSON_LOCKED"],
    ];
    for (const [err, expected] of outcomes) {
      const s = setup();
      s.collab.script.throws("apply_edit", err);
      expect(
        (await code_of(s.service.fill(REVIEWER, L4, "s", req()))).code,
      ).toBe(expected);
      expect(s.g.calls).toEqual([]);
    }
    expect(g.calls).toEqual([]);
  });

  it("plain_text_and_length: text goes on verbatim; 10,001 chars and blank text are refused", async () => {
    const s = setup();
    s.collab.script.returns("apply_edit", ack());
    const out = await s.service.fill(
      REVIEWER,
      L4,
      "s",
      req({ text: "<b onmouseover=x>" }),
    );
    expect(
      (s.edits()[0]!.args[0] as { edit: { text: string } }).edit.text,
    ).toBe("<b onmouseover=x>");
    expect(JSON.stringify(out)).not.toContain("<b");

    for (const text of ["a".repeat(10001), "   "]) {
      const t = setup();
      const e = await code_of(
        t.service.fill(
          REVIEWER,
          L4,
          "s",
          req({ text, rights_status: "licensed" }),
        ),
      );
      expect(e.code).toBe("INVALID_REQUEST");
      expect(e.details).toEqual({ fields: ["body.text"] });
      expect(t.edits()).toHaveLength(0);
    }
    const ok = setup();
    ok.collab.script.returns("apply_edit", ack());
    await ok.service.fill(
      REVIEWER,
      L4,
      "s",
      req({ text: "a".repeat(10000), rights_status: "licensed" }),
    );
    expect(ok.edits()).toHaveLength(1);
  });

  it("linked_lessons_wp1: dependants of this very slot are reported; others are not", async () => {
    const link = (over: Partial<DependencyState> = {}): DependencyState => ({
      direction: "waits_on",
      lesson_id: L5,
      slot_id: "slot-L5-PartA-excerpt",
      source_state: "in_review",
      slot_filled: false,
      source_approved_hash: null,
      ...over,
    });
    const run = async (g: ReturnType<typeof graph>) => {
      const s = setup("in_review", g);
      s.collab.script.returns("apply_edit", ack());
      return (
        await s.service.fill(REVIEWER, L5, "slot-L5-PartA-excerpt", req())
      ).linked_lessons;
    };
    expect(await run(graph([L4], { [L4]: [link()] }))).toEqual([
      { lesson_id: L4, status: "waiting_for_source_approval" },
    ]);
    expect(
      await run(
        graph([L4], {
          [L4]: [
            link({
              source_state: "approved",
              source_approved_hash: HASH as never,
            }),
          ],
        }),
      ),
    ).toEqual([{ lesson_id: L4, status: "source_approved" }]);
    expect(
      await run(graph([L4], { [L4]: [link({ slot_id: "another-slot" })] })),
    ).toEqual([]);
    expect(await run(graph([]))).toEqual([]);
  });
});
