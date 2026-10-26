// NL-49; NL-118 filled run_spike and run_http_mix, so only the Yjs shell is left (NL-119).
import { describe, expect, it } from "vitest";
import { NotImplemented } from "./errors.ts";
import type { SpikeOptions } from "./types.ts";
import { run_yjs_mix } from "./yjs-mix.ts";

const O: SpikeOptions = { users: 1, ramp_s: 1, plateau_s: 1, socket_editors: 0, base_url: "", collab_url: "" };

describe("load shells", () => {
  it.each([["run_yjs_mix", run_yjs_mix, "NL-119"]] as const)("%s throws NotImplemented naming %s", async (_n, fn, ticket) => {
    const err = await fn(O).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotImplemented);
    expect((err as NotImplemented).ticket).toBe(ticket);
  });
});
