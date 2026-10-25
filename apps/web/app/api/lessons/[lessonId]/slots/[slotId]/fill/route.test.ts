import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import type { LessonId, UserId } from "@ls/core/ports/common";
import type {
  CollabCommands,
  EditCommand,
  StoreAck,
} from "@ls/core/ports/collab-commands";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonRow } from "@ls/core/ports/lesson-state";
import { FakeCollabCommands } from "@ls/core/testing/fake-collab-commands";
import { FakeLessonStateRepo } from "@ls/core/testing/fake-lesson-state";
import { make_with_route } from "@/server/http/with-route";
import { make_deps, make_request } from "@/server/http/testing/route-fixtures";
import {
  make_slot_fill_handlers,
  to_http_request,
} from "@/server/routes/slot-fill-routes";
import { SlotService } from "@/server/services/slot-service";

const L4 = "G6.U4.L4";
const SLOT = "slot-L4-PartA-quote";
const HASH = "ab".repeat(32);
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const row = (state: string): LessonRow =>
  ({
    lesson_id: L4,
    unit_id: "G6.U4",
    number: 4,
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
    stored_by: "usr_synthetic_reviewer" as UserId,
    check_job_enqueued: true,
  }) as unknown as StoreAck;
const no_graph: LessonGraphRepo = {
  dependants: async () => [],
  dependencies: async () => [],
};

const body = (over: Record<string, unknown> = {}) => ({
  text: words(9),
  source_ref: { title: "The Lightning Thief", chapter: "1", pages: "1-8" },
  rights_status: "short-quote-commentary",
  ...over,
});
const call = (
  h: ReturnType<typeof make_slot_fill_handlers>,
  over: Parameters<typeof make_request>[0] = {},
  lessonId = L4,
) =>
  h.fill_slot(
    make_request({
      token: "reviewer-token",
      path_params: { lessonId, slotId: SLOT },
      body: body() as never,
      ...over,
    }),
  );

function build(
  state = "in_review",
  collab: CollabCommands = new FakeCollabCommands(),
) {
  const states = new FakeLessonStateRepo();
  states.script.returns("get", state === "missing" ? null : row(state));
  const service = new SlotService(states, collab, CHECK_POLICY, no_graph);
  const handlers = make_slot_fill_handlers({
    with_route: make_with_route(make_deps().deps),
    slots: () => service,
  });
  return { handlers, collab };
}
const errcode = (b: unknown) =>
  (b as { error: { code: string; details: { request_id?: string } } }).error;

describe("fillSlot route", () => {
  it("route_statuses: each refusal maps to its status and error shape", async () => {
    const cases: [
      string,
      () => Promise<{ status: number; body: unknown }>,
      number,
      string,
    ][] = [];
    const reg = (
      name: string,
      f: () => Promise<{ status: number; body: unknown }>,
      s: number,
      c: string,
    ) => cases.push([name, f, s, c]);

    reg(
      "author",
      () => call(build().handlers, { token: "valid-token" }),
      403,
      "ROLE_FORBIDDEN",
    );
    reg(
      "missing lesson",
      () => call(build("missing").handlers),
      404,
      "NOT_FOUND",
    );
    reg(
      "locked",
      () => call(build("submitted").handlers),
      409,
      "LESSON_LOCKED",
    );
    reg(
      "collab not found",
      () => {
        const c = new FakeCollabCommands();
        c.script.throws("apply_edit", new DomainRefusal("NOT_FOUND", "gone"));
        return call(build("in_review", c).handlers);
      },
      404,
      "NOT_FOUND",
    );
    reg(
      "collab unavailable",
      () => {
        const c = new FakeCollabCommands();
        c.script.throws(
          "apply_edit",
          new CollabUnavailable({
            lesson_id: L4 as LessonId,
            command: "apply_edit",
          }),
        );
        return call(build("in_review", c).handlers);
      },
      503,
      "COLLAB_UNAVAILABLE",
    );
    reg(
      "no source",
      () =>
        call(build().handlers, {
          body: body({ source_ref: { title: "" } }) as never,
        }),
      422,
      "SOURCE_REQUIRED",
    );
    reg(
      "too long",
      () =>
        call(build().handlers, { body: body({ text: words(13) }) as never }),
      422,
      "QUOTE_TOO_LONG",
    );

    for (const [name, f, status, code] of cases) {
      const res = await f();
      expect([name, res.status]).toEqual([name, status]);
      const e = errcode(res.body);
      expect([name, e.code]).toEqual([name, code]);
      expect(typeof e.details.request_id).toBe("string");
    }
  });

  it("route_plain_text_and_length: markup is stored verbatim; bad bodies and ids are 400", async () => {
    const c = new FakeCollabCommands();
    c.script.returns("apply_edit", ack());
    const ok = await call(build("in_review", c).handlers, {
      body: body({ text: "<b onmouseover=x>" }) as never,
    });
    expect(ok.status).toBe(200);
    expect(
      (c.script.calls[0]!.args[0] as EditCommand & { edit: { text: string } })
        .edit.text,
    ).toBe("<b onmouseover=x>");
    expect(JSON.stringify(ok.body)).not.toContain("<");

    const bad: Record<string, unknown>[] = [
      body({ text: "a".repeat(10001) }),
      { ...body(), extra: 1 },
      { text: "x", rights_status: "licensed" },
    ];
    for (const b of bad) {
      const c2 = new FakeCollabCommands();
      const res = await call(build("in_review", c2).handlers, {
        body: b as never,
      });
      expect(res.status).toBe(400);
      expect(errcode(res.body).code).toBe("INVALID_REQUEST");
      expect(c2.script.calls).toHaveLength(0);
    }
    const res = await call(build().handlers, {}, "g6-u4");
    expect(res.status).toBe(400);
    const fields = (res.body as { error: { details: { fields: string[] } } })
      .error.details.fields;
    expect(fields).toContain("path.lessonId");
  });

  it("test_fill_slot_capture: the real route fills the slot through a storing double; a refused call writes nothing", async () => {
    // Models NL-105's collab behaviour on the quote node added to packages/editor-schema (NL-46); it is not validated against EDITOR_SCHEMA.
    type Node = {
      type: string;
      attrs: Record<string, unknown>;
      content?: unknown[];
    };
    class StoringCollab implements CollabCommands {
      doc: { type: "doc"; content: Node[] } = {
        type: "doc",
        content: [
          {
            type: "quote_placeholder",
            attrs: { slot_id: SLOT, reason: "Reviewer to insert" },
          },
        ],
      };
      writes = 0;
      async apply_edit(cmd: EditCommand): Promise<StoreAck> {
        if (cmd.edit.kind === "slot_fill") {
          const e = cmd.edit;
          const i = this.doc.content.findIndex(
            (n) => n.attrs["slot_id"] === e.slot_id,
          );
          this.doc.content[i] = {
            type: "quote",
            attrs: {
              slot_id: e.slot_id,
              source_ref: JSON.stringify(e.source_ref),
              rights: e.rights_status,
            },
            content: [{ type: "text", text: e.text }],
          };
          this.writes += 1;
        }
        return ack(
          createHash("sha256").update(JSON.stringify(this.doc)).digest("hex"),
        );
      }
      async lock_and_snapshot(): Promise<never> {
        throw new Error("unused");
      }
      async set_mode(): Promise<never> {
        throw new Error("unused");
      }
    }
    const store = new StoringCollab();
    const states = new FakeLessonStateRepo();
    states.script.returns("get", row("in_review"));
    states.script.returns("get", row("in_review"));
    const service = new SlotService(states, store, CHECK_POLICY, no_graph);
    const handlers = make_slot_fill_handlers({
      with_route: make_with_route(make_deps().deps),
      slots: () => service,
    });

    const text = words(9);
    const res = await call(handlers, { body: body({ text }) as never });
    const stored_hash = createHash("sha256")
      .update(JSON.stringify(store.doc))
      .digest("hex");
    expect(res.status).toBe(200);
    expect((res.body as { content_hash: string }).content_hash).toBe(
      stored_hash,
    );
    expect(store.writes).toBe(1);
    const q = store.doc.content[0]!;
    expect(q.type).toBe("quote");
    expect(q.attrs).toMatchObject({
      slot_id: SLOT,
      rights: "short-quote-commentary",
    });
    expect(String(q.attrs["source_ref"])).toContain("The Lightning Thief");
    expect(q.content).toEqual([{ type: "text", text }]);

    const before = structuredClone(store.doc);
    const refused = await call(handlers, {
      body: body({ source_ref: { title: "" } }) as never,
    });
    expect(refused.status).toBe(422);
    expect(errcode(refused.body).code).toBe("SOURCE_REQUIRED");
    expect(store.writes).toBe(1);
    expect(store.doc).toEqual(before);
  });

  it("to_http_request: decodes params, folds repeated query keys, reads cookies", () => {
    const r = to_http_request(
      new Request("https://app.example.test/x?a=1&a=2&b=3", {
        method: "POST",
        headers: { Cookie: "ls_session=tok; z=1", Origin: "https://o" },
      }),
      { lessonId: "G6.U4.L4", slotId: "slot%20a%E0%A4%A" },
      { k: 1 },
    );
    expect(r.path_params).toEqual({
      lessonId: "G6.U4.L4",
      slotId: "slot%20a%E0%A4%A",
    });
    expect(r.query).toEqual({ a: ["1", "2"], b: "3" });
    expect(r.cookies).toEqual({ ls_session: "tok", z: "1" });
    expect(r.headers["origin"]).toBe("https://o");
  });
});
