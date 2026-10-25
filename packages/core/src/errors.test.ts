// NL-12
import { describe, expect, it } from "vitest";
import { ConfigError as RawConfigError } from "@ls/config/errors";
import { SchemaUnknownError as RawSchemaUnknownError } from "@ls/editor-schema/errors";
import {
  CollabUnavailable, CompileError, ConfigError, DomainRefusal, InvariantViolation, LeaseLost, ModelOutputInvalid,
  ProviderError, SchemaUnknownError, SpendRefused, type ProviderErrorKind,
} from "./errors.ts";

describe("ProviderError.retryable", () => {
  const cases: [ProviderErrorKind, boolean][] = [
    ["rate_limited", true], ["overloaded", true], ["server_error", true], ["connection", true],
    ["timeout", false], ["bad_request", false], ["auth", false], ["refusal", false],
  ];
  it.each(cases)("%s -> %s", (kind, retryable) => {
    const e = new ProviderError({ kind, http_status: 429, retry_after_s: 2, provider_request_id: "req_x" });
    expect(e.retryable).toBe(retryable);
    expect(e.http_status).toBe(429);
    expect(e.retry_after_s).toBe(2);
    expect(e.provider_request_id).toBe("req_x");
    expect(e).toBeInstanceOf(Error);
  });
  it("defaults the optional fields to null", () => {
    const e = new ProviderError({ kind: "timeout" });
    expect([e.http_status, e.retry_after_s, e.provider_request_id]).toEqual([null, null, null]);
  });
});

describe("error classes", () => {
  it("DomainRefusal carries code, message, details", () => {
    const e = new DomainRefusal("NOT_FOUND", "no such lesson", { id: "G6.U4.L1" });
    expect([e.code, e.message, e.details, e.name]).toEqual(["NOT_FOUND", "no such lesson", { id: "G6.U4.L1" }, "DomainRefusal"]);
    expect(new DomainRefusal("NOT_FOUND", "x").details).toEqual({});
  });
  it("carry their fields and a fixed message with ids only", () => {
    expect(new ModelOutputInvalid({ model_call_id: "mc_1", schema_name: "LessonDraft", issues: ["a"] }).issues).toEqual(["a"]);
    expect(new LeaseLost({ job_id: "job_1" }).job_id).toBe("job_1");
    expect(new CollabUnavailable({ lesson_id: "G6.U4.L1", command: "set_mode" }).command).toBe("set_mode");
    const c = new CompileError({ lesson_id: "G6.U4.L1", reason: "unknown_node" });
    expect(c.address).toBeNull();
    const i = new InvariantViolation("x", { path: "details" });
    expect(i.invariant).toBe("x");
    expect(i.message).not.toContain("details");
  });
  it("SpendRefused keeps the cap", async () => {
    const { default: Decimal } = await import("decimal.js");
    const e = new SpendRefused({ refused_by: "day_cap", scope: "user", amount_usd: new Decimal("1.5") });
    expect([e.refused_by, e.scope, e.amount_usd.toString()]).toEqual(["day_cap", "user", "1.5"]);
  });
  it("re-exports the very same ConfigError and SchemaUnknownError classes", () => {
    expect(ConfigError).toBe(RawConfigError);
    expect(SchemaUnknownError).toBe(RawSchemaUnknownError);
  });
});
