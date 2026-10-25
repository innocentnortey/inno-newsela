// NL-105 frozen test: AC-13 (wiring half). No database: the repos are injected through `given`.
import { afterEach, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { AckBroadcaster } from "../acks.ts";
import { FrozenDocs } from "../frozen-docs.ts";
import { CollabCommandHandler, install_command_handler } from "../commands/routes.ts";
import { FakeDocStore, FakeReader, FakeStates, capture_logger, clock, settings } from "../nl-80.fixtures.ts";
import { FakeStandards, FakeVersions, LESSON, TOKEN, bearer, http_harness, mode_body } from "../commands/nl-105.fixtures.ts";
import { wire_collab_commands } from "./commands.ts";

const cap = capture_logger();
const deps = () => ({ settings: settings(), logger: cap.logger, db: {} as never, ids: new PrefixedIdGenerator(), clock: clock() });
const sw = () => ({ frozen: new FrozenDocs(), acks: new AckBroadcaster({ sockets_of: () => [], find: () => undefined }), persistence: {} as never }) as never;

afterEach(() => install_command_handler(null));

describe("wire_commands_builds_handler [invariant, AC-13]", () => {
  it("returns a CollabCommandHandler that carries the three commands and the configured token", () => {
    const w = wire_collab_commands(deps(), sw(), { hocuspocus: null }, {
      store: new FakeDocStore(), reader: new FakeReader(), states: new FakeStates(), versions: new FakeVersions() as never, standards: new FakeStandards() as never,
    });
    expect(w.handler).toBeInstanceOf(CollabCommandHandler);
    for (const m of ["apply_edit", "set_mode", "lock_and_snapshot"] as const) expect(typeof w.handler[m]).toBe("function");
    expect(w.handler.deps.token.reveal()).toBe(TOKEN);
  });

  it("[boundary] builds with no database reachable and nothing injected (the pool is lazy), so the runtime still starts", () => {
    expect(() => wire_collab_commands(deps(), sw(), { hocuspocus: null })).not.toThrow();
  });

  it("installs the handler behind the routes: the token is required and a good call reaches the wired set_mode", async () => {
    const frozen = new FrozenDocs();
    wire_collab_commands(deps(), { ...(sw() as object), frozen } as never, { hocuspocus: null }, {
      states: new FakeStates("in_review"), store: new FakeDocStore(), reader: new FakeReader(), versions: new FakeVersions() as never, standards: new FakeStandards() as never,
    });
    const http = await http_harness(cap.logger);
    try {
      const denied = await http.post(LESSON, "set-mode", mode_body({ mode: "editable", state: "in_review" }));
      expect(denied.status).toBe(401);
      expect(frozen.is_frozen(LESSON)).toBe(true);
      const ok = await http.post(LESSON, "set-mode", mode_body({ mode: "editable", state: "in_review" }), bearer());
      expect(ok.status).toBe(200);
      expect(ok.json).toEqual({ lesson_id: LESSON, mode: "editable", connections_notified: 0 });
      expect(frozen.is_frozen(LESSON)).toBe(false);
    } finally {
      await http.close();
    }
  });

  it("[invariant] injected fakes override the built repositories", () => {
    const states = new FakeStates();
    const w = wire_collab_commands(deps(), sw(), { hocuspocus: null }, { states });
    expect(w.handler.deps.states).toBe(states);
  });
});
