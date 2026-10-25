// AC-6: Sha256, Timestamp and StateVector accept and reject the right strings.
import { describe, expect, it } from "vitest";
import { Sha256, StateVector, Timestamp } from "../../src/api/common.ts";

describe("formats", () => {
  it.each([
    ["Sha256 64 lowercase hex", Sha256, "a".repeat(64), true],
    ["Sha256 uppercase", Sha256, "A".repeat(64), false],
    ["Sha256 63 chars", Sha256, "a".repeat(63), false],
    ["Sha256 non-hex", Sha256, "g".repeat(64), false],
    ["Timestamp Z", Timestamp, "2026-10-25T10:00:00Z", true],
    ["Timestamp +02:00", Timestamp, "2026-10-25T10:00:00+02:00", true],
    ["Timestamp no offset", Timestamp, "2026-10-25T10:00:00", false],
    ["Timestamp date only", Timestamp, "2026-10-25", false],
    ["StateVector base64", StateVector, "AQID", true],
    ["StateVector not base64", StateVector, "not base64!", false],
  ] as const)("%s", (_name, schema, value, ok) => {
    expect(schema.safeParse(value).success).toBe(ok);
  });
});
