// NL-26 frozen test harness (synthetic only): the real stack on a fresh migrated Postgres database.
// Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DomainRefusal } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { RequestUser } from "@ls/core/ports/common";
import type { FetchedSheet, SheetFetcher } from "@ls/core/ports/sheet-fetcher";
import { load_standard_rows } from "@ls/core/intake/standards-index";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { make_outline_handlers } from "../../../../app/api/outline-versions/http.ts";
import { make_with_route, type HttpRequest, type HttpResponse, type SessionResolver } from "../../http/with-route.ts";
import { APP_ORIGIN, SETTINGS, make_log } from "../../http/testing/route-fixtures.ts";
import { OutlineService } from "../outline-service.ts";

const FIXTURES = resolve(import.meta.dirname, "../../../../../../packages/core/tests/fixtures/outline");
export const issued_csv_bytes = (): Uint8Array => new Uint8Array(readFileSync(resolve(FIXTURES, "issued.csv")));
export const issued_xlsx_bytes = (): Uint8Array => new Uint8Array(readFileSync(resolve(FIXTURES, "issued.xlsx")));
export const issued_csv_text = (): string => readFileSync(resolve(FIXTURES, "issued.csv"), "utf8");

// One lesson-description sentence inside the issued CSV (lesson 1); tests swap it for other synthetic text.
export const LESSON_SNIPPET = "Students share theories and add to their previous response";
export function csv_with_snippet(replacement: string): Uint8Array {
  const text = issued_csv_text();
  if (!text.includes(LESSON_SNIPPET)) throw new Error("fixture changed: snippet not found");
  return new TextEncoder().encode(text.replace(LESSON_SNIPPET, replacement));
}

export const USERS = [
  { id: "usr_synthetic_author", name: "Test author", role: "author", token: "valid-token" },
  { id: "usr_synthetic_reviewer", name: "Test reviewer", role: "reviewer", token: "reviewer-token" },
  { id: "usr_synthetic_approver", name: "Test approver", role: "approver", token: "approver-token" },
] as const;

class RoleResolver implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    const u = USERS.find((x) => x.token === token);
    if (!u) throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    return { user_id: u.id, name: u.name, email: `${u.role}@example.test`, role: u.role, synthetic: true, request_id };
  }
}

// Scriptable SheetFetcher; counts calls.
export class ScriptedFetcher implements SheetFetcher {
  calls: string[] = [];
  next: () => Promise<FetchedSheet> = async () => {
    throw new DomainRefusal("SHEET_UNREACHABLE", "not scripted");
  };
  async fetch_export(sheet_url: string): Promise<FetchedSheet> {
    this.calls.push(sheet_url);
    return this.next();
  }
  serve(data: Uint8Array, url = "https://docs.google.com/spreadsheets/d/synthetic"): void {
    this.next = async () => ({ url, kind: "xlsx", data, sha256: "0".repeat(64), fetched_at: new Date() });
  }
}

export interface Stack {
  tdb: TestDb;
  repo: PgOutlineRepo;
  standards: PgStandardRepo;
  service: OutlineService;
  fetcher: ScriptedFetcher;
  clock: FakeClock;
  log_lines: string[];
  author: RequestUser;
  upload(bytes: Uint8Array, filename: string, token?: string, request_id?: string): Promise<HttpResponse>;
  import_link(sheet_url: string, token?: string, request_id?: string): Promise<HttpResponse>;
  list(token?: string): Promise<HttpResponse>;
  count(table: "outline_version" | "outline_row" | "audit_event"): Promise<number>;
  query(text: string, values?: unknown[]): Promise<any[]>;
  drop(): Promise<void>;
}

export async function make_stack(): Promise<Stack> {
  const tdb = await create_test_db();
  const db = tdb.db;
  await db.with_tx(async (tx) => {
    for (const u of USERS) {
      await tx.query(
        "insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,true,'x')",
        [u.id, `${u.role}@example.test`, u.name, u.role],
      );
    }
    for (const s of load_standard_rows()) {
      await tx.query(
        'insert into standard (code, "set", text, parent_code, is_leaf, eld_strand) values ($1,$2,$3,$4,$5,$6)',
        [s.code, s.set, s.text, s.parent_code, s.is_leaf, s.eld_strand],
      );
    }
  });
  const clock = new FakeClock();
  const ids = new PrefixedIdGenerator();
  const deps = { db, ids, clock };
  const repo = new PgOutlineRepo(deps);
  const standards = new PgStandardRepo(deps);
  const audit = new PgAuditLog(deps);
  const fetcher = new ScriptedFetcher();
  const service = new OutlineService(repo, standards, fetcher, audit, db, ids, clock, {
    outline_max_bytes: 5 * 1024 * 1024,
    outline_max_rows: 200,
  });
  const log = make_log();
  const with_route = make_with_route({ sessions: () => new RoleResolver(), logger: log.logger, settings: SETTINGS });
  const handlers = make_outline_handlers({ with_route, outlines: () => service });

  const base = (token: string, request_id: string, over: Partial<HttpRequest>): HttpRequest => ({
    method: "POST",
    path_params: {},
    query: {},
    headers: { origin: APP_ORIGIN, "x-request-id": request_id },
    body: null,
    cookies: { ls_session: token },
    ...over,
  });
  const query = async (text: string, values: unknown[] = []) =>
    db.with_tx(async (tx) => (await tx.query(text, values)).rows as any[]);

  return {
    tdb,
    repo,
    standards,
    service,
    fetcher,
    clock,
    log_lines: log.lines,
    author: { user_id: USERS[0].id, name: USERS[0].name, email: "author@example.test", role: "author", synthetic: true, request_id: "req_harness" } as RequestUser,
    upload: (bytes, filename, token = "valid-token", request_id = "req_upload_1") =>
      handlers.upload(
        base(token, request_id, {
          body: {
            reject: null,
            file: { filename, content_type: "application/octet-stream", data_base64: Buffer.from(bytes).toString("base64") },
          },
        }),
      ),
    import_link: (sheet_url, token = "valid-token", request_id = "req_import_1") =>
      handlers.import_link(base(token, request_id, { body: { sheet_url } })),
    list: (token = "valid-token") =>
      handlers.list_units(base(token, "req_list_1", { method: "GET", headers: { "x-request-id": "req_list_1" } })),
    count: async (table) => Number((await query(`select count(*)::int as n from ${table}`))[0].n),
    query,
    drop: () => tdb.drop(),
  };
}
