import { describe, expect, it } from "vitest";
import { format_saved_time, save_state_text } from "@/features/workspace/live/save-state";

describe("save_state_text", () => {
  it("maps each state", () => {
    expect(save_state_text("synced", null, 0)).toBe("Connected");
    expect(save_state_text("saving", null, 0)).toBe("Saving…");
    expect(save_state_text("DISCONNECTED", null, 0)).toBe("Not saved");
    expect(save_state_text("read_only", null, 0)).toBe("Read-only");
    expect(save_state_text("stored", null, 0)).toBe("Saved");
    const iso = "2026-10-25T10:42:09.000Z";
    expect(save_state_text("stored", iso, 0)).toBe(`Saved · ${format_saved_time(iso)}`);
    expect(format_saved_time(iso)).toMatch(/^\d{2}:\d{2}$/);
  });
  it("connecting is empty before 1000 ms", () => {
    expect(save_state_text("connecting", null, 999)).toBe("");
    expect(save_state_text("connecting", null, 1000)).toBe("Connecting to the editor…");
  });
});
