// NL-49
import { describe, expect, it } from "vitest";
import { NotImplemented } from "./errors.ts";
import { run_http_mix } from "./http-mix.ts";
import { run_spike } from "./spike.ts";
import type { SpikeOptions } from "./types.ts";
import { run_yjs_mix } from "./yjs-mix.ts";

const O: SpikeOptions = { users: 1, ramp_s: 1, plateau_s: 1, socket_editors: 0, base_url: "", collab_url: "" };

describe("load shells", () => {
  it.each([
    ["run_spike", run_spike, "NL-118"],
    ["run_http_mix", run_http_mix, "NL-118"],
    ["run_yjs_mix", run_yjs_mix, "NL-119"],
  ] as const)("%s throws NotImplemented naming %s", async (_n, fn, ticket) => {
    const err = await fn(O).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotImplemented);
    expect((err as NotImplemented).ticket).toBe(ticket);
  });
});
