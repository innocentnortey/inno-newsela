/* eslint-disable @typescript-eslint/no-explicit-any */
// NL-106 frozen fixtures for the Submit freeze tests: controllable check rules, a stub CheckContextLoader, lessons
// carrying the AC-10 marker and a large lesson for the AC-9 latency run, and small spies. No database, no @ls/db import.
import * as Y from "yjs";
import type { CheckContext, CheckFinding, CheckRule, CheckRuleList } from "@ls/core/checks/types";
import type { StoredLesson } from "@ls/schema/lesson";
import { KEY_MARKER } from "../nl-80.fixtures.ts";
import { LIVE_TEXT, SLOT, doc_of, lesson_with_slot } from "./nl-105.fixtures.ts";

export { KEY_MARKER };
export const SUBMIT_MARKER = "SUBMIT-QZ-106";

const para = (text: string) => ({ type: "paragraph", attrs: { align: null }, content: [{ type: "text", text }] });
const placeholder = { type: "quote_placeholder", attrs: { slot_id: SLOT, reason: "needs a quote" } };

/** WP-1 with the slot lesson's literacy_lab plus a paragraph that carries SUBMIT_MARKER (AC-10). */
export function lesson_with_marker(lesson_id: string): StoredLesson {
  const l = lesson_with_slot(lesson_id);
  return {
    ...l,
    sections: l.sections.map((s) =>
      s.address === "literacy_lab" ? { ...s, content: doc_of(para(LIVE_TEXT), para(`${SUBMIT_MARKER} synthetic paragraph`), placeholder) } : s,
    ),
  } as unknown as StoredLesson;
}

/** A document much larger than WP-1 (AC-9 "47-lesson-sized"): literacy_lab holds 300 paragraphs of 40 words (about 12,000 words). */
export function big_lesson(lesson_id: string): StoredLesson {
  const l = lesson_with_slot(lesson_id);
  const words = (i: number) => Array.from({ length: 40 }, (_, k) => `word${i}x${k}`).join(" ");
  const paras = Array.from({ length: 300 }, (_, i) => para(words(i)));
  return {
    ...l,
    sections: l.sections.map((s) => (s.address === "literacy_lab" ? { ...s, content: doc_of(para(LIVE_TEXT), ...paras, placeholder) } : s)),
  } as unknown as StoredLesson;
}

/** Switches the stub rules and the stub loader read on every call; tests flip them between calls. */
export class Controls {
  blocking = false; // quote_placeholder_open, blocking, resolvable (CON-13)
  confirmation = false; // standard_confirmation, confirmation level, not resolvable
  safety = false; // safety_flag_open, blocking, not resolvable
  pending = 0; // pending suggestions the loader reports
  load_calls = 0;
}

const finding = (kind: CheckFinding["kind"], level: CheckFinding["level"], address: string, code: string | null): CheckFinding => ({
  kind, level, message: `synthetic ${kind}`, address, span_anchor: null, related_lesson_id: null, code,
});

/** Hand-written rules (one finding each) so the gate order and the resolution carry-over are controlled. */
export function rules_for(c: Controls): CheckRuleList {
  const rule = (kind: CheckRule["kind"], level: CheckRule["level"], on: () => boolean, address: string, code: string | null): CheckRule => ({
    kind, level, run: () => (on() ? [finding(kind, level, address, code)] : []),
  });
  return [
    rule("quote_placeholder_open", "blocking", () => c.blocking, "literacy_lab", null),
    rule("standard_confirmation", "confirmation", () => c.confirmation, "front_matter", "RL.6.1"),
    rule("safety_flag_open", "blocking", () => c.safety, "launch", null),
  ];
}

/** Stub CheckContextLoader (the real one needs a full outline graph; its tests are NL-38's). */
export function loader_for(c: Controls) {
  return {
    async load(lesson_id: string, lesson: StoredLesson, content_hash: string): Promise<CheckContext> {
      c.load_calls += 1;
      return { lesson_id, content_hash, lesson, pending_suggestions: Array.from({ length: c.pending }, (_, i) => ({ suggestion_id: `sug_${i}` })) } as unknown as CheckContext;
    },
  };
}

/** Wraps the named methods of `obj` so each call appends `${prefix}.${name}` to `log` before delegating. */
export function spy<T extends object>(obj: T, names: readonly string[], log: string[], prefix: string): void {
  for (const n of names) {
    const orig = (obj as any)[n].bind(obj);
    (obj as any)[n] = (...a: unknown[]) => {
      log.push(`${prefix}.${n}`);
      return orig(...a);
    };
  }
}

/** Resolves when `release()` is called; used to hold the call inside `persistence.store`. */
export function gate() {
  let release!: () => void;
  const open = new Promise<void>((r) => (release = r));
  return { open, release };
}

export const p95 = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] ?? NaN;
};

export const sv_b64 = (d: Y.Doc): string => Buffer.from(Y.encodeStateVector(d)).toString("base64");
/** A state vector (base64) that is strictly ahead of the given stored update: one extra client edit the server never received. */
export function sv_ahead_of(stored_update: Uint8Array): string {
  const d = new Y.Doc();
  Y.applyUpdate(d, stored_update);
  d.getMap("typed").set("never-received", 1);
  return sv_b64(d);
}
