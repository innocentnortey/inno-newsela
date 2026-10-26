// Lifecycle cases V1..V3: valid supported content keeps its structure, source authority and standards evidence through
// generation -> background check -> (human work) -> submit -> approve -> export. Authority: docs/data/worked-pairs.md WP-1
// (reading lesson), WP-2 (writing lesson with one excerpt slot) and WP-3 "B" (flex day; U7 option (a) no standards, option (b)
// the generator proposes RL.6.7 with a blocking confirmation). Stored-lesson constants below are written from the worked pairs;
// nothing is read from templates.ts or the standards view.
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lesson_of, plan_for, text } from "../../../apps/worker/test/support/world.ts";
import {
  approve, assert_parity, export_bundle, generate, hashes, issue_keys, settle, start_review, state_report, stored, submit,
} from "./actions.ts";
import type { Details } from "./actions.ts";
import { flex_draft, wp1_draft, wp1_first_draft, wp2_draft } from "./drafts.ts";
import { authority_of, core, expected_evidence, fingerprint, gating, HUMAN_WORK, headings_of, key_of, kind_of, observed_evidence, standards_of, structure_of } from "./evidence.ts";
import { LifecycleStack } from "./stack.ts";

const T = 300_000;
let s: LifecycleStack;
const FLEX_A = "G6.U4.FLEX-1a";
const FLEX_B = "G6.U4.FLEX-1b";

beforeAll(async () => {
  s = await LifecycleStack.open((w) => {
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    const drafts: Record<string, unknown> = {
      [FLEX_A]: flex_draft(FLEX_A, "proposed_code"), [FLEX_B]: flex_draft(FLEX_B, "no_standards"),
      "G6.U4.L5": wp2_draft(), "G6.U4.L4": wp1_first_draft(),
    };
    w.stub.script("GENERATION", "lesson_draft", (req) => text(drafts[lesson_of(req)]));
    // L4's first draft is defective by design so it exercises the repair path; the others pass first time.
    w.stub.script("REPAIR", "lesson_draft", (req) => text(lesson_of(req) === "G6.U4.L4" ? wp1_draft() : wp2_draft()));
  });
  await generate(s, [25, 26, 9, 8], "strict");
  await settle(s);
}, T);
afterAll(async () => {
  await s?.close();
});

// review_event has no seq column (migration 0008: id text, at timestamptz default now()). Each transition commits in its own
// transaction, so `at` differs between transitions of one lesson; `id` is only a tie-break and is not an ordering key.
const review_states = async (id: string) =>
  (await s.world.query<{ from_state: string; to_state: string }>("select from_state, to_state from review_event where lesson_id=$1 order by at, id", [id])).map((r) => `${r.from_state}->${r.to_state}`);

describe("valid supported content through the real lifecycle", () => {
  it("V1.no_standards_clean_to_export", async () => {
    const id = FLEX_B;
    const gen = await stored(s, id);
    expect(await state_report(s, id)).toEqual({ job_status: "ready", lesson_state: "draft", has_doc: true, blocking_kinds: [], confirmation_kinds: [] });
    const h0 = await hashes(s, id);
    expect(h0.docs.map((d) => d.seq)).toEqual([1]);
    expect(h0.versions.map((v) => v.kind)).toEqual(["generated"]);

    // WP-3 B: Launch 5 / Learning in Action 40 / Look Back 5, no parts, no Homework, no standards.
    expect(structure_of(gen.lesson)).toEqual([
      { section: "Launch", minutes: 5, parts: [] }, { section: "Learning in Action", minutes: 40, parts: [] }, { section: "Look Back", minutes: 5, parts: [] },
    ]);
    expect(standards_of(gen.lesson)).toEqual([]);
    expect(observed_evidence(gen.lesson)).toEqual(expected_evidence(flex_draft(id, "no_standards")));
    expect(observed_evidence(gen.lesson)).toEqual([]);
    const cfu = headings_of(gen.lesson).filter((h) => h.icon === "cfu");
    expect(cfu).toHaveLength(1); // the CFU exists and its heading carries no "(" tag: a null code is legitimate on a code-less row
    expect(cfu[0]!.text.includes("(")).toBe(false);

    expect(core(await issue_keys(s, id))).toEqual([]);
    await assert_parity(s, id, gen.content_hash, ["generation"]);

    await start_review(s, id);
    const sub = await submit(s, id, "strict");
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    expect(sub.result.version.content_hash).toBe(gen.content_hash); // no edit happened: the hash is unchanged on purpose
    await assert_parity(s, id, gen.content_hash, ["generation", "submit"]);
    const app = await approve(s, id, sub.result.version);
    expect(app.ok).toBe(true);
    expect((await state_report(s, id)).lesson_state).toBe("approved");
    await assert_parity(s, id, gen.content_hash, ["generation", "submit", "approve"]);

    const { file } = await export_bundle(s, "G6.U4");
    const item = file.lessons.find((l) => l.lesson_id === id)!;
    expect(item.content_hash).toBe(gen.content_hash);
    expect(item.lesson).toEqual(gen.lesson);
    expect(fingerprint(item.lesson)).toEqual(fingerprint(gen.lesson));
    const again = (await s.recheck(id, item.lesson, item.content_hash)).map(key_of).sort();
    expect(core(again)).toEqual([]);
    expect(again).toEqual(await issue_keys(s, id));
    expect((await state_report(s, id)).lesson_state).toBe("exported");
    expect(await review_states(id)).toEqual(["draft->in_review", "in_review->submitted", "submitted->approved", "approved->exported"]);
  }, T);

  it("V2.proposed_code_confirm_to_export", async () => {
    const id = FLEX_A;
    const draft = flex_draft(id, "proposed_code");
    const gen = await stored(s, id);
    const rep0 = await state_report(s, id);
    expect(rep0).toMatchObject({ job_status: "ready", lesson_state: "draft", has_doc: true, blocking_kinds: [] });
    expect(rep0.confirmation_kinds).toContain("standard_confirmation");
    expect(core(await issue_keys(s, id))).toEqual([]);
    expect(standards_of(gen.lesson)).toEqual([{ code: "RL.6.7", role: "focus", origin: "added", confirmation: "open" }]);
    expect(observed_evidence(gen.lesson)).toEqual(expected_evidence(draft));
    expect(observed_evidence(gen.lesson)).toEqual(["assess|RL.6.7|Learning in Action", "teach|RL.6.7|Learning in Action"]);
    const before = await hashes(s, id);

    await start_review(s, id);
    const refused = await submit(s, id, "strict");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("CONFIRMATION_OPEN"); // awaiting human work, not a defect
    const flagged = (refused.details.issues as Array<{ kind: string; code: string | null }>).find((i) => i.kind === "standard_confirmation");
    expect(flagged?.code).toBe("RL.6.7");
    expect((await state_report(s, id)).lesson_state).toBe("in_review");
    expect(await hashes(s, id)).toEqual(before);

    const decided = await s.issues.decide_standard(s.user("reviewer"), id as never, { code: "RL.6.7", decision: "confirm" } as never);
    expect(decided.status).toBe("confirmed");
    const h1 = await hashes(s, id);
    expect(h1.docs.map((d) => d.seq)).toEqual([1, 2]);
    expect(h1.docs[1]!.content_hash).not.toBe(gen.content_hash);
    const edited = await stored(s, id);
    expect(standards_of(edited.lesson)).toEqual([{ code: "RL.6.7", role: "focus", origin: "added", confirmation: "confirmed" }]);
    expect(observed_evidence(edited.lesson)).toEqual(observed_evidence(gen.lesson));
    const f0 = fingerprint(gen.lesson);
    const f1 = fingerprint(edited.lesson);
    expect(f1.standards).not.toEqual(f0.standards);
    expect({ ...f1, standards: null }).toEqual({ ...f0, standards: null });
    await settle(s);
    expect(core(await issue_keys(s, id))).toEqual([]);
    expect((await issue_keys(s, id)).map(kind_of)).not.toContain("standard_confirmation");

    const sub = await submit(s, id, "strict");
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    expect(sub.result.version.content_hash).toBe(edited.content_hash);
    expect((await state_report(s, id)).lesson_state).toBe("submitted");
    expect((await approve(s, id, sub.result.version)).ok).toBe(true);
    expect((await state_report(s, id)).lesson_state).toBe("approved");
    const { file } = await export_bundle(s, "G6.U4");
    const item = file.lessons.find((l) => l.lesson_id === id)!;
    expect(item.content_hash).toBe(edited.content_hash);
    expect(standards_of(item.lesson)).toEqual([{ code: "RL.6.7", role: "focus", origin: "added", confirmation: "confirmed" }]);
    expect(observed_evidence(item.lesson)).toEqual(expected_evidence(draft));
    await assert_parity(s, id, edited.content_hash, ["submit", "approve"]);
    expect((await state_report(s, id)).lesson_state).toBe("exported");
  }, T);

  // The V3 steps form one lifecycle (fill slots, submit L4, approve in dependency order). Each test awaits the memoized step(s) it
  // needs, so it also runs alone (-t), shuffled or concurrent: whichever test starts first runs the step, the others wait for it.
  // A failed step rejects the same promise, so every test that depends on it reports the failure.
  const once = <A>(fn: () => Promise<A>): (() => Promise<A>) => {
    let p: Promise<A> | undefined;
    return () => (p ??= fn());
  };
  const v3_human_work = once(async () => {
    const L5 = "G6.U4.L5";
    const L4 = "G6.U4.L4";
    const blocking_kinds = (r: { details: Details }): string[] =>
      [...new Set(r.details.issues.filter((x) => x.level === "blocking").map((x) => x.kind))].sort();
    // L5: one excerpt slot is open human work, not a defect. WP-2 also has the generator narrow W.6.2 to the leaves a and b:
    // each is a confirmation (a person decides), reported at confirmation level beside the blocking slot.
    const g5 = await stored(s, L5);
    expect(await state_report(s, L5)).toMatchObject({ job_status: "ready", lesson_state: "draft", has_doc: true });
    expect(core(await issue_keys(s, L5))).toEqual([]);
    const k5 = await issue_keys(s, L5);
    expect(k5.filter((k) => kind_of(k) === "excerpt_slot_open")).toHaveLength(wp2_draft().blocks.filter((b) => b.role === "excerpt_slot").length);
    expect(standards_of(g5.lesson).filter((x) => x.origin === "narrowed").map((x) => x.code)).toEqual(["W.6.2.a", "W.6.2.b"]);
    expect(observed_evidence(g5.lesson)).toEqual(expected_evidence(wp2_draft()));
    await start_review(s, L5);
    const r1 = await submit(s, L5, "strict");
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.code).toBe("BLOCKED");
    expect(blocking_kinds(r1)).toEqual(["excerpt_slot_open"]);

    const slot5 = authority_of(g5.lesson).slots.find((x) => x.type === "excerpt_slot")!.slot_id!;
    const fill5 = (rights_status: string) =>
      s.slots.fill(s.user("reviewer"), L5 as never, slot5, { text: "Soongoora told a lie about the honey.", source_ref: { title: "Zanzibar Tales" }, rights_status } as never);
    await fill5("to-clear");
    const g5b = await stored(s, L5);
    expect(g5b.content_hash).not.toBe(g5.content_hash);
    await settle(s);
    const k5b = (await issue_keys(s, L5)).map(kind_of);
    expect(k5b).not.toContain("excerpt_slot_open");
    expect(k5b).toContain("rights_to_clear"); // source supplied, rights pending: a different state from an open slot
    expect(core(await issue_keys(s, L5))).toEqual([]);
    const r2 = await submit(s, L5, "strict");
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.code).toBe("BLOCKED");
    expect(blocking_kinds(r2)).toEqual(["rights_to_clear"]);
    await fill5("public-domain");
    const g5c = await stored(s, L5);
    expect(g5c.content_hash).not.toBe(g5b.content_hash);
    await settle(s);
    expect((await issue_keys(s, L5)).map(kind_of)).not.toContain("rights_to_clear");
    expect(core(await issue_keys(s, L5))).toEqual([]);
    const f5 = fingerprint(g5c.lesson), f5g = fingerprint(g5.lesson);
    expect(f5.authority).not.toEqual(f5g.authority);
    expect({ ...f5, authority: null }).toEqual({ ...f5g, authority: null });
    // Only the confirmations are left: the refusal changes from BLOCKED to CONFIRMATION_OPEN.
    const r3 = await submit(s, L5, "strict");
    expect(r3.ok).toBe(false);
    if (r3.ok) return;
    expect(r3.code).toBe("CONFIRMATION_OPEN");
    for (const code of ["W.6.2.a", "W.6.2.b"]) {
      expect((await s.issues.decide_standard(s.user("reviewer"), L5 as never, { code, decision: "confirm" } as never)).status).toBe("confirmed");
      await settle(s); // the next decision reads the alignment rows of the NEWEST stored hash, which the background lane writes
    }
    const g5d = await stored(s, L5);
    expect(observed_evidence(g5d.lesson)).toEqual(observed_evidence(g5.lesson));
    expect(standards_of(g5d.lesson).filter((x) => x.origin === "narrowed").map((x) => x.confirmation)).toEqual(["confirmed", "confirmed"]);

    // L4 (repaired once): its human-work set is exactly what the repaired draft declares.
    const g4 = await stored(s, L4);
    const [job4] = await s.world.query<{ repairs: number }>("select repairs from lesson_job where lesson_id=$1 and kind='lesson' order by queued_at desc limit 1", [L4]);
    expect(job4!.repairs).toBe(1);
    expect(gating(await issue_keys(s, L4))).toEqual([]);
    // WP-1's stub draft lists more vocabulary than the cap: one advisory, the same at every stage (assert_parity), never a blocker.
    expect(core(await issue_keys(s, L4))).toEqual(["vocabulary_over_cap|advisory|G6.U4.L4.FrontMatter|"]);
    await assert_parity(s, L4, g4.content_hash, ["generation"]);
    const d4 = wp1_draft();
    const human = (await issue_keys(s, L4)).map(kind_of).filter((k) => HUMAN_WORK.has(k) && k !== "standard_confirmation");
    const expected_human = [
      ...d4.blocks.filter((b) => b.role === "text_evidence_needed").map(() => "quote_placeholder_open"),
      ...d4.blocks.filter((b) => b.role === "excerpt_slot").map(() => "excerpt_slot_open"),
      "cross_lesson_link",
    ].sort();
    expect(human.sort()).toEqual(expected_human);
    expect(observed_evidence(g4.lesson)).toEqual(expected_evidence(d4));
    expect(structure_of(g4.lesson)).toEqual([
      { section: "Launch", minutes: 5, parts: [] }, { section: "Literacy Lab", minutes: 10, parts: [] },
      { section: "Learning in Action", minutes: 30, parts: ["Part A", "Part B"] }, { section: "Look Back", minutes: 5, parts: [] },
      { section: "Homework", minutes: 0, parts: [] },
    ]);
    await start_review(s, L4);
    const slots4 = authority_of(g4.lesson).slots;
    const ph = slots4.find((x) => x.type === "quote_placeholder")!.slot_id!;
    const ex = slots4.find((x) => x.type === "excerpt_slot")!.slot_id!;
    await s.slots.fill(s.user("reviewer"), L4 as never, ph, { text: "Percy sounds sarcastic about his teachers.", source_ref: { title: "The Lightning Thief", pages: "pp. 1-8" }, rights_status: "short-quote-commentary" } as never);
    await s.slots.fill(s.user("reviewer"), L4 as never, ex, { text: "The hare outwitted the lion.", source_ref: { title: "The Hare and the Lion" }, rights_status: "public-domain" } as never);
    await settle(s);
    const g4b = await stored(s, L4);
    const k4 = await issue_keys(s, L4);
    expect(gating(k4)).toEqual([]);
    expect(k4.map(kind_of)).not.toContain("quote_placeholder_open");
    expect(k4.map(kind_of)).not.toContain("excerpt_slot_open");
    expect(k4.map(kind_of)).toContain("cross_lesson_link");
    // The waiting phase: slot filled, source lesson not yet approved. Not "waits on an empty slot".
    const waiting = await s.world.query<{ message: string }>("select message from issue where lesson_id=$1 and kind='cross_lesson_link' and content_hash=$2", [L4, g4b.content_hash]);
    expect(waiting.map((w) => w.message).join(" ")).toMatch(new RegExp(`Waiting for ${L5}`, "i"));
  });
  it("V3.human_work_then_dependency_order", v3_human_work, T);

  // R-F3-7 (fixed): the waiting phase (slot filled, source not yet approved) passes Submit; Approve refuses DEPENDENCY_UNAPPROVED.
  const v3_waiting_submit = once(async () => {
    await v3_human_work();
    const sub4 = await submit(s, "G6.U4.L4", "strict");
    expect(sub4.ok, JSON.stringify(sub4)).toBe(true);
    return sub4.ok ? sub4.result.version : null;
  });
  it("V3.waiting_phase_submit_passes_per_gates_contract", async () => {
    await v3_waiting_submit();
  }, T);

  it("V3.dependency_order_to_export", async () => {
    const submitted_l4 = await v3_waiting_submit();
    const L5 = "G6.U4.L5";
    const L4 = "G6.U4.L4";
    const d4 = wp1_draft();
    const g4b = await stored(s, L4);
    const g5d = await stored(s, L5);
    // The strict gate lets the waiting phase through (R-F3-7); approval's own dependency gate then refuses it.
    expect(submitted_l4, "the waiting-phase submit of L4 returned a version").not.toBeNull();
    const early = await approve(s, L4, submitted_l4!);
    expect(early.ok).toBe(false);
    if (early.ok) return;
    expect(early.code).toBe("DEPENDENCY_UNAPPROVED");
    expect(early.details.source_lesson_ids).toContain(L5);
    expect((await state_report(s, L4)).lesson_state).toBe("submitted");

    const sub5 = await submit(s, L5, "strict");
    expect(sub5.ok, JSON.stringify(sub5)).toBe(true);
    if (!sub5.ok) return;
    expect((await approve(s, L5, sub5.result.version)).ok).toBe(true);
    const late = await approve(s, L4, submitted_l4!);
    expect(late.ok, JSON.stringify(late)).toBe(true);
    expect((await state_report(s, L4)).lesson_state).toBe("approved");
    await settle(s);

    const { created, file } = await export_bundle(s, "G6.U4");
    expect(created.held_back).toEqual([]);
    for (const [id, draft, snap] of [[L4, d4, g4b], [L5, wp2_draft(), g5d]] as const) {
      const item = file.lessons.find((l) => l.lesson_id === id)!;
      expect(item.content_hash).toBe(snap.content_hash);
      expect(fingerprint(item.lesson)).toEqual(fingerprint(snap.lesson));
      expect(observed_evidence(item.lesson)).toEqual(expected_evidence(draft)); // survived human edits, a submit and an approval
    }
  }, T);

  // R-F3-9 (fixed): alignment_link is keyed on the role too (migration 0016), so a code taught and checked at one address completes.
  it("V2.real_check_runner_completes_taught_and_checked_code", async () => {
    const id = FLEX_A;
    const doc = await stored(s, id);
    const [d] = await s.world.query<{ store_id: string }>("select store_id from lesson_doc where lesson_id=$1 order by seq desc limit 1", [id]);
    const rd = { db: s.world.db, ids: s.world.deps.ids, clock: s.world.deps.clock };
    await s.world.db.with_tx((tx) => new PgCheckQueue(rd).enqueue(id as never, doc.content_hash as never, d!.store_id as never, tx));
    try {
      expect(await s.check_runner.run_once()).not.toBeNull();
    } finally {
      await s.world.query("delete from check_job where lesson_id=$1", [id]);
    }
  }, T);
});
