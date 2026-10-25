// RT-1 AC-10: the e2e worker env is stub-only and never carries a provider key.
import { describe, expect, it } from "vitest";
import { workerEnv } from "../../apps/web/e2e/integration/support/real-stack.ts";

describe("workerEnv", () => {
  it("worker_env_has_no_provider_keys", () => {
    const out = workerEnv({ PATH: "/bin", MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: "sk-ant-CANARY-1", OPENROUTER_API_KEY: "sk-or-CANARY-2" }, "4555");
    expect(out.ANTHROPIC_API_KEY).toBeUndefined();
    expect(out.OPENROUTER_API_KEY).toBeUndefined();
    expect(out.MODEL_PROVIDER_MODE).toBe("stub");
    expect(out.WORKER_HEALTH_PORT).toBe("4555");
    expect(out.PATH).toBe("/bin");
  });
});
