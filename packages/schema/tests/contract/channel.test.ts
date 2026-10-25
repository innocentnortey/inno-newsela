// AC-7: the three server messages of x-collaboration-channel parse; malformed ones do not.
import { describe, expect, it } from "vitest";
import { ModeMessage, RefusedMessage, StoredMessage } from "../../src/api/collab.ts";
import { loadSpec } from "./oracle.ts";

const stored = {
  type: "stored",
  content_hash: "0123456789abcdef".repeat(4),
  state_vector: "AQID",
  stored_at: "2026-10-25T10:00:00Z",
};
const refused = { type: "refused", code: "LESSON_LOCKED", message: "This lesson is locked.", refused_from: "AQID" };
const mode = { type: "mode", mode: "read_only", state: "submitted" };

describe("collaboration channel", () => {
  it("declares exactly stored, refused, mode", () => {
    expect(Object.keys(loadSpec()["x-collaboration-channel"].server_messages).sort()).toEqual([
      "mode",
      "refused",
      "stored",
    ]);
  });
  it("parses a stored message", () => {
    expect(StoredMessage.safeParse(stored).success).toBe(true);
  });
  it("parses a refused message", () => {
    expect(RefusedMessage.safeParse(refused).success).toBe(true);
  });
  it("parses a mode message", () => {
    expect(ModeMessage.safeParse(mode).success).toBe(true);
    expect(ModeMessage.safeParse({ ...mode, mode: "editable", state: "reopened" }).success).toBe(true);
  });
  it("refused without refused_from fails", () => {
    const { refused_from: _drop, ...rest } = refused;
    expect(RefusedMessage.safeParse(rest).success).toBe(false);
  });
  it("refused with another code fails", () => {
    expect(RefusedMessage.safeParse({ ...refused, code: "BLOCKED" }).success).toBe(false);
  });
});
