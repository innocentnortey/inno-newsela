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
});
