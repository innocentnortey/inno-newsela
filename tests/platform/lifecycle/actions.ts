// User-level actions over a LifecycleStack: generate, settle checks, typed edit, submit, approve, export, state report, and the
// cross-stage parity assertion. Every action goes through the real service the product uses for it.
import * as Y from "yjs";
import { expect } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import type { LessonId } from "@ls/core/ports/common";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { StoredLesson } from "@ls/schema/lesson";
import { wire_generation } from "../../../apps/worker/src/wiring/generation.ts";
import { REVIEWER } from "../../../apps/worker/test/support/world.ts";
import { GENERATION_SUPPRESSED, core, key_of, kind_of, type Key } from "./evidence.ts";
import type { LifecycleStack } from "./stack.ts";

export async function generate(s: LifecycleStack, rows: number[], mode: "strict" | "legacy"): Promise<string> {
  const run_id = await s.world.start_run(rows);
  // legacy = a worker build that accepted drafts the current rules reject: the draft is still compiled and schema-checked.
  const loop = mode === "strict" ? s.world.loop : wire_generation(s.world.deps, { prices: s.world.opts.prices!, rules: [] }).claim_loop;
  expect(await s.world.drive_until(() => s.world.run_finished(run_id), 120_000, loop)).toBe(true);
  return run_id;
}

/** Runs the real background check runner until its queue is empty. */
export async function settle(s: LifecycleStack): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await s.check_runner.run_once();
    const [r] = await s.world.query<{ n: number }>("select count(*)::int n from check_job where status in ('queued','running')");
    if (r!.n === 0) return;
  }
  const rows = await s.world.query("select lesson_id, status, attempts from check_job where status in ('queued','running')").catch(() => []);
  throw new Error("check_job queue did not drain in 50 rounds: " + JSON.stringify(rows) + " " + s.world.lines.filter((l) => /check\./.test(l)).slice(-3).join("\n"));
}

export async function stored(s: LifecycleStack, id: string): Promise<{ seq: number; content_hash: string; lesson: StoredLesson }> {
  const [r] = await s.world.query<{ seq: number; content_hash: string; derived_json: unknown }>(
    "select seq, content_hash, derived_json from lesson_doc where lesson_id=$1 order by seq desc limit 1", [id]);
  if (r === undefined) throw new Error("no stored doc for " + id);
  return { seq: Number(r.seq), content_hash: r.content_hash, lesson: StoredLesson.parse(r.derived_json) };
}

export async function issue_rows(s: LifecycleStack, id: string, hash?: string) {
  const h = hash ?? (await stored(s, id)).content_hash;
  return s.world.query<{ kind: string; level: string; address: string | null; code: string | null; message: string }>(
    "select kind, level, address, code, message from issue where lesson_id=$1 and content_hash=$2 order by kind, address, code", [id, h]);
}
export async function issue_keys(s: LifecycleStack, id: string, hash?: string): Promise<Key[]> {
  return (await issue_rows(s, id, hash)).map(key_of).sort();
}

interface DirectHost { openDirectConnection(name: string, ctx: unknown): Promise<{ document: Y.Doc | null; transact(fn: () => void): Promise<void>; disconnect(): Promise<void> }> }
const next_id = (s: LifecycleStack): string => s.user("reviewer").request_id as string;

// Simulates the reviewer typing and the collab save path. It is the same persistence.store call the debounced onStoreDocument
// makes (apps/collab/src/wiring/server.ts); the websocket and its write guard are skipped, the store is not.
export async function typed_edit(s: LifecycleStack, id: string, mutate: (doc: Y.Doc) => void) {
  const request_id = next_id(s);
  s.handler.deps.frozen.seed(id as never, "in_review");
  const actor = { user_id: REVIEWER, name: REVIEWER, role: "reviewer", synthetic: true };
  const conn = await (s.handler.deps.hocuspocus.hocuspocus as unknown as DirectHost).openDirectConnection("lesson:" + id, { actor, tag: "typed", request_id });
  try {
    await conn.transact(() => mutate(conn.document as Y.Doc));
    const ack = await s.handler.deps.persistence.store("lesson:" + id, Y.encodeStateAsUpdate(conn.document as Y.Doc), REVIEWER as never, request_id);
    expect(ack).not.toBeNull();
    return ack!;
  } finally {
    await conn.disconnect();
  }
}

export function plain(el: Y.XmlElement | Y.XmlText): string {
  if (el instanceof Y.XmlText) return (el.toDelta() as Array<{ insert?: unknown }>).map((d) => (typeof d.insert === "string" ? d.insert : "")).join("");
  return el.toArray().map((c) => (c instanceof Y.XmlElement || c instanceof Y.XmlText ? plain(c) : "")).join("");
}
export interface Found { parent: Y.XmlFragment | Y.XmlElement; index: number; el: Y.XmlElement }
export function find_el(root: Y.XmlFragment | Y.XmlElement, pred: (el: Y.XmlElement) => boolean): Found | null {
  for (let i = 0; i < root.length; i++) {
    const c = root.get(i);
    if (c instanceof Y.XmlElement) {
      if (pred(c)) return { parent: root, index: i, el: c };
      const inner = find_el(c, pred);
      if (inner !== null) return inner;
    }
  }
  return null;
}
/** Appends `suffix` to the first routine_heading of a section whose text starts with `label_prefix`. */
export function append_to_heading(doc: Y.Doc, section_address: string, label_prefix: string, suffix: string): void {
  const hit = find_el(doc.getXmlFragment("section:" + section_address), (e) => e.nodeName === "routine_heading" && plain(e).startsWith(label_prefix));
  if (hit === null) throw new Error(`no routine_heading starting "${label_prefix}" in ${section_address}`);
  const t = hit.el.get(hit.el.length - 1);
  if (!(t instanceof Y.XmlText)) throw new Error("heading has no text node");
  t.insert(t.length, suffix);
}
export function delete_paragraph(doc: Y.Doc, section_address: string, starts_with: string): void {
  const hit = find_el(doc.getXmlFragment("section:" + section_address), (e) => e.nodeName === "paragraph" && plain(e).startsWith(starts_with));
  if (hit === null) throw new Error(`no paragraph starting "${starts_with}" in ${section_address}`);
  hit.parent.delete(hit.index, 1);
}

async function state_vector(s: LifecycleStack, id: string): Promise<string> {
  const d = await new PgLessonDocReader({ db: s.world.db }).latest(id as LessonId);
  if (d === null) throw new Error("no doc");
  return d.state_vector as string;
}

export interface Details { issues: Array<{ kind: string; level: string; address: string | null; code: string | null; message?: string }>; source_lesson_ids: string[] }
export type Outcome<T> = { ok: true; result: T } | { ok: false; code: string; details: Details };
async function guarded<T>(fn: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, result: await fn() };
  } catch (e) {
    if (e instanceof DomainRefusal) return { ok: false, code: e.code, details: e.details as unknown as Details };
    throw e;
  }
}

export async function start_review(s: LifecycleStack, id: string) {
  return s.transitions.transition(s.user("reviewer"), id as never, { action: "start_review" } as never);
}
export async function submit(s: LifecycleStack, id: string, via: "strict" | "legacy") {
  const svc = via === "strict" ? s.transitions : s.transitions_legacy;
  const client_state_vector = await state_vector(s, id);
  return guarded(() => svc.transition(s.user("reviewer"), id as never, { action: "submit", client_state_vector } as never));
}
export async function approve(s: LifecycleStack, id: string, snap: { content_hash: string; state_vector: string }) {
  return guarded(() => s.transitions.transition(s.user("approver"), id as never, {
    action: "approve", snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector, rating: "usable_with_edits",
  } as never));
}
export async function export_bundle(s: LifecycleStack, unit: string) {
  const created = await s.exports.create(s.user("approver"), unit);
  const file = await s.exports.download(s.user("approver"), created.export_id);
  return { created, file };
}

export async function state_report(s: LifecycleStack, id: string) {
  const [job] = await s.world.query<{ status: string }>("select status from lesson_job where lesson_id=$1 and kind='lesson' order by queued_at desc limit 1", [id]);
  const [les] = await s.world.query<{ state: string }>("select state from lesson where id=$1", [id]);
  const [{ n }] = await s.world.query<{ n: number }>("select count(*)::int n from lesson_doc where lesson_id=$1", [id]) as [{ n: number }];
  const rows = n > 0 ? await issue_rows(s, id) : [];
  const kinds = (level: string) => [...new Set(rows.filter((r) => r.level === level).map((r) => r.kind))].sort();
  return {
    job_status: job?.status ?? null, lesson_state: les?.state ?? null, has_doc: n > 0,
    blocking_kinds: kinds("blocking"), confirmation_kinds: kinds("confirmation"),
  };
}

export async function hashes(s: LifecycleStack, id: string) {
  return {
    docs: await s.world.query<{ seq: number; content_hash: string }>("select seq::int, content_hash from lesson_doc where lesson_id=$1 order by seq", [id]),
    versions: await s.world.query<{ kind: string; number: number; content_hash: string }>("select kind, number::int, content_hash from lesson_version where lesson_id=$1 order by number", [id]),
  };
}

const call_keys = (s: LifecycleStack, stage: "generation" | "submit" | "approve", id: string, hash: string): { seen: boolean; keys: Key[] } => {
  const cs = s.calls.filter((c) => c.stage === stage && c.lesson_id === id && c.content_hash === hash);
  return { seen: cs.length > 0, keys: [...new Set(cs.flatMap((c) => c.findings.map(key_of)))].sort() };
};
export const rule_keys = call_keys;

/** Same input, same core finding at every stage. `expect_stages` must each have run for this hash (no vacuous pass). */
export async function assert_parity(
  s: LifecycleStack, id: string, hash: string, expect_stages: Array<"generation" | "submit" | "approve">,
) {
  const trim = (r: { seen: boolean; keys: Key[] }) => r;
  const gen = trim(call_keys(s, "generation", id, hash));
  const sub = trim(call_keys(s, "submit", id, hash));
  const app = trim(call_keys(s, "approve", id, hash));
  // call_keys is a set of keys; compare like with like (several findings of one kind can share a key, e.g. skill_unpractised per code).
  const bg = [...new Set(await issue_keys(s, id, hash))].sort();
  const seen = { generation: gen.seen, submit: sub.seen, approve: app.seen };
  for (const st of expect_stages) expect(seen[st], `stage ${st} ran no rule for ${id}@${hash.slice(0, 8)}`).toBe(true);
  const show = JSON.stringify({ gen: gen.keys, bg, sub: sub.keys, app: app.keys }, null, 1);
  // The background lane drops resolved/duplicate nothing; submit and approve run the same list over the same hash.
  if (sub.seen) expect(sub.keys, show).toEqual(bg);
  if (app.seen) expect(app.keys, show).toEqual(bg);
  if (gen.seen) {
    const extra = bg.filter((k) => !gen.keys.includes(k));
    // Generation runs before any alignment row of the hash exists, so the unit-coverage advisory (arc_repeat) is the one other kind it cannot see.
    expect(extra.every((k) => (GENERATION_SUPPRESSED as readonly string[]).includes(kind_of(k)) || kind_of(k) === "arc_repeat"), show).toBe(true);
    expect(core(gen.keys), show).toEqual(core(bg));
  }
}
