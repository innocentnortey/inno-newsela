import { describe, expect, it } from "vitest";
import type { Logger } from "@ls/obs/logger";
import { load_collab_settings } from "@ls/config/settings";
import { write_start_event } from "./start-event.ts";

const url = "postgres://u:secretpw@127.0.0.1:1/d";
function settings() {
  return load_collab_settings({ DATABASE_URL: url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "b" });
}

describe("collab write_start_event", () => {
  it("test_write_start_event_unreachable_returns_false", async () => {
    const lines: string[] = [];
    const logger: Logger = {
      info: (e, f) => lines.push(e + JSON.stringify(f)),
      warn: (e, f) => lines.push(e + JSON.stringify(f)),
      error: (e, f) => lines.push(e + JSON.stringify(f)),
    };
    const ok = await write_start_event(settings(), logger, { attempts: 2, delay_ms: 1 });
    expect(ok).toBe(false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("process_start.not_recorded");
    expect(lines[0]).not.toContain("secretpw");
    expect(lines[0]).not.toContain("127.0.0.1");
  });

  it("retries attempts-1 times through the injected sleep", async () => {
    const sleeps: number[] = [];
    const logger: Logger = { info() {}, warn() {}, error() {} };
    await write_start_event(settings(), logger, { attempts: 3, delay_ms: 7, sleep: async (ms) => void sleeps.push(ms) });
    expect(sleeps).toEqual([7, 7]);
  });
});
