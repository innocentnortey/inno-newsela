import { describe, expect, it } from "vitest";
import { SchemaUnknownError } from "./errors.ts";

describe("SchemaUnknownError", () => {
  it("with_lesson_id returns a new instance and leaves the original", () => {
    const a = new SchemaUnknownError({
      lesson_id: null,
      schema_version: 1,
      unknown_nodes: ["embed"],
    });
    expect(a.lesson_id).toBeNull();
    const b = a.with_lesson_id("G6.U4.L4");
    expect(b).not.toBe(a);
    expect(b).toBeInstanceOf(SchemaUnknownError);
    expect(b.lesson_id).toBe("G6.U4.L4");
    expect(b.schema_version).toBe(1);
    expect(b.unknown_nodes).toEqual(["embed"]);
    expect(a.lesson_id).toBeNull();
  });
});
