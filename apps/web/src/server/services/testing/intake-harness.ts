// NL-77 test harness: the NL-26 stack plus the intake handlers (report, choices) and a second author.
import { DomainRefusal } from "@ls/core/errors";
import type { RequestUser } from "@ls/core/ports/common";
import { make_intake_handlers } from "../../../../app/api/outline-versions/[outlineVersionId]/http.ts";
import { make_with_route, type HttpRequest, type HttpResponse, type SessionResolver } from "../../http/with-route.ts";
import { APP_ORIGIN, SETTINGS, make_log } from "../../http/testing/route-fixtures.ts";
import { USERS, issued_xlsx_bytes, make_stack, type Stack } from "./outline-harness.ts";

export const AUTHOR2 = { id: "usr_synthetic_author2", name: "Second author", role: "author", token: "author2-token" } as const;
const ALL_USERS = [...USERS, AUTHOR2];

class IntakeResolver implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    const u = ALL_USERS.find((x) => x.token === token);
    if (!u) throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    return { user_id: u.id, name: u.name, email: `${u.id}@example.test`, role: u.role, synthetic: true, request_id };
  }
}

export interface IntakeStack extends Stack {
  intake_lines: string[];
  all_log_text(): string;
  report(id: string, token?: string, headers?: Record<string, string>): Promise<HttpResponse>;
  choose(id: string, body: unknown, token?: string, headers?: Record<string, string>, request_id?: string): Promise<HttpResponse>;
  uploads_issued(): Promise<string>;
}

export async function make_intake_stack(): Promise<IntakeStack> {
  const s = await make_stack();
  await s.tdb.db.with_tx(async (tx) => {
    await tx.query("insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,true,'x')", [
      AUTHOR2.id,
      "author2@example.test",
      AUTHOR2.name,
      AUTHOR2.role,
    ]);
  });
  const log = make_log();
  const with_route = make_with_route({ sessions: () => new IntakeResolver(), logger: log.logger, settings: SETTINGS });
  const handlers = make_intake_handlers({ with_route, outlines: () => s.service });
  let n = 0;
  const req = (id: string, token: string, headers: Record<string, string>, over: Partial<HttpRequest>): HttpRequest => ({
    method: "GET",
    path_params: { outlineVersionId: id },
    query: {},
    headers: { origin: APP_ORIGIN, "x-request-id": `req_intake_${++n}`, ...headers },
    body: null,
    cookies: { ls_session: token },
    ...over,
  });
  return {
    ...s,
    intake_lines: log.lines,
    all_log_text: () => [...s.log_lines, ...log.lines].join("\n"),
    report: (id, token = "valid-token", headers = {}) => handlers.get_report(req(id, token, headers, {})),
    choose: (id, body, token = "valid-token", headers = {}, request_id) =>
      handlers.record_choice(
        req(id, token, request_id === undefined ? headers : { ...headers, "x-request-id": request_id }, { method: "POST", body: body as HttpRequest["body"] }),
      ),
    uploads_issued: async () => {
      const r = await s.upload(issued_xlsx_bytes(), "issued.xlsx");
      if (r.status !== 201) throw new Error("issued upload failed: " + r.status);
      return (r.body as { outline_version_id: string }).outline_version_id;
    },
  };
}
