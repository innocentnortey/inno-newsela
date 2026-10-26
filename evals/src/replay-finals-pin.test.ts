import { describe, expect, it } from "vitest";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { reading_lesson } from "@ls/core/checks/test-helpers";
import type { CheckContext } from "@ls/core/checks/types";
import type { RowContext } from "@ls/core/ports/outlines";
import { sha256_hex } from "./replay-finals.ts";
import { canonical_json } from "@ls/schema/content-hash";
import { PinTrace, PinnedOutlines, ReplayIdentityError, assert_same_identity, load_run_pin, pinned_graph, type RunPin } from "./replay-finals-pin.ts";
import { LESSON, OV1, OV2, ROW1, RUN_CHOICES, build_world } from "./replay-finals-world.ts";

const HASH = "h".repeat(64) as never;
function pinned_loader(w: ReturnType<typeof build_world>, trace = new PinTrace()) {
  const p = w.ports;
  return { trace, loader: new CheckContextLoader(new PinnedOutlines(p.outlines, w.pin, trace), p.standards, pinned_graph(p.graph, w.pin, trace), p.reader, p.suggestions, p.flags, p.alignment, p.clock) };
}
const lesson = () => reading_lesson({ lesson_id: LESSON });

describe("pinned context", () => {
  it("test_context_uses_pinned_outline_not_later_upload", async () => {
    const w = build_world({ later_upload: true });
    const { loader } = pinned_loader(w);
    const ctx = await loader.load(LESSON, lesson(), HASH);
    expect(ctx.outline_version_id).toBe(OV1);
    expect(ctx.row.title).toBe(ROW1.title);
    expect(ctx.allowed_codes).toEqual([...ROW1.focus_codes]);
  });
  it("test_row_context_receives_the_runs_choices_not_the_versions_stored_choices", async () => {
    const w = build_world({ later_upload: true });
    const po = new PinnedOutlines(w.ports.outlines, w.pin, new PinTrace());
    const rc = await po.row_context(OV1, LESSON, null);
    expect(w.row_context_args).toEqual([RUN_CHOICES]);
    expect(rc.choices).toEqual(RUN_CHOICES);
  });
  it("test_latest_unit_fallback_is_refused", async () => {
    const w = build_world({ later_upload: true, source_null: true });
    const trace = new PinTrace();
    // an UNPINNED graph (source null) sends the loader to list_units, which the pinned outlines must refuse
    const p = w.ports;
    const loader = new CheckContextLoader(new PinnedOutlines(p.outlines, w.pin, trace), p.standards, p.graph, p.reader, p.suggestions, p.flags, p.alignment, p.clock);
    await expect(loader.load(LESSON, lesson(), HASH)).rejects.toMatchObject({ code: "latest_unit_fallback" });
    expect(trace.latest_unit_version).toBe(OV2);
  });
  it("test_rows_of_another_version_are_refused", async () => {
    const w = build_world();
    const po = new PinnedOutlines(w.ports.outlines, w.pin, new PinTrace());
    await expect(po.rows(OV2)).rejects.toMatchObject({ code: "outline_version_mismatch" });
    await expect(po.row_context(OV2, LESSON, null)).rejects.toBeInstanceOf(ReplayIdentityError);
  });
  it("test_unsupported_methods_throw", async () => {
    const po = new PinnedOutlines(build_world().ports.outlines, build_world().pin, new PinTrace());
    for (const m of ["insert_version", "version", "choices", "upsert_choice", "mark_confirmed", "generate_gate_inputs", "links"] as const) {
      await expect((po[m] as () => Promise<unknown>)()).rejects.toMatchObject({ code: "unsupported_call" });
    }
  });
});

describe("identity assert", () => {
  async function both(w: ReturnType<typeof build_world>) {
    const { loader, trace } = pinned_loader(w);
    const node = new PinnedOutlines(w.ports.outlines, w.pin, new PinTrace());
    const node_rc = await node.row_context(OV1, LESSON, null);
    const ctx = await loader.load(LESSON, lesson(), HASH);
    return { node_rc, ctx, trace };
  }
  it("test_same_identity_assert_throws_when_loader_follows_a_different_version", async () => {
    const w = build_world();
    const { node_rc, ctx, trace } = await both(w);
    expect(() => assert_same_identity(node_rc, { ...ctx, outline_version_id: OV2 } as CheckContext, trace, w.pin)).toThrowError(expect.objectContaining({ code: "outline_version_mismatch" }));
    expect(() => assert_same_identity({ ...node_rc, row_hash: "x".repeat(64) } as RowContext, ctx, trace, w.pin)).toThrowError(expect.objectContaining({ code: "row_mismatch" }));
    expect(() => assert_same_identity(node_rc, { ...ctx, row: { ...ctx.row, title: "other" } } as CheckContext, trace, w.pin)).toThrowError(expect.objectContaining({ code: "row_mismatch" }));
  });
  it("test_identity_trace_reports_what_unpinned_production_would_have_used", async () => {
    for (const later of [true, false]) {
      const w = build_world({ later_upload: later });
      const { node_rc, ctx, trace } = await both(w);
      await new PinnedOutlines(w.ports.outlines, w.pin, trace).probe_latest();
      const id = assert_same_identity(node_rc, ctx, trace, w.pin);
      expect(id.unpinned_would_differ).toBe(later);
      expect(id.loader_outline_version).toBe(OV1);
    }
  });
});

describe("load_run_pin", () => {
  const sorted_hash = (xs: { finding_id: string }[]) => sha256_hex(canonical_json([...xs].sort((a, b) => (a.finding_id < b.finding_id ? -1 : 1))));
  const run = (choices_hash: string) => ({ outline_version_id: OV1, unit_id: "G6.U4", choices_hash, prompt_version_id: "pv", created_at: new Date("2026-10-26T01:02:03.000Z") });
  const deps = (r: ReturnType<typeof run> | null, parsed = RUN_CHOICES as never, raw: unknown = []) => ({
    runs: { async get() { return r; }, async pinned_choices() { return parsed; } },
    prompts: { async get() { return { locked_hash: "lh" }; } },
    async raw_choices_json() { return raw; },
  });
  it("test_load_run_pin_accepts_matching_hash", async () => {
    const pin: RunPin = await load_run_pin(deps(run(sorted_hash(RUN_CHOICES))), "run_1");
    expect(pin).toMatchObject({ outline_version_id: OV1, choices_hash_basis: "parsed", prompt_locked_hash: "lh", created_at: "2026-10-26T01:02:03.000Z" });
  });
  it("test_load_run_pin_falls_back_to_raw_json_hash", async () => {
    const raw = [{ finding_id: "f9", extra: 1 }];
    const pin = await load_run_pin(deps(run(sorted_hash(raw)), RUN_CHOICES as never, raw), "run_1");
    expect(pin.choices_hash_basis).toBe("raw_json");
  });
  it("test_load_run_pin_stops_on_hash_mismatch", async () => {
    await expect(load_run_pin(deps(run("0".repeat(64))), "run_1")).rejects.toMatchObject({ code: "choices_hash_mismatch" });
  });
  it("test_load_run_pin_stops_when_run_missing", async () => {
    await expect(load_run_pin(deps(null), "run_1")).rejects.toMatchObject({ code: "run_not_found" });
  });
});
