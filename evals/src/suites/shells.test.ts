// NL-49
import { describe, expect, it } from "vitest";
import { NotImplemented } from "../errors.ts";
import { default_suite_factory } from "../registry.ts";
import type { EvalCase, EvalOptions, SuiteName } from "../types.ts";

const TICKETS: [SuiteName, string][] = [
  ["S3", "NL-109"], // S5 was filled by NL-125, S11 by NL-121
  ["S8", "NL-127"], ["S12", "NL-111"], ["S14", "NL-118/NL-119"],
];
const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: null };
const CASE = {} as EvalCase;

describe("suite shells", () => {
  it.each(TICKETS)("%s is an empty shell that names %s", async (name, ticket) => {
    const suite = default_suite_factory("stub").find((s) => s.name === name);
    expect(suite).toBeDefined();
    expect(suite?.cases()).toEqual([]);
    const err = await suite?.score(CASE, OPTS).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotImplemented);
    expect((err as NotImplemented).ticket).toBe(ticket);
  });
});
