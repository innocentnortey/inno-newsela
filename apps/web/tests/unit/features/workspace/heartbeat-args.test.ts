import { describe, expect, it } from "vitest";
import { heartbeatArgs } from "@/features/workspace/actions/heartbeat-args";

describe("heartbeatArgs (S-18, CHG-7)", () => {
  it("passes the real CON-11 version id and enables the heartbeat", () => {
    expect(heartbeatArgs({ lesson_id: "G6.U4.L4", version_id: "lv-real-9" })).toEqual({
      lessonId: "G6.U4.L4", versionId: "lv-real-9", enabled: true,
    });
  });
  it("sends nothing when the lesson has no version yet", () => {
    expect(heartbeatArgs({ lesson_id: "G6.U4.L4", version_id: null })).toMatchObject({ versionId: "", enabled: false });
  });
  it("sends nothing before the lesson has loaded", () => {
    expect(heartbeatArgs(null)).toEqual({ lessonId: "", versionId: "", enabled: false });
  });
});
