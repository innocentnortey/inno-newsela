import { describe, expect, it } from "vitest";
import { flagIdFor } from "@/features/workspace/actions/standards/flag-id";

describe("flagIdFor", () => {
  it("flag_id_from_message", () => {
    const message = "Safety note sf:G6.U4.L31:39 is open: a named reviewer must clear it (tip at none) (safety_flag_open)";
    expect(flagIdFor({ kind: "safety_flag_open", message })).toBe("sf:G6.U4.L31:39");
  });
  it("flag_id_none_for_other_kinds", () => {
    expect(flagIdFor({ kind: "safety_note_without_tip", message: "Safety note sf:x:1 is open" })).toBeNull();
  });
  it("flag_id_none_when_message_lacks_it", () => {
    expect(flagIdFor({ kind: "safety_flag_open", message: "A safety note needs clearing" })).toBeNull();
  });
});
