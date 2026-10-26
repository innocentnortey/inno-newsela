// Unit tests (no database) of the queue/version compatibility inventory.
import { describe, expect, it } from "vitest";
import { classify, exit_code, group_jobs, main, render_text, type Inventory, type PinnedJob } from "./queue-compat.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);
const job = (o: Partial<PinnedJob>): PinnedJob => ({
  job_id: "j", run_id: "r1", kind: "lesson", status: "queued", run_state: "running", lesson_id: "G6.U4.L1", queued_at: "2026-10-26T10:00:00.000Z",
  lease_until: null, prompt_version_id: "pv_new", prompt_number: 2, pinned_locked_hash: B, claimable_now: true, compat: "match", ...o,
});
const capture = () => {
  const out: string[] = [], err: string[] = [];
  return { out, err, io: { out: (s: string) => void out.push(s), err: (s: string) => void err.push(s) } };
};

describe("queue-compat", () => {
  it("classify_match_old_missing", () => {
    expect(classify(B, B)).toBe("match");
    expect(classify(A, B)).toBe("old_pin");
    expect(classify(null, B)).toBe("pin_missing");
  });

  it("groups_split_by_hash_and_count_latent_separately", () => {
    const jobs = [
      job({ job_id: "1" }),
      job({ job_id: "2", prompt_version_id: "pv_guid", prompt_number: 3 }), // same locked layer, different guidance: one group
      job({ job_id: "3", prompt_version_id: "pv_old", prompt_number: 1, pinned_locked_hash: A, compat: "old_pin", run_id: "r2" }),
      job({ job_id: "4", prompt_version_id: "pv_old", prompt_number: 1, pinned_locked_hash: A, compat: "old_pin", run_id: "r2", status: "running" }),
      job({ job_id: "5", prompt_version_id: "pv_old", prompt_number: 1, pinned_locked_hash: A, compat: "old_pin", run_id: "r3", run_state: "paused", claimable_now: false, queued_at: "2026-10-26T09:00:00.000Z" }),
      job({ job_id: "6", prompt_version_id: "pv_gone", prompt_number: null, pinned_locked_hash: null, compat: "pin_missing", run_id: "r4" }),
    ];
    const groups = group_jobs(jobs);
    expect(groups.map((g) => g.compat)).toEqual(["old_pin", "pin_missing", "match"]);
    const old = groups[0]!;
    expect(old).toMatchObject({ locked_hash: A, queued: 2, running: 1, queued_in_unclaimable_runs: 1, oldest_queued_at: "2026-10-26T09:00:00.000Z" });
    expect(old.run_ids).toEqual(["r2", "r3"]);
    const match = groups[2]!;
    expect(match.prompt_version_ids).toEqual(["pv_new", "pv_guid"]);
    expect(match.queued).toBe(2);
  });

  it("render_text_has_no_url_or_password", async () => {
    const inv: Inventory = {
      generated_at: "2026-10-26T10:00:00.000Z", artifact_locked_hash: B, latest_prompt_version: { id: "pv_new", number: 2, locked_hash: B },
      jobs: [job({ pinned_locked_hash: A, compat: "old_pin" })], groups: group_jobs([job({ pinned_locked_hash: A, compat: "old_pin" })]),
      retryable_failed: [], totals: { match: 0, old_pin: 1, pin_missing: 0 },
    };
    const text = render_text(inv);
    expect(text).toContain("[old_pin]");
    expect(text).toContain("old artifact must keep running until this group is 0, or use a supported transition (runbook section 5)");
    expect(text).not.toMatch(/postgres|SECRETPW/);
    // main prints nothing from the environment: an unreachable database gives only the error class.
    const c = capture();
    const code = await main(["--json"], { DATABASE_URL: "postgres://u:SECRETPW@127.0.0.1:1/d" }, c.io);
    expect(code).toBe(1);
    const all = c.out.join("") + c.err.join("");
    expect(all).toMatch(/^queue-compat failed: \w+\n$/);
    expect(all).not.toMatch(/SECRETPW|postgres:/);
  });

  it("main_rejects_bad_arguments", async () => {
    for (const argv of [["--nope"], ["--artifact-hash", "short"], ["--artifact-hash"]]) {
      const c = capture();
      expect(await main(argv, {}, c.io)).toBe(2);
      expect(c.err.join("")).toContain("usage:");
    }
  });

  it("fail_on_old_exit_code", () => {
    expect(exit_code({ totals: { match: 3, old_pin: 0, pin_missing: 0 } }, true)).toBe(0);
    expect(exit_code({ totals: { match: 3, old_pin: 1, pin_missing: 0 } }, true)).toBe(3);
    expect(exit_code({ totals: { match: 0, old_pin: 0, pin_missing: 1 } }, true)).toBe(3);
    expect(exit_code({ totals: { match: 0, old_pin: 5, pin_missing: 5 } }, false)).toBe(0);
  });
});
