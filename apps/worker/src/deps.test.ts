// RT-1 AC-4: the worker's db is a real PgDatabase (lazy pool, no connection made here).
import { describe, expect, it } from "vitest";
import { PgDatabase } from "@ls/db/pool";
import { load_worker_settings } from "@ls/config/settings";
import { create_logger } from "@ls/obs/logger";
import { StubModelClient } from "@ls/llm/stub";
import { build_worker_deps } from "./deps.ts";

describe("build_worker_deps", () => {
  it("db_is_pg_database and stub mode gives the stub client", async () => {
    const settings = load_worker_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" });
    const deps = build_worker_deps(settings, create_logger({ service: "worker", build_id: "t", level: "info", write: () => undefined }));
    expect(deps.db).toBeInstanceOf(PgDatabase);
    expect(deps.model_client).toBeInstanceOf(StubModelClient);
    await (deps.db as PgDatabase).close();
  });

  it("stub mode client is scripted for unit_plan", async () => {
    const settings = load_worker_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" });
    const deps = build_worker_deps(settings, create_logger({ service: "worker", build_id: "t", level: "info", write: () => undefined }));
    const r = await deps.model_client.complete({
      alias: "GENERATION",
      system_blocks: [],
      user_blocks: [{ text: "<<<OUTLINE_DATA kind=row row=8>>>\n{}\n<<<END_OUTLINE_DATA>>>", cacheable: false, label: "data" }],
      output_schema_name: "UnitPlanDraft",
      output_json_schema: {},
      output_mode: "prompt_embedded",
      max_output_tokens: 100,
      timeout_ms: 1000,
      effort: null,
      temperature: null,
    });
    expect(JSON.parse(r.raw_text).entries[0].lesson_id).toBe("G6.U4.L4");
    await (deps.db as PgDatabase).close();
  });
});
