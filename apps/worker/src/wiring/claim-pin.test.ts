// Boot wiring: the worker claims only the locked layer it renders with (R-F3-2); any_pin must be asked for by name.
import { describe, expect, it } from "vitest";
import { load_worker_settings } from "@ls/config/settings";
import { ANY_PIN } from "@ls/db/repos/job-queue";
import { create_logger } from "@ls/obs/logger";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { build_worker_deps } from "../deps.ts";
import { wire_generation } from "./generation.ts";

const env = { DATABASE_URL: "postgres://u:p@127.0.0.1:1/none", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub" };
const pin_of = (loop: unknown): unknown => ((loop as { queue: { claim_pin: unknown } }).queue).claim_pin; // pool connects lazily; nothing is queried

describe("wire_generation claim pin", () => {
  const deps = build_worker_deps(load_worker_settings(env), create_logger({ service: "worker", build_id: "t", level: "error", write: () => undefined }));
  it("production_default_pins_to_the_hash_of_the_locked_files_it_renders_with", () => {
    expect(pin_of(wire_generation(deps).claim_loop)).toEqual({ mode: "locked_hash", locked_hash: locked_hash(LOCKED_DIR) });
  });
  it("any_pin_only_when_a_test_asks_for_it_by_name", () => {
    expect(pin_of(wire_generation(deps, { claim_pin: ANY_PIN }).claim_loop)).toEqual({ mode: "any_pin" });
  });
});
