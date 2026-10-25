import { describe, expect, it } from "vitest";
import { create_logger } from "@ls/obs/logger";
import { log_summary_read } from "./summary-read-log";

describe("log_summary_read", () => {
  it("writes one line with run_id, a rounded duration and the status", () => {
    const lines: string[] = [];
    const logger = create_logger({ service: "web", build_id: "t", level: "info", write: (l) => void lines.push(l) });
    log_summary_read(() => logger, "run_1", 200, 12.6);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line["event"]).toBe("run.summary_read");
    expect(line["run_id"]).toBe("run_1");
    expect(line["duration_ms"]).toBe(13);
    expect((line["extra"] as Record<string, unknown>)["status"]).toBe(200);
  });

  it("never throws when the logger is unavailable", () => {
    expect(() => log_summary_read(() => { throw new Error("no services"); }, "run_1", 500, 1)).not.toThrow();
  });
});
