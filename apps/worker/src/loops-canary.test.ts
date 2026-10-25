// RT-1 AC-3 (key-leak canary) and AC-9 FROZEN. Do not edit. Fakes only; canary strings only.
import { describe, expect, it, vi } from "vitest";
import { load_worker_settings } from "@ls/config/settings";
import { SecretStr } from "@ls/config/secret";
import { create_logger } from "@ls/obs/logger";
import { create_inflight_tracker } from "./drain.ts";
import { start_worker_loops } from "./loops.ts";

const CANARY = "sk-ant-CANARY-4417";
const ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };

function host(over: { mode?: "real" | "stub"; env?: Record<string, string>; claim?: () => Promise<unknown>; lane?: () => Promise<unknown> } = {}) {
  const lines: string[] = [];
  const base = load_worker_settings({ ...ENV, ...over.env });
  const settings = { ...base, model: { ...base.model, model_provider_mode: over.mode ?? "stub", anthropic_api_key: over.mode === "real" ? new SecretStr(CANARY) : base.model.anthropic_api_key } };
  const exit = vi.fn();
  const tracker = create_inflight_tracker();
  const never = () => new Promise<never>(() => undefined);
  const h = {
    tracker, settings, exit,
    logger: create_logger({ service: "worker", build_id: "t", level: "info", write: (l) => void lines.push(l) }),
    generation: { claim_loop: { start: async () => ({}), run_until: over.claim ?? never }, paid: {} },
    checks: { check_lane: { run_until: over.lane ?? never } },
  };
  return { h: h as never, lines, exit, tracker };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

describe("RT-1 loop failure and startup log never carry the key", () => {
  it("loop_failure_exits_one_without_message (invariant: AC-3 canary)", async () => {
    const { h, lines, exit } = host({ mode: "real", claim: async () => { throw Object.assign(new Error(`provider said ${CANARY}`), { name: "ProviderBoom" }); } });
    start_worker_loops(h);
    await settle();
    expect(exit).toHaveBeenCalledWith(1);
    const text = lines.join("\n");
    expect(text).toContain("ProviderBoom");
    expect(text).not.toContain(CANARY);
  });

  it("check_lane_failure_exits_one_without_message (invariant: AC-3 canary)", async () => {
    const { h, lines, exit } = host({ mode: "real", lane: async () => { throw new Error(`lane ${CANARY}`); } });
    start_worker_loops(h);
    await settle();
    expect(exit).toHaveBeenCalledWith(1);
    expect(lines.join("\n")).not.toContain(CANARY);
  });

  it("fatal_exit_reason_exits_one (boundary)", async () => {
    const { h, exit, lines } = host({ claim: async () => ({ reason: "fatal", drained_jobs: 0, abandoned_jobs: 0 }) });
    start_worker_loops(h);
    await settle();
    expect(exit).toHaveBeenCalledWith(1);
    expect(lines.join("\n")).not.toContain(CANARY);
  });

  it("start_logs_mode_and_ceiling (invariant: AC-9)", async () => {
    const { h, lines } = host({ mode: "real" });
    start_worker_loops(h);
    await settle();
    const ev = lines.map((l) => JSON.parse(l)).filter((l) => l.event === "worker.model_mode");
    expect(ev).toHaveLength(1);
    expect(ev[0].extra.mode).toBe("real");
    expect(ev[0].extra.spend_ceiling_usd).toBe("75");
    expect(lines.join("\n")).not.toContain(CANARY);
    expect(JSON.stringify(ev[0])).not.toMatch(/length|prefix|sk-/);
  });

  it("ceiling_default_is_75 (regression: cannot be raised silently)", () => {
    expect(load_worker_settings(ENV).spend.build_spend_ceiling_usd.toString()).toBe("75");
  });

  it("ceiling_override_is_logged_as_set (boundary)", async () => {
    const { h, lines } = host({ mode: "real", env: { BUILD_SPEND_CEILING_USD: "120" } });
    start_worker_loops(h);
    await settle();
    const ev = lines.map((l) => JSON.parse(l)).find((l) => l.event === "worker.model_mode");
    expect(ev.extra.spend_ceiling_usd).toBe("120");
  });
});
