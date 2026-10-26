import { describe, expect, it } from "vitest";
import type { UserId } from "@ls/schema/ids";
import { approve_gate, merge_resolutions, submit_gate } from "./gates.ts";
import type { ApiErrorCode, CheckKind } from "./types.ts";
import { finding, gate_state, issue } from "./test-helpers.ts";

const U1 = "usr_01HZZZZZZZZZZZZZZZZZZZZZZZ" as UserId;
const U2 = "usr_01HYYYYYYYYYYYYYYYYYYYYYYY" as UserId;

describe("merge_resolutions", () => {
  it("resolves on the same (kind, address, code)", () => {
    const [i] = merge_resolutions(
      [finding("section_missing", { address: "a", code: "RL.6.1" })],
      [{ kind: "section_missing", address: "a", code: "RL.6.1" }],
    );
    expect(i?.resolved).toBe(true);
  });
  it("does not resolve at another address", () => {
    const [i] = merge_resolutions(
      [finding("section_missing", { address: "a.PartA" })],
      [{ kind: "section_missing", address: "a", code: null }],
    );
    expect(i?.resolved).toBe(false);
  });
  it("does not resolve with a different code", () => {
    const [i] = merge_resolutions(
      [finding("standard_not_taught", { address: "a", code: "RL.6.1" })],
      [{ kind: "standard_not_taught", address: "a", code: "RL.6.2" }],
    );
    expect(i?.resolved).toBe(false);
  });
  it("never resolves suggestion_pending", () => {
    const [i] = merge_resolutions(
      [finding("suggestion_pending", { address: "a" })],
      [{ kind: "suggestion_pending", address: "a", code: null }],
    );
    expect(i?.resolved).toBe(false);
  });
  it("never resolves safety_flag_open (or other non-resolvable kinds)", () => {
    const kinds: CheckKind[] = [
      "safety_flag_open",
      "standard_confirmation",
      "safety_note_without_tip",
      "safety_text_in_student_block",
      "rights_to_clear",
      "cross_lesson_link",
    ];
    const out = merge_resolutions(
      kinds.map((k) => finding(k, { address: "a" })),
      kinds.map((k) => ({ kind: k, address: "a", code: null })),
    );
    expect(out.every((i) => !i.resolved)).toBe(true);
  });
});

const bit = (n: number, b: number): boolean => ((n >> b) & 1) === 1;

type Oracle = [boolean, ApiErrorCode][];
const first_or_allowed = (o: Oracle): ApiErrorCode[] =>
  o.filter(([c]) => c).map(([, code]) => code);

describe("submit_precedence", () => {
  it("matches the oracle over all 32 combinations", () => {
    for (let n = 0; n < 32; n += 1) {
      const [sug, blk, conf] = [bit(n, 0), bit(n, 1), bit(n, 2)];
      // bits 3 and 4 (four eyes, dependency) must have no effect on submit
      const state = gate_state({
        action: "submit",
        pending_suggestions: sug ? 2 : 0,
        issues: blk
          ? [issue("section_missing")]
          : [issue("section_missing", { resolved: true })],
        open_confirmations: conf ? 1 : 0,
        four_eyes_enabled: bit(n, 3),
        last_editor_id: U1,
        approver_id: U1,
        dependencies: bit(n, 4)
          ? [
              {
                direction: "waits_on",
                lesson_id: "G6.U4.L2",
                slot_id: "s",
                source_state: "draft",
                slot_filled: false,
                source_approved_hash: null,
              },
            ]
          : [],
      });
      const expected = first_or_allowed([
        [sug, "SUGGESTION_PENDING"],
        [blk, "BLOCKED"],
        [conf, "CONFIRMATION_OPEN"],
      ]);
      const d = submit_gate(state);
      expect(d.refusals, `n=${n}`).toEqual(expected);
      expect(d.allowed).toBe(expected.length === 0);
    }
  });

  it("BLOCKED details list blocking and confirmation issues", () => {
    const d = submit_gate(
      gate_state({
        issues: [
          issue("section_missing"),
          issue("standard_confirmation", { level: "confirmation" }),
          issue("arc_repeat", { level: "advisory" }),
        ],
      }),
    );
    expect(d.refusals).toEqual(["BLOCKED"]);
    const issues = (d.details as { issues: { kind: string }[] }).issues;
    expect(issues.map((i) => i.kind)).toEqual([
      "section_missing",
      "standard_confirmation",
    ]);
  });
});

describe("waiting phase of a cross-lesson link", () => {
  const dep = (slot_filled: boolean) => ({
    direction: "waits_on" as const, lesson_id: "G6.U4.L5", slot_id: "s",
    source_state: "draft", slot_filled, source_approved_hash: null,
  });
  const link_issue = () => issue("cross_lesson_link", { related_lesson_id: "G6.U4.L5" });
  it("submit is allowed when the only blocking issue waits on a filled slot", () => {
    const d = submit_gate(gate_state({ issues: [link_issue()], dependencies: [dep(true)] }));
    expect(d.allowed).toBe(true);
  });
  it("submit is refused BLOCKED when the slot is empty", () => {
    const d = submit_gate(gate_state({ issues: [link_issue()], dependencies: [dep(false)] }));
    expect(d.refusals).toEqual(["BLOCKED"]);
  });
  it("approve is refused DEPENDENCY_UNAPPROVED in the filled case", () => {
    const d = approve_gate(gate_state({ action: "approve", four_eyes_enabled: false, issues: [], dependencies: [dep(true)] }));
    expect(d.refusals).toEqual(["DEPENDENCY_UNAPPROVED"]);
  });
  it("approve is still refused while the waiting issue is open, by the dependency check", () => {
    const d = approve_gate(gate_state({ action: "approve", four_eyes_enabled: false, issues: [link_issue()], dependencies: [dep(true)] }));
    expect(d.refusals).toEqual(["DEPENDENCY_UNAPPROVED"]);
  });
});

describe("approve_precedence", () => {
  it("matches the oracle over all 32 combinations", () => {
    for (let n = 0; n < 32; n += 1) {
      const [fe, sug, blk, conf, dep] = [
        bit(n, 0),
        bit(n, 1),
        bit(n, 2),
        bit(n, 3),
        bit(n, 4),
      ];
      const state = gate_state({
        action: "approve",
        four_eyes_enabled: true,
        last_editor_id: U1,
        approver_id: fe ? U1 : U2,
        pending_suggestions: sug ? 1 : 0,
        issues: blk ? [issue("section_missing")] : [],
        open_confirmations: conf ? 1 : 0,
        dependencies: dep
          ? [
              {
                direction: "waits_on",
                lesson_id: "G6.U4.L2",
                slot_id: "s",
                source_state: "draft",
                slot_filled: false,
                source_approved_hash: null,
              },
            ]
          : [],
      });
      const expected = first_or_allowed([
        [fe, "FOUR_EYES"],
        [sug, "SUGGESTION_PENDING"],
        [blk, "BLOCKED"],
        [conf, "CONFIRMATION_OPEN"],
        [dep, "DEPENDENCY_UNAPPROVED"],
      ]);
      const d = approve_gate(state);
      expect(d.refusals, `n=${n}`).toEqual(expected);
      expect(d.allowed).toBe(expected.length === 0);
    }
  });

  it("skips FOUR_EYES when disabled and names the source lesson", () => {
    const base = gate_state({
      action: "approve",
      last_editor_id: U1,
      approver_id: U1,
      four_eyes_enabled: false,
    });
    expect(approve_gate(base).allowed).toBe(true);
    const dep = approve_gate({
      ...base,
      dependencies: [
        {
          direction: "waits_on",
          lesson_id: "G6.U4.L2",
          slot_id: "s",
          source_state: "in_review",
          slot_filled: true,
          source_approved_hash: null,
        },
      ],
    });
    expect(dep.refusals).toEqual(["DEPENDENCY_UNAPPROVED"]);
    expect(
      (dep.details as { source_lesson_ids: string[] }).source_lesson_ids,
    ).toEqual(["G6.U4.L2"]);
  });
});
