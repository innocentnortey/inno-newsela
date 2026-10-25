import { describe, expect, it } from "vitest";
import { lessonIdFromKey, lessonKeyFromId, unitIdFromKey, unitKeyFromId } from "@/lib/keys";

describe("keys", () => {
  it("maps unit keys both ways", () => {
    expect(unitIdFromKey("g6-u4")).toBe("G6.U4");
    expect(unitKeyFromId("G6.U4")).toBe("g6-u4");
    expect(unitIdFromKey("nope")).toBeNull();
    expect(unitKeyFromId("g6-u4")).toBeNull();
  });
  it("maps lesson keys both ways, including flex days", () => {
    expect(lessonIdFromKey("g6-u4", "L4")).toBe("G6.U4.L4");
    expect(lessonIdFromKey("g6-u4", "F1")).toBe("G6.U4.F1");
    expect(lessonKeyFromId("G6.U4.L4")).toBe("L4");
    expect(lessonKeyFromId("G6.U4.F6")).toBe("F6");
    expect(lessonIdFromKey("g6-u4", "L0")).toBeNull();
    expect(lessonIdFromKey("bad", "L4")).toBeNull();
    expect(lessonKeyFromId("G6.U4")).toBeNull();
  });
});
