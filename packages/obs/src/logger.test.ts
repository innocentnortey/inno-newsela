// NL-01 AC-7 (frozen, risk::security) and AC-9. Failure modes: invariant (no secret reaches a log
// line, OBS-7), boundary (over-long strings are omitted), shape of each line.
import { describe, expect, it, vi } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { create_logger } from "./logger.ts";

const MARKER = "sk-ant-TESTMARKER-9f3";
const NOW = new Date("2026-10-25T12:00:00.000Z");

function make(level?: "debug" | "info" | "warn" | "error") {
  const lines: string[] = [];
  const logger = create_logger({
    service: "worker",
    build_id: "abc1234",
    level,
    write: (l) => lines.push(l),
    now: () => NOW,
  });
  return { lines, logger };
}

describe("NL-01 AC-7 Logger never prints a SecretStr [invariant]", () => {
  it("SecretStr in extra prints [redacted]", () => {
    const { lines, logger } = make();
    logger.info("e", { extra: { key: new SecretStr(MARKER) } });
    expect(lines.join("\n")).toContain("[redacted]");
    expect(lines.join("\n")).not.toContain(MARKER);
  });

  it("SecretStr nested deep in extra prints [redacted]", () => {
    const { lines, logger } = make();
    logger.warn("e", { extra: { a: [{ b: { k: new SecretStr(MARKER) } }] } });
    expect(lines.join("\n")).not.toContain(MARKER);
  });

  it("SecretStr placed as a top-level field value prints [redacted]", () => {
    const { lines, logger } = make();
    logger.error("e", { request_id: new SecretStr(MARKER) as unknown as string });
    expect(lines.join("\n")).not.toContain(MARKER);
    expect(JSON.parse(lines[0]!).request_id).toBe("[redacted]");
  });

  it("Error objects contribute only their name, not the message carrying the marker", () => {
    const { lines, logger } = make();
    logger.error("e", { extra: { err: new TypeError(MARKER) } });
    expect(lines.join("\n")).not.toContain(MARKER);
  });
});

describe("NL-01 AC-9 Logger line shape [invariant/boundary]", () => {
  it("emits one valid JSON line with required keys", () => {
    const { lines, logger } = make();
    logger.info("run.started", { request_id: "r1", run_id: "u1", duration_ms: 5 });
    expect(lines).toHaveLength(1);
    const o = JSON.parse(lines[0]!);
    expect(o).toMatchObject({
      ts: NOW.toISOString(),
      level: "info",
      event: "run.started",
      service: "worker",
      build_id: "abc1234",
      request_id: "r1",
      run_id: "u1",
      duration_ms: 5,
    });
  });

  it("null/undefined correlation ids are absent", () => {
    const { lines, logger } = make();
    logger.info("e", { request_id: null, job_id: undefined });
    const o = JSON.parse(lines[0]!);
    expect("request_id" in o).toBe(false);
    expect("job_id" in o).toBe(false);
  });

  it("a 500-character string in extra becomes [omitted: too long]", () => {
    const { lines, logger } = make();
    logger.info("e", { extra: { text: "x".repeat(500), ok: "y".repeat(120) } });
    const o = JSON.parse(lines[0]!);
    expect(o.extra.text).toBe("[omitted: too long]");
    expect(o.extra.ok).toBe("y".repeat(120));
  });

  it("a call below the configured level writes nothing", () => {
    const { lines, logger } = make("error");
    logger.info("e", {});
    logger.warn("e", {});
    expect(lines).toHaveLength(0);
    logger.error("e", {});
    expect(lines).toHaveLength(1);
  });

  it("default sink is process.stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      create_logger({ service: "web", build_id: "dev" }).info("e", {});
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]![0])).toMatch(/\n$/);
    } finally {
      spy.mockRestore();
    }
  });
});
