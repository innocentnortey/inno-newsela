// NL-51 implementer tests: AC-1 (dependants), AC-3 (idempotent, new version), AC-5 (exported in the same tx).
import { describe, expect, it } from "vitest";
import { UNIT, make_service, make_world, user } from "./export-fixtures.ts";

const L3 = "G6.U4.L3";
const L4 = "G6.U4.L4";
const L5 = "G6.U4.L5";
const approver = () => user("approver");

describe("AC-1 dependants_only_when_sources_approved", () => {
  it("dependants_only_when_sources_approved: L4 waits on L5 and is held back until L5 is approved", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    w.seed(L4, "approved");
    const svc = make_service(w);
    const both = await svc.create(approver(), UNIT);
    expect(both.included.map((i) => i.lesson_id).sort()).toEqual([L4, L5]);
    expect(both.held_back).toEqual([]);

    const w2 = make_world();
    w2.seed(L5, "in_review");
    w2.seed(L4, "approved");
    const svc2 = make_service(w2);
    const held = await svc2.create(approver(), UNIT);
    expect(held.included).toEqual([]);
    expect(held.held_back).toEqual([{ lesson_id: L4, reason: "a lesson it links to is not approved", waits_on: L5 }]);
    const payload = await svc2.download(approver(), held.export_id);
    expect(payload.lessons).toEqual([]);

    w2.seed(L5, "approved");
    const later = await svc2.create(approver(), UNIT);
    expect(later.same_as_previous).toBe(false);
    expect(later.included.map((i) => i.lesson_id).sort()).toEqual([L4, L5]);
  });

  it("transitive_hold_back: L3 waits on L4 waits on L5 with L5 unapproved holds both", async () => {
    const w = make_world();
    w.link(L3, L4);
    w.seed(L5, "in_review");
    w.seed(L4, "approved");
    w.seed(L3, "approved");
    const listed = await make_service(w).list(approver(), UNIT);
    expect(listed.included).toEqual([]);
    expect(listed.held_back.map((h) => [h.lesson_id, h.waits_on]).sort()).toEqual([
      [L3, L4],
      [L4, L5],
    ]);
  });
});

describe("AC-3 idempotent_and_new_version", () => {
  it("idempotent_and_new_version: unchanged export writes nothing; a changed lesson gives version 2", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    w.seed(L4, "approved");
    const svc = make_service(w);
    const first = await svc.create(approver(), UNIT);
    expect(first.version_number).toBe(1);
    expect(first.same_as_previous).toBe(false);
    expect(w.exports).toHaveLength(1);
    expect(w.audit).toHaveLength(1);
    expect(w.review_events).toHaveLength(2);
    expect(w.state_writes).toHaveLength(2);
    expect(w.locks).toContain("export:G6.U4");

    const before = w.snapshot();
    const second = await svc.create(approver(), UNIT);
    expect(second.same_as_previous).toBe(true);
    expect(second.export_id).toBe(first.export_id);
    expect(second.version_number).toBe(1);
    expect(w.snapshot()).toEqual(before);

    w.reapprove(L5, "changed text");
    const third = await svc.create(approver(), UNIT);
    expect(third.same_as_previous).toBe(false);
    expect(third.version_number).toBe(2);
    expect(third.export_id).not.toBe(first.export_id);
    expect(w.exports).toHaveLength(2);
    const listed = await svc.list(approver(), UNIT);
    expect(listed.exports.map((e) => e.version_number)).toEqual([2, 1]);
  });

  it("idempotent_and_new_version: a unit key resolves like the canonical id", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    const svc = make_service(w);
    const a = await svc.create(approver(), "g6-u4");
    const b = await svc.create(approver(), UNIT);
    expect(b.export_id).toBe(a.export_id);
  });
});

describe("AC-5 exported_state_same_tx", () => {
  it("exported_state_same_tx: approved lessons move to exported with one review event each", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    w.seed(L4, "approved");
    const caller = approver();
    await make_service(w).create(caller, UNIT);
    expect(w.states.get(L4)?.state).toBe("exported");
    expect(w.states.get(L5)?.state).toBe("exported");
    expect(w.review_events).toHaveLength(2);
    for (const e of w.review_events) {
      expect([e.from_state, e.to_state, e.actor_id]).toEqual(["approved", "exported", caller.user_id]);
    }
    expect(w.audit[0]?.details).toMatchObject({ unit_id: UNIT, version_number: 1, lesson_count: 2, newly_exported: 2 });
  });

  it("exported_state_same_tx: a failed insert rolls everything back", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    w.seed(L4, "approved");
    const before = w.snapshot();
    w.fail_next_insert = true;
    await expect(make_service(w).create(approver(), UNIT)).rejects.toThrow("injected insert failure");
    expect(w.snapshot()).toEqual(before);
  });

  it("exported_state_same_tx: an already exported lesson stays in a later export without a second event", async () => {
    const w = make_world();
    w.seed(L5, "approved");
    const svc = make_service(w);
    await svc.create(approver(), UNIT);
    w.seed(L3, "approved");
    const events = w.review_events.length;
    const next = await svc.create(approver(), UNIT);
    expect(next.included.map((i) => i.lesson_id).sort()).toEqual([L3, L5]);
    expect(w.review_events.length).toBe(events + 1);
  });

  it("reopened_between_reads_is_not_exported: a lesson reopened before its lock is excluded", async () => {
    const w = make_world();
    w.links.length = 0;
    w.seed(L3, "approved");
    const real = w.state_repo.lock_for_update;
    w.state_repo.lock_for_update = async (id, tx) => {
      if (id === L3) w.set_state(id, "reopened");
      return real(id, tx);
    };
    const created = await make_service(w).create(approver(), UNIT);
    expect(created.included).toEqual([]);
    expect(w.states.get(L3)?.state).toBe("reopened");
  });
});
