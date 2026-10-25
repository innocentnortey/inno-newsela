// NL-34 test harness shared by the two route tests (not a route; Next ignores files other than route.ts).
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { RequestUser } from "@ls/core/ports/common";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { PromptService } from "@/server/services/prompt-service.ts";
import { DomainRefusal, FakeResolver } from "@/server/http/testing/route-fixtures.ts";
import type { SessionResolver } from "@/server/http/with-route.ts";

export class RoleResolver implements SessionResolver {
  private readonly fixed = new FakeResolver();
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    if (token === "approver-token") {
      return {
        user_id: "usr_synthetic_approver",
        name: "Test approver",
        email: "approver@example.test",
        role: "approver",
        synthetic: true,
        request_id,
      } as RequestUser;
    }
    if (token === null) throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    return this.fixed.require(token, request_id);
  }
}

export interface Seeded {
  t: TestDb;
  repo: PgPromptRepo;
  service: PromptService;
  v1_id: string;
  v2_id: string;
  run_id: string;
  count: (table: string) => Promise<number>;
}

// v1 from the real locked hash, one guidance version by a seeded author, one run pinned to v1.
export async function seed(): Promise<Seeded> {
  const t = await create_test_db();
  const shared = { db: t.db, ids: new PrefixedIdGenerator(), clock: { now: () => new Date(), sleep: async () => {} } };
  const repo = new PgPromptRepo(shared);
  const service = new PromptService(repo, new PgAuditLog(shared), t.db, repo);
  const run_id = "run_synthetic_1";
  const { v1_id, v2_id } = await t.db.with_tx(async (tx) => {
    const v1 = (await repo.sync_locked_layer(locked_hash(LOCKED_DIR), tx))!;
    await insert_row(tx, "app_user", { id: "usr_synthetic_author", name: "Test author", role: "author", synthetic: true });
    const v2 = await repo.insert_guidance(
      { base_version_id: v1.prompt_version_id, guidance_text: "g", reason: "tighten", author_id: "usr_synthetic_author" as never },
      "+g",
      tx,
    );
    await insert_row(tx, "run", { id: run_id, prompt_version_id: v1.prompt_version_id });
    return { v1_id: v1.prompt_version_id, v2_id: v2.prompt_version_id };
  });
  const count = (table: string) =>
    t.db.with_tx(async (tx) => Number((await tx.query<{ n: string }>(`select count(*) n from ${table}`)).rows[0]!.n));
  return { t, repo, service, v1_id, v2_id, run_id, count };
}

export const get = (path: string, token: string | null, extra: Record<string, string> = {}) =>
  new Request("https://app.example.test" + path, {
    method: "GET",
    headers: { ...(token === null ? {} : { cookie: `ls_session=${token}` }), ...extra },
  });
