import { afterEach, describe, expect, it, vi } from "vitest";
import { good_wp1_draft, make_job } from "./nodes/testing/fixtures.ts";
import { make_harness } from "./nodes/testing/harness.ts";

const MARKER = "KEY-MARKER-77";
const prior = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prior;
  vi.restoreAllMocks();
});

describe("lesson job capture (OBS-1, 2, 5, 7)", () => {
  it("carries ids on every record and leaks no key or lesson text to output", async () => {
    process.env.ANTHROPIC_API_KEY = MARKER;
    const out_text: string[] = [];
    const sink = (...a: unknown[]): void => void out_text.push(a.map(String).join(" "));
    vi.spyOn(console, "log").mockImplementation(sink);
    vi.spyOn(console, "info").mockImplementation(sink);
    vi.spyOn(console, "warn").mockImplementation(sink);
    vi.spyOn(console, "error").mockImplementation(sink);
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => (out_text.push(String(c)), true));

    const h = make_harness([{ raw: JSON.stringify(good_wp1_draft()) }]);
    const job = make_job({ reviewer_note: "REVIEWER-NOTE-SECRET" });
    const out = await h.runner.run(job);

    const v = h.world.versions.rows[0]!;
    expect(out.status).toBe("ready");
    expect(v.provenance.run_id).toBe(job.run_id);
    expect(v.lesson_id).toBe(job.lesson_id);
    expect(h.caller.requests[0]!.ctx).toMatchObject({ run_id: job.run_id, lesson_id: job.lesson_id, job_id: job.job_id });
    expect(v.provenance.model_call_ids).toHaveLength(1);
    expect(out.job_id).toBe(job.job_id);
    expect(h.world.docs.docs.has(job.lesson_id!)).toBe(true);

    const stored = JSON.stringify([v, [...h.world.docs.docs.values()], h.world.flags.rows, out]);
    const haystack = `${stored}\n${out_text.join("\n")}`;
    const hits = haystack.split(MARKER).length - 1;
    process.stderr.write(`marker matches: ${hits}\n`);
    expect(hits).toBe(0);
    expect(out_text.join("\n")).not.toContain("REVIEWER-NOTE-SECRET");
  });
});
