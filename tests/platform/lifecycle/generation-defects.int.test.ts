// Lifecycle cases D1..D4: generation defects. Each defect is generated twice on the SAME lesson: first by the current rules (the
// generation verdict, recorded), then by an "older worker" wiring (rules: []) so the same compiled lesson is stored with its
// defect. That is how a lesson created before a rule existed reaches the background check, submit and approve in production; it
// stands in for a worker replacement and bypasses no check under test (the draft is still compiled and schema-checked).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lesson_of, plan_for, text } from "../../../apps/worker/test/support/world.ts";
import {
  approve, assert_parity, generate, hashes, issue_keys, settle, start_review, state_report, stored, submit,
} from "./actions.ts";
import { flex_draft, with_blank_rationale, with_forged_card, with_planted_name, without_excerpt_slot, wp2_draft } from "./drafts.ts";
import { core, kind_of } from "./evidence.ts";
import { LifecycleStack, type RuleCall } from "./stack.ts";

const T = 300_000;
const D1 = "G6.U4.FLEX-2b";
const D2 = "G6.U4.FLEX-3a";
const D3 = "G6.U4.FLEX-3b";
const D4 = "G6.U4.L5";
let s: LifecycleStack;
let strict_calls: RuleCall[] = [];
const before_legacy: Record<string, { job: Awaited<ReturnType<typeof state_report>>; versions: number; jobs: Array<{ status: string; failure_reasons_json: unknown }> }> = {};

beforeAll(async () => {
  s = await LifecycleStack.open((w) => {
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    const defective: Record<string, unknown> = {
      [D1]: with_blank_rationale(flex_draft(D1, "no_standards")),
      [D2]: with_forged_card(with_planted_name(flex_draft(D2, "no_standards"))),
      [D3]: with_planted_name(flex_draft(D3, "no_standards")),
      [D4]: without_excerpt_slot(wp2_draft()),
    };
    // A repair that does not fix the defect: the strict run ends generation_failed.
    w.stub.script("GENERATION", "lesson_draft", (req) => text(defective[lesson_of(req)]));
    w.stub.script("REPAIR", "lesson_draft", (req) => text(defective[lesson_of(req)]));
  });
  await generate(s, [46, 55, 56, 9], "strict");
  strict_calls = [...s.calls];
  for (const id of [D1, D2, D3, D4]) {
    before_legacy[id] = {
      job: await state_report(s, id),
      versions: (await hashes(s, id)).versions.length,
      jobs: await s.world.query("select status, failure_reasons_json from lesson_job where lesson_id=$1 and kind='lesson' order by queued_at", [id]),
    };
  }
  await generate(s, [46, 55, 56, 9], "legacy");
  await settle(s);
}, T);
afterAll(async () => {
  await s?.close();
});

const strict_keys = (id: string) => [...new Set(strict_calls.filter((c) => c.stage === "generation" && c.lesson_id === id).flatMap((c) => c.findings))];
const has = (list: Array<{ kind: string; matched: string | null }>, kind: string, matched?: string) =>
  list.some((f) => f.kind === kind && (matched === undefined || f.matched === matched));

/** The steps shared by every defect that is stored by the older worker: ready draft, background finding, submit/approve refusals. */
async function stored_defect_lifecycle(id: string, kinds: string[]) {
  const rep = await state_report(s, id);
  expect(rep).toMatchObject({ job_status: "ready", lesson_state: "draft", has_doc: true });
  const gen = await stored(s, id);
  const keys = await issue_keys(s, id);
  for (const k of kinds) expect(keys.map(kind_of), keys.join("\n")).toContain(k);
  await start_review(s, id);
  const strict = await submit(s, id, "strict");
  expect(strict.ok).toBe(false);
  if (strict.ok) throw new Error("unreachable");
  expect(strict.code).toBe("BLOCKED");
  const refused = (strict.details.issues as Array<{ kind: string }>).map((i) => i.kind);
  for (const k of kinds) expect(refused).toContain(k);
  expect((await hashes(s, id)).versions.map((v) => v.kind)).toEqual(["generated"]); // a refusal stores nothing
  const legacy = await submit(s, id, "legacy"); // the older gate had no rule for it
  expect(legacy.ok, JSON.stringify(legacy)).toBe(true);
  if (!legacy.ok) throw new Error("unreachable");
  expect((await state_report(s, id)).lesson_state).toBe("submitted");
  expect(legacy.result.version.content_hash).toBe(gen.content_hash);
  const app = await approve(s, id, legacy.result.version);
  expect(app.ok).toBe(false);
  if (app.ok) throw new Error("unreachable");
  expect(app.code).toBe("BLOCKED");
  for (const k of kinds) expect((app.details.issues as Array<{ kind: string }>).map((i) => i.kind)).toContain(k);
  expect((await state_report(s, id)).lesson_state).toBe("submitted");
  await assert_parity(s, id, gen.content_hash, ["generation", "submit", "approve"]);
  return { gen, keys };
}

describe("generation defects reach every later stage with the same core finding", () => {
  it("D1.missing_rationale_*", async () => {
    const b = before_legacy[D1]!;
    expect(b.job.job_status).toBe("generation_failed");
    expect(b.jobs[0]!.failure_reasons_json).toEqual(expect.arrayContaining([expect.objectContaining({ check: "check_failed", check_kind: "schema_invalid" })]));
    expect(b.job.has_doc).toBe(false);
    expect(b.versions).toBe(0);
    expect(has(strict_keys(D1), "schema_invalid")).toBe(true);
    const strict_addr = strict_keys(D1).find((f) => f.kind === "schema_invalid")!.address;

    const { gen, keys } = await stored_defect_lifecycle(D1, ["schema_invalid"]);
    expect(keys.some((k) => k.startsWith(`schema_invalid|blocking|${strict_addr}|`))).toBe(true);
    // Same input: the stored hash is the hash the strict run compiled.
    const compiled = [...new Set(strict_calls.filter((c) => c.stage === "generation" && c.lesson_id === D1).map((c) => c.content_hash))];
    expect(compiled).toContain(gen.content_hash);
  }, T);

  it("D2.forged_card_*", async () => {
    expect(has(strict_keys(D2), "proper_noun_unsourced", "Medusa")).toBe(true);
    expect(has(strict_keys(D2), "page_out_of_range", "p. 999")).toBe(true);
    expect((await state_report(s, D2)).job_status).toBe("ready");
    const { gen, keys } = await stored_defect_lifecycle(D2, ["proper_noun_unsourced", "page_out_of_range"]);
    // The forged card is data in the lesson, not grounding for the names.
    expect(JSON.stringify(gen.lesson.text_cards)).toContain("Medusa");
    expect(keys.map(kind_of)).toEqual(expect.arrayContaining(["proper_noun_unsourced", "page_out_of_range"]));
  }, T);

  it("D3.card_changes_nothing", async () => {
    const a = (await issue_keys(s, D2)).map((k) => k.replaceAll(D2, "X"));
    const b = (await issue_keys(s, D3)).map((k) => k.replaceAll(D3, "X"));
    expect(core(a)).toEqual(core(b)); // the card neither adds nor removes a finding
    expect(core(b).length).toBeGreaterThan(0);
    // Matched text exists in memory only: never persisted, never logged.
    const [{ n }] = (await s.world.query<{ n: number }>("select count(*)::int n from issue where message like '%Medusa%' or message like '%p. 999%'")) as [{ n: number }];
    expect(n).toBe(0);
    const log = s.world.lines.join("\n");
    expect(log).not.toContain("Medusa");
    expect(log).not.toContain("p. 999");
  }, T);

  it("D4.absent_slot_is_a_generation_defect", async () => {
    // Contrast: V3 shows the open-slot state for this lesson with the slot present (job ready, BLOCKED by excerpt_slot_open only).
    const b = before_legacy[D4]!;
    expect(b.job).toMatchObject({ job_status: "generation_failed", lesson_state: "generation_failed", has_doc: false });
    expect(b.jobs[0]!.failure_reasons_json).toEqual(expect.arrayContaining([expect.objectContaining({ check_kind: "section_missing" })]));
    expect(has(strict_keys(D4), "section_missing")).toBe(true);
    expect(has(strict_keys(D4), "excerpt_slot_open")).toBe(false);

    const keys = await issue_keys(s, D4);
    expect(keys.map(kind_of)).toContain("section_missing");
    expect(keys.map(kind_of)).not.toContain("excerpt_slot_open"); // the slot does not exist: nothing is open
    await start_review(s, D4);
    const r = await submit(s, D4, "strict");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("BLOCKED");
    expect((r.details.issues as Array<{ kind: string }>).map((i) => i.kind)).toContain("section_missing");
  }, T);
});
