// NL-105 frozen tests: AC-1, AC-2, AC-3, AC-12 (replaces the NL-07 shell test). No database: a recording fake stands in
// for CollabCommandHandler and the real handle_internal runs behind a bare node http server.
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import { capture_logger, KEY_MARKER } from "../nl-80.fixtures.ts";
import { install_command_handler } from "./routes.ts";
import { ROUTES, RecordingHandler, TOKEN, bearer, body_for, edit_body, http_harness, mode_body, rid, type Http } from "./nl-105.fixtures.ts";

const cap = capture_logger();
let http: Http;
let handler: RecordingHandler;
const install = (h: RecordingHandler | null) => install_command_handler(h as never);

beforeAll(async () => {
  http = await http_harness(cap.logger);
});
afterAll(async () => {
  install(null);
  await http.close();
});
afterEach(() => {
  install(null);
  cap.lines.length = 0;
});
function fresh(): RecordingHandler {
  handler = new RecordingHandler();
  install(handler);
  return handler;
}

describe("missing_or_wrong_token_401_writes_nothing [failure/refusal, AC-1]", () => {
  const bad: [string, Record<string, string>][] = [
    ["no header", {}],
    ["wrong token", bearer("wrong")],
    ["differs only in the last byte", bearer(TOKEN.slice(0, -1) + "X")],
    ["shorter than the token", bearer(TOKEN.slice(0, 3))],
    ["longer than the token", bearer(TOKEN + "-extra")],
    ["empty bearer", { authorization: "Bearer " }],
    ["wrong scheme", { authorization: `Basic ${TOKEN}` }],
    ["bare token without scheme", { authorization: TOKEN }],
  ];
  for (const route of ROUTES) {
    it.each(bad)(`${route}: 401 Error envelope, handler never entered (%s)`, async (_n, headers) => {
      const h = fresh();
      const res = await http.post("G6.U4.L4", route, body_for(route), headers);
      expect(res.status).toBe(401);
      expect(res.json.error.code).toBe("UNAUTHENTICATED");
      expect(typeof res.json.error.message).toBe("string");
      expect(h.calls).toEqual([]);
    });
  }

  it("[invariant] the guard runs before the body is read and the path is validated, for every method", async () => {
    const h = fresh();
    const unknown_path = await fetch(`${http.base}/internal/lessons/G6.U4.L4/not-a-route`, { method: "POST", body: "{not json" });
    expect(unknown_path.status).toBe(401);
    for (const method of ["GET", "PUT", "DELETE"]) {
      const res = await fetch(`${http.base}/internal/lessons/G6.U4.L4/apply-edit`, { method });
      expect(res.status).toBe(401);
    }
    expect(h.calls).toEqual([]);
  });

  it("[regression] with no handler installed the shell behaviour holds: 503 COLLAB_UNAVAILABLE and the not_built log line", async () => {
    install(null);
    const res = await http.post("G6.U4.L4", "apply-edit", edit_body(), bearer());
    expect(res.status).toBe(503);
    expect(res.json.error.code).toBe("COLLAB_UNAVAILABLE");
    expect(cap.lines.some((l) => l.includes("internal.not_built"))).toBe(true);
  });
});

describe("authorized requests reach the handler [invariant, supports AC-1/AC-3]", () => {
  it("a good token and a valid body call the matching method once; the refusal envelope carries the code, status and request_id", async () => {
    const h = fresh();
    const ok = await http.post("G6.U4.L4", "set-mode", mode_body(), bearer());
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ lesson_id: "G6.U4.L4", mode: "read_only" });
    const edit = await http.post("G6.U4.L4", "apply-edit", edit_body(), bearer());
    expect(edit.status).toBe(200);
    expect(typeof edit.json.stored_at).toBe("string");
    expect(h.calls.map((c) => c.method)).toEqual(["set_mode", "apply_edit"]);
    expect(h.calls[1]!.cmd).toMatchObject({ lesson_id: "G6.U4.L4", request_id: rid(1), tag: "standard-decision" });

    for (const [code, status] of [["LESSON_LOCKED", 409], ["ANCHOR_CHANGED", 409], ["NOT_FOUND", 404]] as const) {
      h.fail_with = new DomainRefusal(code, "refused", { state: "submitted" });
      const res = await http.post("G6.U4.L4", "apply-edit", edit_body(), bearer());
      expect(res.status).toBe(status);
      expect(res.json.error.code).toBe(code);
      expect(res.json.error.details.request_id).toBe(rid(1));
    }
    h.fail_with = new DomainRefusal("LESSON_LOCKED", "locked", { state: "submitted" });
    const locked = await http.post("G6.U4.L4", "apply-edit", edit_body(), bearer());
    expect(locked.json.error.details.state).toBe("submitted");
  });
});

describe("constant_time_compare_and_no_token_in_logs [negative, AC-2]", () => {
  it("routes.ts compares with crypto.timingSafeEqual", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).toMatch(/timingSafeEqual/);
  });

  it("the token and every wrong token appear in no log line or response, accepted or refused", async () => {
    fresh();
    const bodies: string[] = [];
    for (const route of ROUTES) {
      for (const t of ["wrong-token-ZZ", TOKEN.slice(0, -1) + "X", TOKEN]) {
        const res = await http.post("G6.U4.L4", route, body_for(route), bearer(t));
        bodies.push(res.text);
      }
      bodies.push((await http.post("G6.U4.L4", route, body_for(route))).text);
    }
    const all = [...bodies, ...cap.lines].join("\n");
    expect(all).not.toContain(TOKEN);
    expect(all).not.toContain("wrong-token-ZZ");
    expect(all).not.toContain(TOKEN.slice(0, -1) + "X");
    expect(all.toLowerCase()).not.toContain("bearer ");
  });
});

describe("invalid_body_400 [failure/refusal, AC-3]", () => {
  const good = () => edit_body();
  const cases: [string, unknown, string | null][] = [
    ["malformed JSON", "{not json", null],
    ["missing tag", (() => { const b = good(); delete b["tag"]; return b; })(), "tag"],
    ["tag does not match edit.kind", edit_body({ tag: "slot-fill" }), null],
    ["empty slot text", edit_body({ tag: "slot-fill", edit: { kind: "slot_fill", slot_id: "slot-1", text: "", source_ref: { title: "t" }, rights_status: "licensed" } }), "edit.text"],
    ["unknown decision", edit_body({ edit: { kind: "standard", code: "RL.6.1", decision: "explode", restore: null } }), "edit.decision"],
    ["unknown extra field", edit_body({ anchored_text_now: "alpha" }), null],
    ["null acting user", edit_body({ actor: { user_id: null, name: "system", role: null, synthetic: true } }), null],
    ["section adopt without an address", edit_body({ tag: "candidate-adopt", edit: { kind: "adopt", candidate_version_id: "ver_x", scope: "section", section_address: null } }), null],
    ["lesson_id differs from the path", edit_body({}, "G6.U4.L9"), null],
    ["empty request_id", edit_body({ request_id: "" }), "request_id"],
  ];
  it.each(cases)("apply-edit: 400 INVALID_REQUEST, nothing applied (%s)", async (_n, body, field) => {
    const h = fresh();
    const res = await http.post("G6.U4.L4", "apply-edit", body, bearer());
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_REQUEST");
    if (field !== null) expect(res.json.error.details.fields).toContain(field);
    expect(h.calls).toEqual([]);
  });

  it("set-mode: a bad mode names the field; nothing applied", async () => {
    const h = fresh();
    const res = await http.post("G6.U4.L4", "set-mode", mode_body({ mode: "sideways" }), bearer());
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_REQUEST");
    expect(res.json.error.details.fields).toContain("mode");
    expect(h.calls).toEqual([]);
  });

  it("[boundary] a body over 1 MiB is refused 400 INVALID_REQUEST; an unknown route is 404 NOT_FOUND", async () => {
    const h = fresh();
    const huge = edit_body({ request_id: "r".repeat(1_100_000) });
    const res = await http.post("G6.U4.L4", "apply-edit", huge, bearer());
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_REQUEST");
    const nf = await http.post("G6.U4.L4", "no-such-route", {}, bearer());
    expect(nf.status).toBe(404);
    expect(nf.json.error.code).toBe("NOT_FOUND");
    expect(h.calls).toEqual([]);
  });
});

describe("no_secrets_anywhere [negative, AC-12]", () => {
  it("neither the internal token nor a provider-key marker in the environment reaches any response or log line, on success, refusal or internal failure", async () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = KEY_MARKER;
    try {
      const h = fresh();
      const seen: string[] = [];
      for (const route of ROUTES) seen.push((await http.post("G6.U4.L4", route, body_for(route), bearer())).text);
      h.fail_with = new DomainRefusal("LESSON_LOCKED", "locked", { state: "submitted" });
      for (const route of ROUTES) seen.push((await http.post("G6.U4.L4", route, body_for(route), bearer())).text);
      h.fail_with = new Error(`boom ${KEY_MARKER} ${TOKEN} Bearer ${TOKEN}`);
      for (const route of ROUTES) {
        const res = await http.post("G6.U4.L4", route, body_for(route), bearer());
        expect(res.status).toBeGreaterThanOrEqual(500);
        seen.push(res.text);
      }
      seen.push((await http.post("G6.U4.L4", "apply-edit", edit_body({ request_id: "" }), bearer(TOKEN))).text);
      const all = [...seen, ...cap.lines].join("\n");
      expect(all).not.toContain(KEY_MARKER);
      expect(all).not.toContain(TOKEN);
    } finally {
      if (saved === undefined) delete process.env["ANTHROPIC_API_KEY"];
      else process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });
});
