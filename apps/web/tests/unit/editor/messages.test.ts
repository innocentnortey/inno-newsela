import { describe, expect, it } from "vitest";
import { b64_to_bytes, bytes_to_b64, parse_collab_message } from "@/editor/messages";

describe("parse_collab_message", () => {
  it("parses stored, mode and refused", () => {
    expect(parse_collab_message(JSON.stringify({ type: "stored", content_hash: "h", state_vector: "AA==", stored_at: "2026-10-25T10:00:00Z" }))).toMatchObject({ type: "stored" });
    expect(parse_collab_message(JSON.stringify({ type: "mode", mode: "read_only", state: "submitted" }))).toEqual({ type: "mode", mode: "read_only", state: "submitted" });
    expect(parse_collab_message(JSON.stringify({ type: "refused", code: "LESSON_LOCKED", message: "m", refused_from: "AA==" }))).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
  });
  it("returns null for anything else", () => {
    expect(parse_collab_message("not json")).toBeNull();
    expect(parse_collab_message("null")).toBeNull();
    expect(parse_collab_message(JSON.stringify({ type: "other" }))).toBeNull();
    expect(parse_collab_message(JSON.stringify({ type: "mode", mode: "weird", state: "x" }))).toBeNull();
    expect(parse_collab_message(JSON.stringify({ type: "refused", code: "NOPE", message: "m", refused_from: "A" }))).toBeNull();
    expect(parse_collab_message(JSON.stringify({ type: "refused", code: "LESSON_LOCKED", message: "m", refused_from: 5 }))).toBeNull();
  });
  it("base64 round trips", () => {
    const u = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(b64_to_bytes(bytes_to_b64(u)))).toEqual(Array.from(u));
  });
});
