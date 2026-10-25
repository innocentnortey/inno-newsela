import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import {
  author,
  fail_candidate,
  fake_cost,
  fake_prices,
  finish_candidate,
  H0,
  H1,
  L4,
  L5,
  make_service,
  make_world,
  reviewer,
  seed_inflight,
  version_row,
} from "./candidate-fixtures.ts";

const lid = L4 as never;
const counts = (w: ReturnType<typeof make_world>) => [
  w.runs.length,
  w.jobs.length,
  w.audit.length,
  w.day_cap_calls.length,
];
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof DomainRefusal) return e;
    throw e;
  }
  throw new Error("expected refusal");
};

describe("CandidateService.regenerate", () => {
  it("regenerate_creates_candidate_only", async () => {
    const w = make_world();
    const lesson_before = { ...w.lesson };
    const out = await make_service(w).regenerate(reviewer, lid, {
      note: "  Make it open-ended. ",
    });
    expect(
      w.runs.filter((r) => r.kind === ("candidate" as never)),
    ).toHaveLength(1);
    expect(w.runs[1]!.parent_run_id).toBe("run-parent");
    const job = w.jobs.find((j) => j.kind === "candidate")!;
    expect(job.status).toBe("queued");
    expect((job as unknown as { reviewer_note: string }).reviewer_note).toBe(
      "Make it open-ended.",
    );
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]!.action).toBe("candidate.regenerate");
    expect(JSON.stringify(w.audit[0]!.details)).toContain('"has_note":true');
    expect(JSON.stringify(w.audit)).not.toContain("open-ended");
    expect(out).toMatchObject({
      status: "queued",
      adopted: false,
      current_content_hash: H0,
      candidate_id: w.runs[1]!.run_id,
      sections: [],
    });
    expect(w.lesson).toEqual(lesson_before);
    expect(w.versions).toHaveLength(1);
    expect(w.reservations).toBe(0);
  });

  it("second_call_returns_inflight", async () => {
    const w = make_world();
    const id = seed_inflight(w);
    const before = counts(w);
    const out = await make_service(w).regenerate(reviewer, lid, {});
    expect(out.candidate_id).toBe(id);
    expect(counts(w)).toEqual(before);
  });

  it("unique_index_race", async () => {
    const w = make_world();
    w.race = true;
    const out = await make_service(w).regenerate(reviewer, lid, {});
    expect(out.candidate_id).toBe("run-winner");
    // the loser's run/audit were rolled back; only the winner's rows remain
    expect(w.runs.map((r) => r.run_id)).toEqual(["run-parent", "run-winner"]);
    expect(
      w.jobs.filter((j) => j.kind === ("candidate" as never)),
    ).toHaveLength(1);
    expect(w.audit).toHaveLength(0);
  });

  it("refusals_write_nothing", async () => {
    for (const state of ["submitted", "approved", "exported", "draft"]) {
      const w = make_world(state);
      const before = counts(w);
      const e = await code(make_service(w).regenerate(reviewer, lid, {}));
      expect(e.code).toBe("LESSON_LOCKED");
      expect((e.details as { state: string }).state).toBe(state);
      expect(counts(w)).toEqual(before);
    }
    for (const scope of ["user", "project"] as const) {
      const w = make_world();
      w.cap_refusal = { scope, remaining: 1.25 };
      const e = await code(make_service(w).regenerate(reviewer, lid, {}));
      expect(e.code).toBe("DAY_CAP_REACHED");
      expect(e.details).toEqual({ scope, remaining_usd: 1.25 });
      expect([w.runs.length, w.jobs.length, w.audit.length]).toEqual([1, 1, 0]);
    }
    for (const state of ["generation_failed", "in_review"]) {
      const w = make_world(state);
      expect((await make_service(w).regenerate(reviewer, lid, {})).status).toBe(
        "queued",
      );
    }
  });

  it("own_cap_not_run_cap", async () => {
    const w = make_world();
    const parent_before = { ...w.parent };
    await make_service(w).regenerate(reviewer, lid, {});
    const p = fake_prices.price_for("gen-model");
    const r = fake_prices.price_for("repair-model");
    const expected = fake_cost
      .max_call_cost(p, 20000, 32000)
      .plus(fake_cost.max_call_cost(p, 20000, 48000))
      .plus(fake_cost.max_call_cost(r, 20000, 32000));
    expect(w.day_cap_calls[0]!.equals(expected)).toBe(true);
    expect((w.runs[1]!.cap_usd as Decimal).equals(expected)).toBe(true);
    expect(w.parent).toEqual(parent_before);
  });
});

describe("CandidateService.get", () => {
  it("get_status_progression", async () => {
    const w = make_world();
    const svc = make_service(w);
    const id = (await svc.regenerate(reviewer, lid, {})).candidate_id;
    expect((await svc.get(reviewer, lid, id)).status).toBe("queued");
    w.jobs.find((j) => j.run_id === id)!.status = "running";
    const drafting = await svc.get(reviewer, lid, id);
    expect(drafting.status).toBe("drafting");
    expect(drafting.sections).toEqual([]);
    finish_candidate(w, id);
    const ready = await svc.get(reviewer, lid, id);
    expect(ready).toMatchObject({
      status: "ready",
      version_number: 2,
      cost_usd: 0.42,
      adopted: false,
      current_content_hash: H0,
    });
    expect(ready.sections).toHaveLength(2);

    const w2 = make_world();
    const s2 = make_service(w2);
    const id2 = (await s2.regenerate(reviewer, lid, {})).candidate_id;
    fail_candidate(w2, id2);
    const failed = await s2.get(reviewer, lid, id2);
    expect(failed.status).toBe("failed");
    expect(failed.failure_reasons).toEqual([{ check: "truncated" }]);

    // another lesson's candidate read under this lesson
    const w3 = make_world();
    const foreign = seed_inflight(w3, "queued", L5);
    expect(
      (await code(make_service(w3).get(reviewer, lid, foreign))).code,
    ).toBe("NOT_FOUND");
  });
});

async function ready(w = make_world()) {
  const svc = make_service(w);
  const id = (await svc.regenerate(reviewer, lid, {})).candidate_id;
  finish_candidate(w, id);
  return { w, svc, id };
}

describe("CandidateService.adopt", () => {
  it("adopt_paths", async () => {
    const { w, svc, id } = await ready();
    const r = await svc.adopt(reviewer, lid, id, { scope: "whole" });
    expect(w.collab_calls).toHaveLength(1);
    expect(w.collab_calls[0]).toMatchObject({
      tag: "candidate-adopt",
      actor: { user_id: reviewer.user_id },
      edit: { kind: "adopt", scope: "whole" },
    });
    expect(w.versions.find((v) => v.version_id === `ver-${id}`)!.adopted).toBe(
      true,
    );
    const adopts = w.audit.filter((a) => a.action === "candidate.adopt");
    expect(adopts).toHaveLength(1);
    expect((adopts[0]!.details as { scope: string }).scope).toBe("whole");
    expect(r).toMatchObject({ last_editor: reviewer.name, content_hash: H1 });

    expect(
      (await code(svc.adopt(reviewer, lid, id, { scope: "whole" }))).code,
    ).toBe("INVALID_TRANSITION");
    expect(w.collab_calls).toHaveLength(1);

    expect(
      (await code(svc.adopt(reviewer, lid, id, { scope: "section" }))).code,
    ).toBe("INVALID_REQUEST");
    expect(
      (
        await code(
          svc.adopt(reviewer, lid, id, {
            scope: "section",
            section_address: "nope",
          }),
        )
      ).code,
    ).toBe("INVALID_REQUEST");
    expect(w.collab_calls).toHaveLength(1);

    const { w: w2, svc: s2, id: id2 } = await ready();
    await s2.adopt(reviewer, lid, id2, {
      scope: "section",
      section_address: `${L4}.Practice`,
    });
    expect(w2.collab_calls).toHaveLength(1);
    expect(w2.collab_calls[0]!.edit).toMatchObject({
      scope: "section",
      section_address: `${L4}.Practice`,
    });
    expect(w2.audit.filter((a) => a.action === "candidate.adopt")).toHaveLength(
      1,
    );
    expect(
      w2.versions.find((v) => v.version_id === `ver-${id2}`)!.adopted,
    ).toBe(false);

    const w3 = make_world();
    const s3 = make_service(w3);
    const q = (await s3.regenerate(reviewer, lid, {})).candidate_id;
    expect(
      (await code(s3.adopt(reviewer, lid, q, { scope: "whole" }))).code,
    ).toBe("INVALID_TRANSITION");
    expect(w3.collab_calls).toHaveLength(0);
  });

  it("collab_down_and_roles", async () => {
    const { w, svc, id } = await ready();
    w.collab_down = true;
    const audit_before = w.audit.length;
    expect(
      (await code(svc.adopt(reviewer, lid, id, { scope: "whole" }))).code,
    ).toBe("COLLAB_UNAVAILABLE");
    expect(w.versions.find((v) => v.version_id === `ver-${id}`)!.adopted).toBe(
      false,
    );
    expect(w.audit).toHaveLength(audit_before);

    const before = counts(w);
    expect((await code(svc.regenerate(author, lid, {}))).code).toBe(
      "ROLE_FORBIDDEN",
    );
    expect(
      (await code(svc.adopt(author, lid, id, { scope: "whole" }))).code,
    ).toBe("ROLE_FORBIDDEN");
    expect(counts(w)).toEqual(before);
    expect((await svc.get(author, lid, id)).status).toBe("ready");
  });
});

void version_row;
