// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { bytes_to_b64, type RefusedMessage } from "@/editor/messages";
import { apply_refusal } from "@/editor/refusals";

function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.getText("t").insert(0, "base ");
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return { a, b };
}
const msg = (refused_from: string): RefusedMessage => ({ type: "refused", code: "LESSON_LOCKED", message: "m", refused_from });

describe("apply_refusal", () => {
  it("returns the typed text and drops the refused update count", () => {
    const { a, b } = pair();
    const from = bytes_to_b64(Y.encodeStateVector(b));
    a.getText("t").insert(5, "hello");
    const calls: string[] = [];
    const out = apply_refusal(
      { doc: a, discard_local_state: () => calls.push("discard"), set_read_only: () => calls.push("ro") },
      msg(from),
    );
    expect(out.refused_text.join("")).toBe("hello");
    expect(out.dropped_updates).toBeGreaterThanOrEqual(1);
    expect(out.read_only).toBe(true);
    expect(calls).toEqual(["discard", "ro"]);
  });

  it("does not mutate the message and never throws on a malformed refused_from", () => {
    const { a } = pair();
    const m = msg("%%%not base64%%%");
    const copy = { ...m };
    const calls: string[] = [];
    const out = apply_refusal({ doc: a, discard_local_state: () => calls.push("discard"), set_read_only: () => calls.push("ro") }, m);
    expect(out).toEqual({ dropped_updates: 0, refused_text: [], read_only: true });
    expect(calls).toEqual(["discard", "ro"]);
    expect(m).toEqual(copy);
  });

  it("refused edits are not in the other session after the discard", () => {
    const { a, b } = pair();
    const from = bytes_to_b64(Y.encodeStateVector(b));
    a.getText("t").insert(5, "late");
    apply_refusal({ doc: a, discard_local_state: () => a.destroy(), set_read_only: () => {} }, msg(from));
    expect(b.getText("t").toString()).toBe("base ");
  });
});
