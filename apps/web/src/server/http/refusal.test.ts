// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@ls/schema/api/common";
import { render_error_status } from "../../../scripts/gen-error-status.ts";
import { ERROR_STATUS, RETRY_AFTER_CODES } from "./error-status.generated.ts";
import { is_domain_refusal, status_for, to_error_response } from "./refusal.ts";
import { DomainRefusal } from "./testing/route-fixtures.ts";

describe("error_status", () => {
  it.each(API_ERROR_CODES)("%s maps to a status and an envelope", (code) => {
    const status = status_for(code);
    expect(status).toBeGreaterThanOrEqual(400);
    const r = to_error_response(
      { code, message: "m", details: { a: 1, request_id: "other" } },
      "req_x",
    );
    expect(r.status).toBe(status);
    expect(r.body.error.code).toBe(code);
    expect(r.body.error.details).toEqual({ a: 1, request_id: "req_x" });
  });
  it("non-object details become just request_id", () => {
    expect(
      to_error_response({ code: "NOT_FOUND", message: "m", details: [1] }, "r")
        .body.error.details,
    ).toEqual({ request_id: "r" });
  });
  it("only named refusals with catalog codes are refusals", () => {
    expect(is_domain_refusal(new DomainRefusal("NOT_FOUND", "x"))).toBe(true);
    expect(is_domain_refusal(new DomainRefusal("MADE_UP", "x"))).toBe(false);
    expect(is_domain_refusal(new Error("x"))).toBe(false);
    expect(is_domain_refusal({ code: "NOT_FOUND", message: "x" })).toBe(false);
  });
});

describe("generated_file", () => {
  const yaml = readFileSync(
    new URL(
      "../../../../../docs/contracts/interface.openapi.yaml",
      import.meta.url,
    ),
    "utf8",
  );
  it("matches the committed file, 36 codes", () => {
    const text = readFileSync(
      new URL("./error-status.generated.ts", import.meta.url),
      "utf8",
    );
    expect(render_error_status(yaml)).toBe(text);
    expect(Object.keys(ERROR_STATUS).sort()).toEqual(
      [...API_ERROR_CODES].sort(),
    );
    expect(Object.keys(ERROR_STATUS)).toHaveLength(36);
    expect(RETRY_AFTER_CODES).toEqual(["SERVICE_BUSY"]);
  });
  it("rejects a catalog that is not 36 codes", () => {
    expect(() =>
      render_error_status(
        "x-error-catalog:\n  codes:\n    A: { status: 400 }\n",
      ),
    ).toThrow();
  });
});
