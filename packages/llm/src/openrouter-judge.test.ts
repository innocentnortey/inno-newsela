// NL-89 frozen tests (risk::security): AC-1, AC-2, AC-3 (adapter half). Do not edit.
// Responses are inline recorded-shape bodies served through the injected fetch_impl: no network.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { ProviderError } from "@ls/core/errors";
import type { JudgeRequest } from "@ls/core/ports/judge-client";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import { OpenRouterJudgeAdapter } from "./openrouter-judge.ts";

const KEY = "sk-or-marker-KEY-8842";
const LESSON_MARKER = "LESSON-MARKER-7731";
const AUTHOR_MARKER = "AUTHOR-MARKER-4402";
const OTHER_MARKER = "OTHER-LESSON-MARKER-9915";
const BASE = "https://judge.invalid/api/v1";

const req: JudgeRequest = {
  lesson_id: `G6.U4.L4-${LESSON_MARKER}` as LessonId,
  content_hash: ("sha256:" + "a".repeat(64)) as Sha256,
  address: `Lesson.Part1.${AUTHOR_MARKER}`,
  code: "RL.6.1",
  standard_text: "Cite textual evidence to support analysis of what the text says.",
  activity_text: "Students underline two sentences that support their claim and explain each choice.",
  question: "teaches_standard",
  rubric_version: `rubric-${OTHER_MARKER}`,
};

const ok_body = (verdict: "yes" | "no", extra: Record<string, unknown> = {}) => ({
  id: "gen-synthetic-1",
  model: "judge-model-served",
  choices: [{ message: { content: JSON.stringify({ verdict, rationale: `because ${verdict}` }) } }],
  usage: { prompt_tokens: 123, completion_tokens: 45 },
  ...extra,
});
const json_response = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

interface Captured {
  url: string;
  init: RequestInit;
}
function fake_fetch(respond: (n: number) => Response | Promise<Response>) {
  const seen: Captured[] = [];
  const fetch_impl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    return respond(seen.length);
  }) as typeof fetch;
  return { seen, fetch_impl };
}
const adapter = (fetch_impl: typeof fetch) =>
  new OpenRouterJudgeAdapter({ api_key: new SecretStr(KEY), model_id: "judge-model-requested", timeout_ms: 5000, base_url: BASE, fetch_impl });
const body_of = (c: Captured) => JSON.parse(String(c.init.body)) as Record<string, unknown>;

afterEach(() => vi.restoreAllMocks());

describe("OpenRouterJudgeAdapter (NL-89)", () => {
  it("request_has_only_the_four_inputs [invariant] AC-1", async () => {
    const f = fake_fetch(() => json_response(ok_body("yes"), 200, { "x-request-id": "req-hdr-1" }));
    const res = await adapter(f.fetch_impl).verdict(req);
    expect(res).toMatchObject({
      verdict: "yes",
      rationale: "because yes",
      served_model: "judge-model-served",
      usage: { input_tokens: 123, output_tokens: 45, cache_read_tokens: 0, cache_write_tokens: 0 },
      provider_request_id: "req-hdr-1",
    });
    expect(JSON.parse(res.raw_text)).toEqual({ verdict: "yes", rationale: "because yes" });

    expect(f.seen).toHaveLength(1);
    expect(f.seen[0]!.url).toBe(`${BASE}/chat/completions`);
    expect(f.seen[0]!.init.method).toBe("POST");
    const body = body_of(f.seen[0]!);
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "response_format", "temperature"]);
    expect(body["model"]).toBe("judge-model-requested");
    const messages = body["messages"] as { role: string; content: string }[];
    const user = messages.find((m) => m.role === "user")!;
    const parsed = JSON.parse(user.content) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["activity_text", "question", "rubric", "standard_text"]);
    expect(parsed["activity_text"]).toBe(req.activity_text);
    expect(parsed["standard_text"]).toBe(req.standard_text);
    expect(typeof parsed["rubric"]).toBe("string");
    expect(typeof parsed["question"]).toBe("string");
  });

  it("returns a no verdict and falls back to the body id for provider_request_id [boundary] AC-1", async () => {
    const f = fake_fetch(() => json_response(ok_body("no")));
    const res = await adapter(f.fetch_impl).verdict({ ...req, question: "eld_keeps_task" });
    expect(res.verdict).toBe("no");
    expect(res.provider_request_id).toBe("gen-synthetic-1");
    const q = (JSON.parse((body_of(f.seen[0]!)["messages"] as { role: string; content: string }[]).find((m) => m.role === "user")!.content) as { question: string }).question;
    expect(q).not.toBe("");
  });

  it("no_identifiers_or_key_leak [negative] AC-2", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const leaky_req = { ...req, author_name: AUTHOR_MARKER, other_lesson_text: OTHER_MARKER } as JudgeRequest;
    const f = fake_fetch(() => json_response(ok_body("yes")));
    await adapter(f.fetch_impl).verdict(leaky_req);

    const c = f.seen[0]!;
    const markers = [LESSON_MARKER, AUTHOR_MARKER, OTHER_MARKER, "G6.U4.L4", req.content_hash, req.address, req.rubric_version];
    for (const m of markers) expect(String(c.init.body), `body has ${m}`).not.toContain(m);
    expect(String(c.init.body)).not.toContain(KEY);
    expect(c.url).not.toContain(KEY);
    const headers = new Headers(c.init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    for (const [name, value] of headers) {
      if (name.toLowerCase() === "authorization") continue;
      for (const m of [...markers, KEY]) expect(value, `header ${name}`).not.toContain(m);
    }

    // failure paths: a fetch error and a 500 body that both echo the key and the request must not surface them
    const echo = [
      fake_fetch(() => { throw new TypeError(`fetch failed ${BASE} Bearer ${KEY} ${LESSON_MARKER}`); }),
      fake_fetch(() => new Response(`echo ${KEY} ${LESSON_MARKER} ${AUTHOR_MARKER} ${OTHER_MARKER}`, { status: 500 })),
    ];
    for (const e of echo) {
      const err = await adapter(e.fetch_impl).verdict(leaky_req).then(() => null, (x: unknown) => x);
      expect(err).toBeInstanceOf(ProviderError);
      const e2 = err as ProviderError;
      const dump = [e2.message, e2.stack ?? "", JSON.stringify(e2), String(e2)].join("\n");
      for (const m of [KEY, LESSON_MARKER, AUTHOR_MARKER, OTHER_MARKER, BASE]) expect(dump).not.toContain(m);
    }
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const m of [KEY, LESSON_MARKER, AUTHOR_MARKER, OTHER_MARKER]) expect(logged).not.toContain(m);
  });

  it("provider_errors_map_to_kinds [failure] AC-3", async () => {
    const cases: { name: string; respond: () => Response; kind: string }[] = [
      { name: "timeout", respond: () => { throw new DOMException("signal timed out", "TimeoutError"); }, kind: "timeout" },
      { name: "429", respond: () => json_response({ error: "slow down" }, 429, { "retry-after": "7" }), kind: "rate_limited" },
      { name: "500", respond: () => json_response({ error: "boom" }, 500), kind: "server_error" },
      { name: "unparsable 200", respond: () => new Response("<html>not json</html>", { status: 200 }), kind: "server_error" },
      { name: "200 wrong verdict value", respond: () => json_response(ok_body("yes", { choices: [{ message: { content: '{"verdict":"maybe","rationale":"x"}' } }] })), kind: "server_error" },
      { name: "200 extra key in content", respond: () => json_response(ok_body("yes", { choices: [{ message: { content: '{"verdict":"yes","rationale":"x","extra":1}' } }] })), kind: "server_error" },
    ];
    for (const c of cases) {
      const f = fake_fetch(() => c.respond());
      const err = await adapter(f.fetch_impl).verdict(req).then(() => null, (x: unknown) => x);
      expect(err, c.name).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind, c.name).toBe(c.kind);
      expect(f.seen, `${c.name}: no retry`).toHaveLength(1);
      if (c.kind === "rate_limited") expect((err as ProviderError).retry_after_s).toBe(7);
    }
  });
});
