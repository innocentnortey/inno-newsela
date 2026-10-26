import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { mapFillError, SOURCE_REQUIRED_MSG } from "@/features/insert-quote/fill-errors";

const invalid = (fields: unknown) => new ApiError({ status: 422, code: "INVALID_REQUEST", message: "The request is not valid.", details: { fields } });

describe("mapFillError INVALID_REQUEST", () => {
  it("maps INVALID_REQUEST fields to Text and Source", () => {
    expect(mapFillError(invalid(["body.text"]), 0)).toEqual({ target: "text", message: "Add the quote text." });
    expect(mapFillError(invalid(["text"]), 0).target).toBe("text");
    expect(mapFillError(invalid(["body.source_ref.title"]), 0)).toEqual({ target: "source", message: SOURCE_REQUIRED_MSG });
    expect(mapFillError(invalid(["body.rights_status"]), 0).target).toBe("banner");
    expect(mapFillError(invalid(undefined), 0).target).toBe("banner");
  });
});
