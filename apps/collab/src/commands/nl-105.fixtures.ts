// NL-105 frozen fixtures: HTTP harness for the /internal routes, a recording handler, fakes for the repos the
// handler consumes, and the synthetic lesson used by the apply-edit tests. No database, no @ls/db import.
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { DomainRefusal } from "@ls/core/errors";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type { LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { StandardRow } from "@ls/core/ports/standards";
import type { Logger } from "@ls/obs/logger";
import type { StoredLesson } from "@ls/schema/lesson";
import { handle_internal } from "./routes.ts";
import { LESSON, NOW, wp1 } from "../nl-80.fixtures.ts";

export { LESSON, NOW, wp1 };
export const TOKEN = "t-collab";
export const ROUTES = ["lock-and-snapshot", "apply-edit", "set-mode"] as const;
export type Route = (typeof ROUTES)[number];

/** `req_` + 26 Crockford characters. */
export const rid = (n: number): string => `req_${String(n).padStart(26, "0")}`;

export const actor = (id = "u-rev-1", role: "author" | "reviewer" | "approver" = "reviewer") => ({
  user_id: id,
  name: `Synthetic ${id}`,
  role,
  synthetic: true,
});

export function edit_body(over: Record<string, unknown> = {}, lesson_id = LESSON): Record<string, unknown> {
  return {
    lesson_id,
    actor: actor(),
    request_id: rid(1),
    tag: "standard-decision",
    edit: { kind: "standard", code: "RL.6.1", decision: "confirm", restore: null },
    ...over,
  };
}
export const mode_body = (over: Record<string, unknown> = {}, lesson_id = LESSON): Record<string, unknown> => ({
  lesson_id,
  mode: "read_only",
  state: "submitted",
  request_id: rid(2),
  ...over,
});
export const submit_body = (lesson_id = LESSON): Record<string, unknown> => ({
  lesson_id,
  actor: actor(),
  client_state_vector: "AAA=",
  request_id: rid(3),
});
export function body_for(route: Route, lesson_id = LESSON): Record<string, unknown> {
  return route === "apply-edit" ? edit_body({}, lesson_id) : route === "set-mode" ? mode_body({}, lesson_id) : submit_body(lesson_id);
}

export interface Http {
  base: string;
  post(lesson_id: string, route: string, body: unknown, headers?: Record<string, string>): Promise<{ status: number; text: string; json: any }>;
  close(): Promise<void>;
}
/** A bare node server that hands every request to the real `handle_internal`, as main.ts does. */
export async function http_harness(logger: Logger): Promise<Http> {
  const server: HttpServer = createServer((req, res) => {
    void Promise.resolve(handle_internal(req, res, logger)).catch(() => res.destroy());
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    async post(lesson_id, route, body, headers = {}) {
      const res = await fetch(`${base}/internal/lessons/${encodeURIComponent(lesson_id)}/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* not json */
      }
      return { status: res.status, text, json };
    },
    close: () => new Promise<void>((r) => void server.close(() => r())),
  };
}
export const bearer = (t: string = TOKEN): Record<string, string> => ({ authorization: `Bearer ${t}` });

export function store_ack(lesson_id = LESSON): StoreAck {
  return {
    lesson_id,
    store_id: "st_00000000000000000000000009",
    seq: 2,
    content_hash: "h".repeat(64),
    state_vector: "AAA=",
    stored_at: NOW,
    stored_by: "u-rev-1",
    check_job_enqueued: true,
  } as StoreAck;
}

/** Stands in for CollabCommandHandler: records each call and can be told to fail. */
export class RecordingHandler {
  calls: { method: string; cmd: any }[] = [];
  fail_with: unknown = null;
  async apply_edit(cmd: unknown): Promise<StoreAck> {
    return this.run("apply_edit", cmd, store_ack(), cmd);
  }
  async set_mode(cmd: any): Promise<unknown> {
    return this.run("set_mode", cmd, { lesson_id: cmd?.lesson_id, mode: cmd?.mode, connections_notified: 0 }, cmd);
  }
  async lock_and_snapshot(cmd: unknown): Promise<never> {
    this.calls.push({ method: "lock_and_snapshot", cmd });
    throw this.fail_with ?? new DomainRefusal("COLLAB_UNAVAILABLE", "not available", {});
  }
  private run<T>(method: string, cmd: unknown, ok: T, _c: unknown): T {
    this.calls.push({ method, cmd });
    if (this.fail_with !== null) throw this.fail_with;
    return ok;
  }
}

// ---- apply-edit fixtures ---------------------------------------------------------------------------------

const para = (text: string) => ({ type: "paragraph", attrs: { align: null }, content: [{ type: "text", text }] });
export const doc_of = (...blocks: unknown[]) => ({ type: "doc", content: blocks });
export const SLOT = "slot-1";
export const LIVE_TEXT = "alpha beta gamma";

/** WP-1 with `literacy_lab` holding one paragraph (LIVE_TEXT) and one quote_placeholder (SLOT). */
export function lesson_with_slot(lesson_id: string): StoredLesson {
  const l = wp1();
  return {
    ...l,
    lesson_id,
    sections: l.sections.map((s) =>
      s.address === "literacy_lab"
        ? { ...s, content: doc_of(para(LIVE_TEXT), { type: "quote_placeholder", attrs: { slot_id: SLOT, reason: "needs a quote" } }) }
        : s,
    ),
  } as unknown as StoredLesson;
}
/** A second draft of the same lesson: every section's content differs, title differs. */
export function candidate_of(lesson_id: string): StoredLesson {
  const l = lesson_with_slot(lesson_id);
  return {
    ...l,
    title: "CANDIDATE TITLE",
    sections: l.sections.map((s) => ({ ...s, content: doc_of(para(`Candidate text for ${s.address}`)) })),
  } as unknown as StoredLesson;
}

export const CANDIDATE_ID = "ver_candidate_000000000000001";
export class FakeVersions {
  constructor(public rows = new Map<string, StoredLesson>()) {}
  async candidate(lesson_id: string, candidate_id: string): Promise<LessonVersionRow | null> {
    const lesson = this.rows.get(candidate_id);
    return lesson === undefined ? null : ({ version_id: candidate_id, lesson_id, kind: "candidate", lesson } as unknown as LessonVersionRow);
  }
}
export class FakeStandards {
  async index(): Promise<never> {
    throw new Error("unused");
  }
  async texts(codes: readonly string[]): Promise<StandardRow[]> {
    return codes
      .filter((c) => c === "L.6.4.b")
      .map((code) => ({ code, set: "CA_CCSS_ELA_6", text: "Synthetic official text for L.6.4.b", parent_code: null, is_leaf: true, eld_strand: null }) as StandardRow);
  }
}
