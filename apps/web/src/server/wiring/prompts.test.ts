// @vitest-environment node
// NL-34 AC-9: wire_prompts builds the service and seeds v1 once; stub mode logs instead of throwing.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { create_logger } from "@ls/obs/logger";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import type { WebDeps } from "../deps.ts";
import { PromptService } from "../services/prompt-service.ts";
import { wire_prompts } from "./prompts.ts";

const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
};
let t: TestDb | undefined;
afterAll(async () => {
  await t?.drop();
});
beforeEach(reset);
afterEach(reset);

describe("wire_prompts (NL-34)", () => {
  it("seeds exactly one v1 with the locked hash, however often it is wired", async () => {
    t = await create_test_db();
    const lines: string[] = [];
    const d = {
      db: t.db,
      ids: new PrefixedIdGenerator(),
      clock: { now: () => new Date(), sleep: async () => {} },
      logger: create_logger({ service: "web", build_id: "test", write: (l) => lines.push(l) }),
    } as unknown as WebDeps;
    const w = wire_prompts(d);
    expect(w.prompts).toBeInstanceOf(PromptService);
    const list = await w.prompts.list({} as never); // waits for the sync
    expect(list.guidance_versions).toHaveLength(1);
    wire_prompts(d);
    const w2 = wire_prompts(d);
    await w2.prompts.list({} as never);
    const rows = await t.db.with_tx(async (tx) => (await tx.query<{ locked_hash: string; n: number }>("select locked_hash, number n from prompt_version")).rows);
    expect(rows).toEqual([{ locked_hash: locked_hash(LOCKED_DIR), n: 1 }]);
  });

  it("stub mode does not throw and logs prompts.sync_failed", async () => {
    const lines: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((c: unknown) => (lines.push(String(c)), true)) as never;
    let services;
    try {
      services = build_web_services(load_web_settings(BASE));
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      process.stdout.write = orig;
    }
    expect(services.prompts).toBeInstanceOf(PromptService);
    expect(lines.join("")).toContain("prompts.sync_failed");
  });
});
