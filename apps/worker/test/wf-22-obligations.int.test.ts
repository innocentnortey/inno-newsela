// NL-79 AC-11 / AC-12: the obligations WF-22 (and WF-21) inherit, each driven through the records a real claim-loop run wrote.
// One WP-1 run (row 8, repair path) and one WP-2 run (row 9). Titles start with the obligation id; AC-12 ids carry [AC-12].
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RULE_GROUPS } from "@ls/core/checks/registry";
import { DomainRefusal } from "@ls/core/errors";
import { MARK_NAMES, NODE_NAMES } from "@ls/editor-schema/schema";
import { StoredLesson } from "@ls/schema/lesson";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { safety_source_rows } from "../src/generation/nodes/store-node.ts";
import { SYSTEM_ACTOR } from "../src/generation/nodes/job-state.ts";
import { lesson_of, load_fixture, make_world, plan_for, text, World } from "./support/world.ts";

const REPO = new URL("../../../", import.meta.url).pathname;
const L4 = "G6.U4.L4";
const L5 = "G6.U4.L5";
let w: World;
let run4 = "";
let run5 = "";
const tiles: string[] = [];
let sampler: ReturnType<typeof setInterval>;
const wp1 = load_fixture("wp-1.json");
const wp2 = load_fixture("wp-2.json");

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
async function stored(lesson: string): Promise<StoredLesson> {
  const [r] = await w.query<{ derived_json: unknown }>("select derived_json from lesson_doc where lesson_id=$1 order by seq desc limit 1", [lesson]);
  return StoredLesson.parse(r!.derived_json);
}
const all_strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => all_strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => all_strings(x, out));
  return out;
};
const node_types = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => node_types(x, out));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["type"] === "string") out.push(o["type"]);
    Object.values(o).forEach((x) => node_types(x, out));
  }
  return out;
};

/** Node and mark types of ProseMirror JSON: follows `content` and `marks` only, so attrs such as a list's type are not read. */
function pm_types(n: unknown, out: string[] = []): string[] {
  if (n && typeof n === "object") {
    const o = n as { type?: unknown; content?: unknown[]; marks?: unknown[] };
    if (typeof o.type === "string") out.push(o.type);
    for (const k of [...(o.content ?? []), ...(o.marks ?? [])]) pm_types(k, out);
  }
  return out;
}

beforeAll(async () => {
  w = await make_world();
  w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
  w.stub.script("GENERATION", "lesson_draft", (req) => text(lesson_of(req) === L4 ? wp1.first_draft : wp2.draft));
  w.stub.script("REPAIR", "lesson_draft", () => text(wp1.draft));
  run4 = await w.start_run([8]);
  run5 = await w.start_run([9]);
  sampler = setInterval(() => {
    void w.query<{ tile_state: string }>("select tile_state from lesson_job where run_id=$1 and kind='lesson'", [run4]).then((r) => {
      const t = r[0]?.tile_state;
      if (t && tiles[tiles.length - 1] !== t) tiles.push(t);
    }, () => undefined);
  }, 5);
  const done = async (): Promise<boolean> => (await w.run_finished(run4)) && (await w.run_finished(run5));
  expect(await w.drive_until(done, 90_000)).toBe(true);
  clearInterval(sampler);
  expect((await w.run_checks_for()).length).toBe(2);
}, 120_000);
afterAll(async () => {
  clearInterval(sampler);
  await w?.close();
});

describe("WF-22 obligations", () => {
  it("R-6: split cell kinds are kept and outline text reaches the model only in labelled data blocks", async () => {
    const ov = w.outline_version_id;
    const outlines = new PgOutlineRepo({ db: w.db, ids: new PrefixedIdGenerator(), clock: new SystemClock() });
    const kinds = new Set<string>();
    for (const id of [L4, L5]) for (const s of (await outlines.row_context(ov, id, null)).row.segments) kinds.add(s.kind);
    expect(kinds.has("editor_note")).toBe(true);
    expect(kinds.has("writer_task")).toBe(true);
    const drafts = w.stub.calls.filter((c) => c.output_schema_name === "LessonDraft" && c.alias === "GENERATION");
    expect(drafts.length).toBeGreaterThan(0);
    for (const c of drafts) {
      const mentioning = c.user_blocks.filter((b) => b.text.includes("OUTLINE_DATA"));
      expect(mentioning.length).toBeGreaterThan(0);
      expect(mentioning.every((b) => b.label === "data")).toBe(true);
      expect(c.system_blocks.some((b) => b.text.includes("OUTLINE_DATA kind=segment"))).toBe(false);
    }
  });

  it("R-9 [registry obligation, not a behaviour check: the world filters gate rules]: no arc rule is blocking", () => {
    expect(RULE_GROUPS.arc.length).toBeGreaterThan(0);
    expect(RULE_GROUPS.arc.filter((r) => r.level === "blocking")).toEqual([]);
  });

  it("R-11: the stored lesson parses as StoredLesson, has provenance and a non-empty Yjs state", async () => {
    for (const id of [L4, L5]) {
      await stored(id);
      const [r] = await w.query<{ n: number; p: unknown }>("select length(d.ydoc_bytes) n, v.provenance_json p from lesson_doc d join lesson_version v on v.lesson_id=d.lesson_id where d.lesson_id=$1", [id]);
      expect(r!.n).toBeGreaterThan(0);
      expect(r!.p).not.toBeNull();
    }
  });

  it("R-12: WP-2 text cards carry no content and the lesson holds no quote spans", async () => {
    const lesson = await stored(L5);
    expect(lesson.text_cards.length).toBeGreaterThan(0);
    expect(lesson.text_cards.every((c) => c.content_available === false)).toBe(true);
    expect(node_types(lesson.sections).filter((t) => /quote/.test(t))).toEqual([]);
  });

  it("R-17: the tile went drafting, checking, repairing, ready in that order", () => {
    const want = ["drafting", "checking", "repairing", "ready"];
    let at = 0;
    for (const t of tiles) if (t === want[at]) at++;
    expect(at, `saw ${tiles.join(" > ")}`).toBe(want.length);
  });

  it("R-20: every alignment link records its origin and who asserted it", async () => {
    const rows = await w.query<{ origin: string | null; asserted_by: string | null }>("select origin, asserted_by from alignment_link");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !!r.origin && !!r.asserted_by)).toBe(true);
  });

  it("R-21: section addresses follow the lesson-id scheme", async () => {
    const lesson = await stored(L4);
    expect(lesson.sections.length).toBeGreaterThan(0);
    for (const s of lesson.sections) expect(s.address).toMatch(/^G6\.U4\.L4\.(Launch|LiteracyLab|LearningInAction|LookBack|Homework)$/);
  });

  it("R-54 [AC-12]: a reviewer cannot start a run, and no run row is written", async () => {
    const before = (await w.query("select 1 from run")).length;
    const err = await w.start_run([8], 13, "reviewer").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainRefusal);
    expect((err as DomainRefusal).code).toBe("ROLE_FORBIDDEN");
    expect((await w.query("select 1 from run")).length).toBe(before);
  });

  it("R-58: markup-looking model text is stored as literal text", async () => {
    const inj = "<img src=x onerror=alert(1)>";
    // A second, rules-free world: only the schema and compile gate the draft.
    const x = await make_world({ rules: [] });
    try {
      const bad = structuredClone(wp1.draft) as { blocks: Array<{ role: string; text: string }> };
      bad.blocks.find((b) => b.role === "teacher_talk")!.text = inj;
      x.stub.script("GENERATION", "unit_plan", (req) => plan_for(x.rows, req));
      x.stub.script("GENERATION", "lesson_draft", () => text(bad));
      await x.start_run([8]);
      expect(await x.drive_until(async () => (await x.query("select 1 from lesson_doc")).length > 0, 60_000)).toBe(true);
      const [r] = await x.query<{ derived_json: unknown }>("select derived_json from lesson_doc limit 1");
      const strings = all_strings(r!.derived_json);
      expect(strings.some((s) => s === inj)).toBe(true);
      // Only editor-schema node and mark types: sections hold the doc content, so the root is not counted.
      const sections = (r!.derived_json as { sections: Array<{ content: unknown }> }).sections;
      for (const t of sections.flatMap((x) => pm_types(x.content))) expect([...NODE_NAMES, ...MARK_NAMES], t).toContain(t);
      expect(node_types(r!.derived_json)).not.toContain("img");
      expect(node_types(r!.derived_json)).not.toContain("html");
    } finally {
      await x.close();
    }
  }, 90_000);

  it("GR-1: WP-2 holds no quotation of six words or more that the fixture does not contain, and no grounding rule blocks it", async () => {
    const lesson = await stored(L5);
    const fixture = all_strings(wp2.draft).join(" ");
    const quoted = all_strings(lesson.sections).flatMap((s) => [...s.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]!));
    for (const q of quoted) if (q.split(/\s+/).length >= 6) expect(fixture).toContain(q);
    const open_by_design = new Set(["excerpt_slot_open", "quote_placeholder_open"]);
    const grounding_kinds = new Set(RULE_GROUPS.grounding.map((r) => r.kind));
    const blocking = await w.query<{ kind: string }>("select kind from issue where lesson_id=$1 and level='blocking'", [L5]);
    expect(blocking.filter((b) => grounding_kinds.has(b.kind as never) && !open_by_design.has(b.kind))).toEqual([]);
  });

  it("GR-4: every alignment link has an origin and no lesson text claims to be standards-aligned", async () => {
    expect(await w.query("select 1 from alignment_link where origin is null or origin=''")).toEqual([]);
    for (const id of [L4, L5]) expect(all_strings((await stored(id)).sections).join(" ").toLowerCase()).not.toContain("standards-aligned");
  });

  it("GR-5 [AC-12]: front-matter standards carry the official text, not the sheet label", async () => {
    for (const id of [L4, L5]) {
      const lesson = await stored(id);
      expect(lesson.front_matter.standards.length).toBeGreaterThan(0);
      for (const s of lesson.front_matter.standards) {
        const [row] = await w.query<{ text: string }>("select text from standard where code=$1", [s.code]);
        expect(s.official_text).toBe(row!.text);
      }
    }
  });

  it("GR-9: restricted source is git-ignored and nothing in the worker tests or wiring names it", () => {
    expect(spawnSync("git", ["check-ignore", "docs/source/" + "restricted/x"], { cwd: REPO }).status).toBe(0);
    const needle = "source/" + "restricted";
    const own = [...files(join(REPO, "apps/worker/test")), join(REPO, "apps/worker/src/wiring/generation.ts"), join(REPO, "apps/worker/src/wiring/generation.int.test.ts")];
    for (const f of own) expect(readFileSync(f, "utf8").includes(needle), f).toBe(false);
  });

  it("GR-10: no prompt names a provider file or vector store; provenance keeps an example_set_id key", async () => {
    const prompts = await w.query<{ rendered_prompt: string }>("select rendered_prompt from model_call");
    expect(prompts.length).toBeGreaterThan(0);
    for (const p of prompts) expect(p.rendered_prompt).not.toMatch(/file_id|vector_store/);
    for (const v of await w.query<{ provenance_json: Record<string, unknown> }>("select provenance_json from lesson_version")) expect(Object.keys(v.provenance_json)).toContain("example_set_id");
  });

  it("GR-11: the example set is empty or not drawn from the unit under test", async () => {
    for (const v of await w.query<{ provenance_json: { example_set_id: string | null } }>("select provenance_json from lesson_version")) {
      const id = v.provenance_json.example_set_id;
      expect(id === null || !id.startsWith("G6.U4")).toBe(true);
    }
  });

  it("GR-13 [AC-12]: no student or teacher-of-record column exists", async () => {
    const bad = await w.query("select table_name, column_name from information_schema.columns where table_schema='public' and column_name ~* '(student|teacher_of_record|\\ydob\\y|birth)'");
    expect(bad).toEqual([]);
  });

  it("CON-G3: the worker stores through the doc store as the system actor, never by its own insert", async () => {
    const rows = await w.query<{ stored_by: string | null; store_id: string | null }>("select stored_by, store_id from lesson_doc");
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.store_id).toBeTruthy();
      expect(r.stored_by).toBe(SYSTEM_ACTOR.user_id); // the system actor has a null user id
    }
    for (const f of files(join(REPO, "apps/worker/src"))) {
      if (f.endsWith(".test.ts")) continue;
      expect(/insert\s+into\s+lesson_doc/i.test(readFileSync(f, "utf8")), f).toBe(false);
    }
  });

  it("EV-S7: safety flags equal what the stored lessons' rows imply", async () => {
    for (const [id, row] of [[L4, 8], [L5, 9]] as const) {
      const flags = await w.query("select 1 from safety_flag where lesson_id=$1", [id]);
      expect(flags).toHaveLength(safety_source_rows(w.row(row)).length);
    }
  });

  it("EV-S9: first-pass schema-valid rate is computable from the lesson jobs", async () => {
    const [r] = await w.query<{ value: string; n: string }>("select avg((repairs=0)::int) value, count(*) n from lesson_job where kind='lesson'");
    expect(Number(r!.n)).toBeGreaterThan(0);
    expect(Number.isFinite(Number(r!.value))).toBe(true);
  });

  it("EV-R2: the run pins its prompt, every version's provenance repeats it, and every call has a row", async () => {
    const [run] = await w.query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [run4]);
    expect(run!.prompt_version_id).toBeTruthy();
    for (const v of await w.query<{ provenance_json: { prompt_version_id: string } }>("select provenance_json from lesson_version")) {
      expect(v.provenance_json.prompt_version_id).toBe(run!.prompt_version_id);
    }
    const [m] = await w.query<{ n: string }>("select count(*) n from model_call");
    expect(Number(m!.n)).toBe(w.stub.calls.length);
  });

  it("OBS-4: stored docs and queued checks carry a store id; the run.start audit row names the run", async () => {
    expect((await w.query("select 1 from lesson_doc where store_id is null or store_id=''")).length).toBe(0);
    const checks = await w.query("select 1 from check_job where store_id is null or store_id=''");
    expect(checks.length).toBe(0);
    // run.start has no store to name (RunService writes store_id null); it must still name the run it started.
    const audit = await w.query<{ target_id: string }>("select target_id from audit_event where action='run.start'");
    expect(audit.map((a) => a.target_id).sort()).toEqual([run4, run5].sort());
  });

  it("OBS-11 [AC-12, doc obligation only: greps docs and test names]: the observability table has WF-21 and WF-22, and the capture tests they name exist", () => {
    const doc = readFileSync(join(REPO, "docs/design/observability.md"), "utf8");
    expect(/^\| WF-21 \|/m.test(doc)).toBe(true);
    expect(/^\| WF-22 \|/m.test(doc)).toBe(true);
    const tests = readFileSync(join(REPO, "apps/worker/src/wiring/generation.int.test.ts"), "utf8");
    expect(tests).toContain("test_unit_plan_capture");
    expect(tests).toContain("test_lesson_job_capture");
  });
});
