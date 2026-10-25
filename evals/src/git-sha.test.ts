// NL-49
import { describe, expect, it } from "vitest";
import { resolve_git_sha } from "./git-sha.ts";

const fake = (status: string) => (_c: string, args: string[]) => (args[0] === "rev-parse" ? "abc123def456\n" : status);

describe("resolve_git_sha", () => {
  it("clean tree", () => expect(resolve_git_sha({}, fake(""))).toBe("abc123def456"));
  it("dirty tree", () => expect(resolve_git_sha({}, fake(" M x.ts\n"))).toBe("abc123def456-dirty"));
  it("git failing falls back to BUILD_ID", () => {
    const boom = (): string => { throw new Error("no git"); };
    expect(resolve_git_sha({ BUILD_ID: "0123456789abcdef" }, boom)).toBe("0123456789ab");
  });
  it("nothing available throws", () => {
    const boom = (): string => { throw new Error("no git"); };
    expect(() => resolve_git_sha({}, boom)).toThrow("cannot resolve git sha");
  });
});
