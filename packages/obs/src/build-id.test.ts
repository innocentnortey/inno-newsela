// NL-01 AC-9: build id resolution.
import { describe, expect, it, vi } from "vitest";
import { resolve_build_id } from "./build-id.ts";

describe("NL-01 AC-9 resolve_build_id", () => {
  it("env wins and git is not called", () => {
    const git = vi.fn(() => "zzz");
    expect(resolve_build_id({ RENDER_GIT_COMMIT: "abc" }, git)).toBe("abc");
    expect(git).not.toHaveBeenCalled();
  });
  it("git sha when env unset or empty", () => {
    expect(resolve_build_id({ RENDER_GIT_COMMIT: "" }, () => "g1")).toBe("g1");
  });
  it("dev when git returns null", () => {
    expect(resolve_build_id({}, () => null)).toBe("dev");
  });
  it("dev when git throws", () => {
    expect(
      resolve_build_id({}, () => {
        throw new Error("no git");
      }),
    ).toBe("dev");
  });
});
