// NL-49; NL-118 filled run_spike and run_http_mix and NL-119 filled run_yjs_mix, so no load shell is left.
import { describe, expect, it } from "vitest";
import { NotImplemented } from "./errors.ts";

describe("load shells", () => {
  it("the NotImplemented marker still carries its ticket", () => {
    const err = new NotImplemented("run_example", "NL-000");
    expect(err.ticket).toBe("NL-000");
  });
});
