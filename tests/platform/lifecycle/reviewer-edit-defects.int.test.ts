// Lifecycle cases E1..E4: a reviewer edit introduces (or removes) something after a clean generation. The edit is a typed edit
// through the collab store (the save path), a web service decision or a slot fill; the finding must appear in the background
// check, block submit and block approve with the same key. Oracles are written from the draft and the worked pairs
// (docs/data/worked-pairs.md WP-1, WP-3), never from the production tag codec.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalize_outline } from "@ls/core/intake/normalize";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { lesson_of, plan_for, text, AUTHOR } from "../../../apps/worker/test/support/world.ts";
import { load_issued_grid } from "../../../packages/core/tests/fixtures/outline/index.ts";
import {
  append_to_heading, approve, assert_parity, delete_paragraph, generate, hashes, issue_keys, issue_rows, settle, start_review, state_report,
  stored, submit, typed_edit,
} from "./actions.ts";
import { flex_draft, wp1_draft, wp1_first_draft } from "./drafts.ts";
import { core, expected_evidence, gating, headings_of, kind_of, key_of, observed_evidence, standards_of } from "./evidence.ts";
import type { Details } from "./actions.ts";
import { LifecycleStack } from "./stack.ts";

const T = 300_000;
const F2A = "G6.U4.FLEX-2a";
const F2B = "G6.U4.FLEX-2b";
const F3A = "G6.U4.FLEX-3a";
const L4 = "G6.U4.L4";
let s: LifecycleStack;

beforeAll(async () => {
  s = await LifecycleStack.open((w) => {
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    const drafts: Record<string, unknown> = {
      [F2A]: flex_draft(F2A, "no_standards"), [F2B]: flex_draft(F2B, "no_standards"), [F3A]: flex_draft(F3A, "no_standards"), [L4]: wp1_first_draft(),
    };
    w.stub.script("GENERATION", "lesson_draft", (req) => text(drafts[lesson_of(req)]));
    w.stub.script("REPAIR", "lesson_draft", () => text(wp1_draft()));
  });
  await generate(s, [45, 46, 8, 55], "strict");
  await settle(s);
}, T);
afterAll(async () => {
  await s?.close();
});

const issue_codes = (r: { details: Details }, kind: string): Array<string | null> =>
  r.details.issues.filter((i) => i.kind === kind).map((i) => i.code);

describe("reviewer edits are held to the same contract as generation", () => {
  it("E1.bogus_tag_on_empty_focus_row_*", async () => {
    const id = F2A;
    const base = await stored(s, id);
    expect(await state_report(s, id)).toMatchObject({ job_status: "ready", lesson_state: "draft", blocking_kinds: [] });
    expect(core(await issue_keys(s, id))).toEqual([]);
    expect(standards_of(base.lesson)).toEqual([]);
    await start_review(s, id);

    const launch = base.lesson.sections.find((x) => x.name === "Launch")!;
    const heading = headings_of(base.lesson).find((h) => h.section === "Launch")!;
    const ack = await typed_edit(s, id, (doc) => append_to_heading(doc, launch.address, heading.text, " (RL.9.9)"));
    expect(ack.check_job_enqueued).toBe(true);
    expect(ack.content_hash).not.toBe(base.content_hash);
    expect(ack.seq).toBe(2);
    await settle(s);

    const edited = await stored(s, id);
    expect(edited.content_hash).toBe(ack.content_hash);
    const key = `code_not_allowed|blocking|${launch.address}|RL.9.9`;
    const keys = await issue_keys(s, id);
    expect(keys, keys.join("\n")).toContain(key);
    const row = (await issue_rows(s, id)).find((r) => r.kind === "code_not_allowed")!;
    expect(row.message).toContain("official standards list"); // the catalogue has no RL.9.9
    // The typed edit is the only source of the tag.
    const extra = observed_evidence(edited.lesson).filter((e) => !expected_evidence(flex_draft(id, "no_standards")).includes(e));
    expect(extra).toEqual(["teach|RL.9.9|Launch"]);

    const strict = await submit(s, id, "strict");
    expect(strict.ok).toBe(false);
    if (strict.ok) return;
    expect(strict.code).toBe("BLOCKED");
    expect(issue_codes(strict, "code_not_allowed")).toEqual(["RL.9.9"]);
    expect((await state_report(s, id)).lesson_state).toBe("in_review");

    const legacy = await submit(s, id, "legacy"); // an older gate without the rule
    expect(legacy.ok, JSON.stringify(legacy)).toBe(true);
    if (!legacy.ok) return;
    const app = await approve(s, id, legacy.result.version);
    expect(app.ok).toBe(false);
    if (app.ok) return;
    expect(app.code).toBe("BLOCKED");
    expect(issue_codes(app, "code_not_allowed")).toEqual(["RL.9.9"]);
    expect((await state_report(s, id)).lesson_state).toBe("submitted");
    // Generation never saw this hash (a reviewer made it), so the generation comparison is skipped by design.
    await assert_parity(s, id, edited.content_hash, ["submit", "approve"]);
  }, T);

  it("E2.removed_teaching_text_*", async () => {
    const id = L4;
    const base = await stored(s, id);
    expect(gating(await issue_keys(s, id))).toEqual([]); // control: nothing is wrong before the deletion
    expect(observed_evidence(base.lesson)).toEqual(expected_evidence(wp1_draft()));
    await start_review(s, id);

    const lia = base.lesson.sections.find((x) => x.name === "Learning in Action")!;
    const para = /Say: Compare what the narrator says/; // WP-1 B: the Part B teacher move under "Central Idea (RL.6.2)"
    const ack = await typed_edit(s, id, (doc) => delete_paragraph(doc, lia.address, "Say: Compare what the narrator says"));
    expect(ack.content_hash).not.toBe(base.content_hash);
    expect(JSON.stringify((await stored(s, id)).lesson)).not.toMatch(para);
    await settle(s);

    const edited = await stored(s, id);
    const key = `standard_not_taught|blocking|${id}.FrontMatter|RL.6.2`;
    const keys = await issue_keys(s, id);
    expect(keys, keys.join("\n")).toContain(key);
    // The heading tag is still there: the finding comes from the missing teaching text, not from the tag.
    expect(observed_evidence(edited.lesson)).toContain("teach|RL.6.2|Learning in Action");

    const strict = await submit(s, id, "strict");
    expect(strict.ok).toBe(false);
    if (strict.ok) return;
    expect(strict.code).toBe("BLOCKED");
    expect(issue_codes(strict, "standard_not_taught")).toEqual(["RL.6.2"]);
    const shown = (strict.details.issues as Array<{ kind: string; level: string; address: string | null; code: string | null }>).map(key_of);
    expect(core(shown)).toEqual(gating(keys)); // the refusal lists the same core findings as the background check
    const legacy = await submit(s, id, "legacy");
    expect(legacy.ok, JSON.stringify(legacy)).toBe(true);
    if (!legacy.ok) return;
    const app = await approve(s, id, legacy.result.version);
    expect(app.ok).toBe(false);
    if (app.ok) return;
    expect(app.code).toBe("BLOCKED");
    expect(issue_codes(app, "standard_not_taught")).toEqual(["RL.6.2"]);
    await assert_parity(s, id, edited.content_hash, ["submit", "approve"]);
  }, T);

  // R-F3-8 (fixed): the background check writes the lesson's own alignment rows before it loads the unit coverage arc_repeat reads.
  it("E2.advisory_findings_equal_across_stages", async () => {
    const st = await stored(s, L4);
    await assert_parity(s, L4, st.content_hash, ["submit", "approve"]);
  }, T);

  it("E3.reviewer_added_valid_code_is_a_confirmation", async () => {
    const id = F2B;
    await start_review(s, id);
    const done = await s.issues.decide_standard(s.user("reviewer"), id as never, { code: "RL.6.7", decision: "add" } as never);
    expect(done.status).toBeDefined();
    await settle(s);
    const lesson = (await stored(s, id)).lesson;
    const std = standards_of(lesson).find((x) => x.code === "RL.6.7")!;
    expect(std).toMatchObject({ origin: "added", confirmation: "open" });
    const keys = await issue_keys(s, id);
    expect(keys.map(kind_of)).toContain("standard_confirmation");
    expect(keys.map(kind_of)).not.toContain("code_not_allowed"); // a valid proposed addition is not an invalid code
    expect(keys.some((k) => k.startsWith("standard_confirmation|confirmation|") && k.endsWith("|RL.6.7"))).toBe(true);
    const r = await submit(s, id, "strict");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CONFIRMATION_OPEN");
  }, T);

  it("E4.pinned_context_survives_a_later_outline_upload", async () => {
    const id = F3A;
    const base = await stored(s, id);
    const k0 = await issue_keys(s, id);
    expect(core(k0)).toEqual([]);

    // A second outline version of the same unit that gives this row a focus code.
    const rd = { db: s.world.db, ids: s.world.deps.ids, clock: s.world.deps.clock };
    const outlines = new PgOutlineRepo(rd);
    const outline = normalize_outline(load_issued_grid(), load_standards_index(), 200);
    const outline2 = { ...outline, rows: outline.rows.map((r) => (r.lesson_id === id ? { ...r, focus_codes: ["RL.6.1"] } : r)) };
    const v2 = await s.world.db.with_tx((tx) =>
      outlines.insert_version({ unit_id: "G6.U4", sha256: "c".repeat(64), source_kind: "upload_csv", source_name: "reupload.csv", uploaded_by: AUTHOR }, outline2 as never, compute_lesson_links(outline2.rows as never), tx));
    // Non-vacuous control: the newest version really changes what a "latest outline" lookup would see.
    const latest = await outlines.row_context(v2.outline_version_id, id as never, null);
    expect(latest.row.focus_codes).toEqual(["RL.6.1"]);

    // Re-check the same stored hash.
    const [doc] = await s.world.query<{ store_id: string }>("select store_id from lesson_doc where lesson_id=$1 order by seq desc limit 1", [id]);
    await s.world.db.with_tx((tx) => new PgCheckQueue(rd).enqueue(id as never, base.content_hash as never, doc!.store_id as never, tx));
    await settle(s);
    expect(await issue_keys(s, id)).toEqual(k0); // the run's pinned row is still used: no standard_not_taught for RL.6.1
    expect(await hashes(s, id)).toMatchObject({ docs: [{ seq: 1, content_hash: base.content_hash }] });

    await start_review(s, id);
    const sub = await submit(s, id, "strict");
    expect(sub.ok, JSON.stringify(sub)).toBe(true);
    if (!sub.ok) return;
    const app = await approve(s, id, sub.result.version);
    expect(app.ok, JSON.stringify(app)).toBe(true);
    await assert_parity(s, id, base.content_hash, ["generation", "submit", "approve"]);
  }, T);
});
