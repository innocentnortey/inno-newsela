// NL-80 frozen tests: AC-1, AC-2 (connect side), AC-10 (logs and acks). Written before the implementation.
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import type { LessonStateName, RoleName } from "@ls/core/ports/common";
import { CollabAuthenticator } from "./auth.ts";
import { FrozenDocs } from "./frozen-docs.ts";
import { WriteGuard } from "./permissions.ts";
import { wire_collab_server } from "./wiring/server.ts";
import {
  COOKIE_VALUE, DOC_NAME, FakeConnection, FakeDocStore, FakeDocument, FakeReader, FakeSessions, FakeStates, KEY_MARKER, LESSON,
  SENTENCE, capture_logger, clock, settings, sync_frame, update_with, user, stored_doc,
} from "./nl-80.fixtures.ts";

function build(state: LessonStateName = "in_review") {
  const sessions = new FakeSessions();
  const states = new FakeStates(state);
  const frozen = new FrozenDocs();
  const s = settings();
  const auth = new CollabAuthenticator(sessions, states, new WriteGuard(frozen), frozen, clock(), s);
  const req = (cookie: string | null, socket_id = "s1") => ({ document_name: DOC_NAME, cookie_header: cookie, token_param: "cookie", socket_id });
  return { sessions, states, frozen, auth, req, cookie: (t: string) => `other=1; ${s.session_cookie_name}=${t}; x=y` };
}

async function code_of(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return e instanceof DomainRefusal ? e.code : `non-refusal:${String(e)}`; }
  return "resolved";
}

describe("unauthenticated_refused_before_load [failure/refusal, AC-1]", () => {
  it("no cookie, unknown token, expired and revoked sessions are refused UNAUTHENTICATED; nothing is loaded", async () => {
    const b = build();
    b.sessions.add("expired-tok", user("reviewer"), "expired");
    b.sessions.add("revoked-tok", user("reviewer"), "revoked");
    const reader = new FakeReader();
    const results = [
      await code_of(b.auth.authenticate(b.req(null))),
      await code_of(b.auth.authenticate(b.req("a=b; unrelated=1"))),
      await code_of(b.auth.authenticate(b.req(b.cookie("unknown-tok")))),
      await code_of(b.auth.authenticate(b.req(b.cookie("expired-tok")))),
      await code_of(b.auth.authenticate(b.req(b.cookie("revoked-tok")))),
    ];
    expect(results).toEqual(Array(5).fill("UNAUTHENTICATED"));
    expect(b.states.get_calls).toBe(0);
    expect(reader.latest_calls).toBe(0);
    expect(b.frozen.is_frozen(LESSON)).toBe(true); // never seeded: fail closed
  });

  it("[boundary] a missing or empty cookie never reaches the session repository", async () => {
    const b = build();
    expect(await code_of(b.auth.authenticate(b.req(null)))).toBe("UNAUTHENTICATED");
    expect(await code_of(b.auth.authenticate(b.req(`${settings().session_cookie_name}=`)))).toBe("UNAUTHENTICATED");
    expect(b.sessions.resolve_calls).toBe(0);
  });

  it("[invariant] the websocket token parameter is not an identity; only the cookie is", async () => {
    const b = build();
    b.sessions.add("tok", user("reviewer"));
    const r = { document_name: DOC_NAME, cookie_header: null, token_param: "tok", socket_id: "s" };
    expect(await code_of(b.auth.authenticate(r))).toBe("UNAUTHENTICATED");
  });

  it("[boundary] a malformed document name is refused without touching the database", async () => {
    const b = build();
    b.sessions.add("tok", user("reviewer"));
    const r = { document_name: "not-a-lesson", cookie_header: b.cookie("tok"), token_param: null, socket_id: "s" };
    expect(await code_of(b.auth.authenticate(r))).toBe("NOT_FOUND");
    expect(b.states.get_calls).toBe(0);
  });
});

describe("connect context per role and state [invariant, AC-2]", () => {
  it("on in_review: author and approver connect read_only, reviewer writable; context carries the lesson", async () => {
    const out: Record<string, boolean> = {};
    for (const role of ["author", "approver", "reviewer"] as RoleName[]) {
      const b = build("in_review");
      b.sessions.add("tok", user(role));
      const ctx = await b.auth.authenticate(b.req(b.cookie("tok"), `s-${role}`));
      expect(ctx).toMatchObject({ socket_id: `s-${role}`, lesson_id: LESSON, lesson_state: "in_review" });
      expect(ctx.user.role).toBe(role);
      out[role] = ctx.read_only;
    }
    expect(out).toEqual({ author: true, approver: true, reviewer: false });
  });

  it("every role is read_only on draft, submitted, approved and exported, and the doc is seeded frozen", async () => {
    for (const state of ["draft", "submitted", "approved", "exported"] as const) {
      for (const role of ["author", "approver", "reviewer"] as RoleName[]) {
        const b = build(state);
        b.sessions.add("tok", user(role));
        const ctx = await b.auth.authenticate(b.req(b.cookie("tok")));
        expect(ctx.read_only, `${role}/${state}`).toBe(true);
        expect(b.frozen.is_frozen(LESSON)).toBe(true);
      }
    }
  });

  it("[invariant] first connect seeds FrozenDocs from the lesson state (in_review -> not frozen)", async () => {
    const b = build("in_review");
    b.sessions.add("tok", user("reviewer"));
    await b.auth.authenticate(b.req(b.cookie("tok")));
    expect(b.frozen.is_frozen(LESSON)).toBe(false);
  });
});

describe("no_cookie_text_or_key_in_logs [negative, AC-10]", () => {
  const prior = process.env["ANTHROPIC_API_KEY"];
  afterEach(() => {
    if (prior === undefined) delete process.env["ANTHROPIC_API_KEY"];
    else process.env["ANTHROPIC_API_KEY"] = prior;
    vi.restoreAllMocks();
  });

  it("cookie value, lesson sentence and provider-key marker appear in no log line and no ack to other clients", async () => {
    process.env["ANTHROPIC_API_KEY"] = KEY_MARKER;
    const sessions = new FakeSessions();
    sessions.add(COOKIE_VALUE, user("reviewer", "u-rev-1"));
    sessions.add("author-tok", user("author", "u-auth-1"));
    const { logger, lines } = capture_logger();
    const hocus = { configuration: { extensions: [] as unknown[], debounce: 0, maxDebounce: 0 }, documents: new Map<string, FakeDocument>() };
    const w = wire_collab_server(
      { settings: settings(), logger, db: {} as never, ids: {} as never, clock: clock() },
      { hocuspocus: hocus },
      { sessions, states: new FakeStates("in_review"), doc_store: new FakeDocStore(), doc_reader: new FakeReader(stored_doc()) },
    );
    const hooks = w.extension as unknown as Record<string, (p: unknown) => Promise<any>>;
    const cookie_name = settings().session_cookie_name;

    // refused connect first (logged), then two real connections
    await expect(hooks["onAuthenticate"]!({ documentName: DOC_NAME, requestHeaders: new Headers({ cookie: `${cookie_name}=BADTOKEN-${COOKIE_VALUE}` }),
      token: "cookie", socketId: "bad", connectionConfig: {} })).rejects.toBeInstanceOf(DomainRefusal);
    const cfg_rev: { readOnly?: boolean } = {};
    const rev = await hooks["onAuthenticate"]!({ documentName: DOC_NAME, requestHeaders: new Headers({ cookie: `${cookie_name}=${COOKIE_VALUE}` }),
      token: "cookie", socketId: "s-rev", connectionConfig: cfg_rev });
    const cfg_auth: { readOnly?: boolean } = {};
    const aut = await hooks["onAuthenticate"]!({ documentName: DOC_NAME, requestHeaders: new Headers({ cookie: `${cookie_name}=author-tok` }),
      token: "cookie", socketId: "s-auth", connectionConfig: cfg_auth });
    expect(cfg_rev.readOnly).toBe(false);
    expect(cfg_auth.readOnly).toBe(true);

    const c_rev = new FakeConnection("s-rev", rev);
    const c_auth = new FakeConnection("s-auth", aut);
    const doc = new FakeDocument([c_rev, c_auth]);
    hocus.documents.set(DOC_NAME, doc);
    await hooks["onLoadDocument"]!({ document: doc, documentName: DOC_NAME });
    await hooks["connected"]!({ connection: c_rev, documentName: DOC_NAME });
    await hooks["connected"]!({ connection: c_auth, documentName: DOC_NAME });

    // freeze, then the reviewer types the distinctive sentence: refused
    w.frozen.freeze(LESSON);
    const sv_before = Y.encodeStateVector(doc);
    const upd = update_with(SENTENCE);
    await hooks["beforeHandleMessage"]!({ connection: c_rev, document: doc, documentName: DOC_NAME, update: sync_frame(DOC_NAME, 2, upd), context: rev });
    expect(c_rev.sent.some((m) => JSON.parse(m).type === "refused")).toBe(true);

    const everything = [...lines, ...c_auth.sent, ...c_rev.sent].join("\n");
    for (const needle of [COOKIE_VALUE, SENTENCE, KEY_MARKER, "BADTOKEN"]) expect(everything, needle).not.toContain(needle);
    expect(c_auth.sent.every((m) => JSON.parse(m).type === "mode")).toBe(true); // co-editor got no refused/stored from the typist
    expect(lines.some((l) => l.includes(LESSON))).toBe(true); // refusal is logged with the lesson id
    expect(Y.encodeStateVector(doc)).toEqual(sv_before); // the refused update was never applied
  });
});
