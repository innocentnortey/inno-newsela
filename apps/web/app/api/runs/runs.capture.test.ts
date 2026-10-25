// NL-27 AC-12: what a start writes (component level, in-memory doubles that record writes).
import { describe, expect, it } from "vitest";
import { make_with_route } from "@/server/http/with-route";
import { make_deps, make_request } from "@/server/http/testing/route-fixtures";
import { make_start_run_handler } from "@/server/services/run-start-route";
import { build_outline, make_service, OUTLINE_VERSION_ID, PROMPT_VERSION_ID } from "@/server/services/testing/run-service-fakes";

const body = { outline_version_id: OUTLINE_VERSION_ID, mode: "run", scope: { kind: "all" }, prompt_version_id: PROMPT_VERSION_ID, cap_usd: 13 };

interface Body { state?: string; run_id?: string; error: { code: string } }
const B = (r: { body: unknown }): Body => r.body as Body;

describe("runs capture", () => {
  it("a start writes one run, 48 jobs and one run.start audit event", async () => {
    const kit = make_service();
    const d = make_deps();
    const handler = make_start_run_handler(make_with_route(d.deps), () => kit.service);
    const res = await handler(make_request({ body: body as never }));
    const counts = { runs: kit.runs.inserted.length, jobs: kit.queue.created.length, audit: kit.audit.appended.length };
    console.log("rows", counts);
    expect(res.status).toBe(201);
    expect(counts).toEqual({ runs: 1, jobs: 48, audit: 1 });
    const run_id = B(res).run_id;
    expect(kit.queue.created.every((j) => j.run_id === run_id)).toBe(true);
    expect(kit.runs.inserted[0]?.prompt_version_id).toBe(PROMPT_VERSION_ID);
    expect(kit.audit.appended[0]?.action).toBe("run.start");
  });

  it("a refusal writes nothing and logs one route.refused line with the request id", async () => {
    const kit = make_service({ outline: build_outline({ errors_unconfirmed: true }) });
    const d = make_deps();
    const handler = make_start_run_handler(make_with_route(d.deps), () => kit.service);
    const res = await handler(make_request({ body: body as never }));
    expect(res.status).toBe(422);
    expect(B(res).error.code).toBe("VALIDATION_INCOMPLETE");
    expect([kit.runs.inserted.length, kit.queue.created.length, kit.audit.appended.length]).toEqual([0, 0, 0]);
    const refused = d.lines.map((l) => JSON.parse(l) as { event: string; request_id: string }).filter((l) => l.event === "route.refused");
    expect(refused).toHaveLength(1);
    expect(refused[0]?.request_id).toBe(res.headers["X-Request-Id"]);
  });
});
