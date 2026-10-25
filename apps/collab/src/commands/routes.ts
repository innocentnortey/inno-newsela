// The collaboration server's private HTTP command surface: /internal/lessons/{id}/{lock-and-snapshot|apply-edit|set-mode}.
// Every request passes the bearer-token guard first. With no handler installed the NL-07 shell behaviour holds (503).
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { EditCommand, ModeCommand, SubmitCommand } from "@ls/core/ports/collab-commands";
import type { SecretStr } from "@ls/config/secret";
import { LessonState } from "@ls/schema/api/board";
import { Anchor, RightsStatus, SourceRef } from "@ls/schema/api/lessons";
import { LessonId } from "@ls/schema/ids";
import { Standard } from "@ls/schema/lesson";
import type { Logger } from "@ls/obs/logger";
import { apply_edit } from "./apply-edit.ts";
import { envelope, from_unknown } from "./errors.ts";
import { lock_and_snapshot } from "./lock-and-snapshot.ts";
import { set_mode } from "./set-mode.ts";
import type { CollabCommandHandlerDeps } from "./types.ts";

export type { CollabCommandHandlerDeps } from "./types.ts";
export const NOT_BUILT_EVENT = "internal.not_built";
const MAX_BODY = 1024 * 1024;

export function is_internal_path(url: string | undefined): boolean {
  const path = (url ?? "").split("?")[0] ?? "";
  return path === "/internal" || path.startsWith("/internal/");
}

export class CollabCommandHandler {
  constructor(readonly deps: CollabCommandHandlerDeps) {}
  apply_edit(cmd: EditCommand) {
    return apply_edit(this.deps, cmd);
  }
  set_mode(cmd: ModeCommand) {
    return set_mode(this.deps, cmd);
  }
  lock_and_snapshot(cmd: SubmitCommand) {
    return lock_and_snapshot(this.deps, cmd);
  }
}

let installed: CollabCommandHandler | null = null;
/** Process-global: main.ts is not ours, so wire_collab_commands installs the handler here. Tests reset it with null. */
export function install_command_handler(h: CollabCommandHandler | null): void {
  installed = h;
}

// ---- request schemas -------------------------------------------------------------------------------------

const Actor = z.object({ user_id: z.string().nullable(), name: z.string(), role: z.enum(["author", "reviewer", "approver"]).nullable(), synthetic: z.boolean() }).strict();
const RequestIdField = z.string().min(1);
const Edit = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("standard"), code: z.string().min(1), decision: z.enum(["confirm", "remove", "add", "undo"]), restore: Standard.nullable() }).strict(),
  z.object({ kind: z.literal("slot_fill"), slot_id: z.string().min(1), text: z.string().min(1), source_ref: SourceRef, rights_status: RightsStatus }).strict(),
  z.object({ kind: z.literal("adopt"), candidate_version_id: z.string().min(1), scope: z.enum(["whole", "section"]), section_address: z.string().nullable() }).strict(),
  z.object({ kind: z.literal("suggestion_accept"), suggestion_id: z.string().min(1), anchor: Anchor, expected_text: z.string().min(1), replacement_text: z.string() }).strict(),
]);
const TAG_OF = { standard: "standard-decision", slot_fill: "slot-fill", adopt: "candidate-adopt", suggestion_accept: "ai-assist" } as const;
const EditCommandSchema = z
  .object({
    lesson_id: LessonId,
    actor: Actor,
    request_id: RequestIdField,
    tag: z.enum(["standard-decision", "slot-fill", "candidate-adopt", "ai-assist"]),
    edit: Edit,
  })
  .strict()
  .superRefine((c, ctx) => {
    if (TAG_OF[c.edit.kind] !== c.tag) ctx.addIssue({ code: "custom", path: ["tag"], message: "tag does not match edit.kind" });
    if (c.actor.user_id === null) ctx.addIssue({ code: "custom", path: ["actor", "user_id"], message: "a named person is required" });
    if (c.edit.kind === "adopt" && c.edit.scope === "section" && c.edit.section_address === null) {
      ctx.addIssue({ code: "custom", path: ["edit", "section_address"], message: "section scope needs an address" });
    }
    if (c.edit.kind === "standard" && c.edit.restore !== null && c.edit.decision !== "undo") {
      ctx.addIssue({ code: "custom", path: ["edit", "restore"], message: "restore is for undo only" });
    }
  });
const ModeCommandSchema = z.object({ lesson_id: LessonId, mode: z.enum(["editable", "read_only"]), state: LessonState, request_id: RequestIdField }).strict();
const SubmitCommandSchema = z.object({ lesson_id: LessonId, actor: Actor, client_state_vector: z.string(), request_id: RequestIdField }).strict();

// ---- guard and plumbing ----------------------------------------------------------------------------------

const digest = (s: string): Buffer => createHash("sha256").update(s).digest();

/** Compares SHA-256 digests (always 32 bytes) so neither length nor content of the token leaks through timing. */
function authorized(req: IncomingMessage, token: SecretStr): boolean {
  const header = req.headers.authorization;
  const m = typeof header === "string" ? /^Bearer (.+)$/.exec(header) : null;
  const same = timingSafeEqual(digest(m?.[1] ?? ""), digest(token.reveal()));
  return same && m !== null;
}

function send(res: ServerResponse, e: { status: number; body: unknown }): void {
  res.writeHead(e.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(e.body));
}

/** Reads at most MAX_BODY bytes; the rest is drained and discarded so the client still gets its 400. */
async function read_body(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size <= MAX_BODY) chunks.push(c as Buffer);
  }
  return size > MAX_BODY ? null : Buffer.concat(chunks).toString("utf8");
}

const PATH = /^\/internal\/lessons\/([^/]+)\/(lock-and-snapshot|apply-edit|set-mode)$/;
type Command = "lock-and-snapshot" | "apply-edit" | "set-mode";

export async function handle_internal(req: IncomingMessage, res: ServerResponse, logger: Logger): Promise<void> {
  const handler = installed;
  if (handler === null) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: { code: "COLLAB_UNAVAILABLE", message: "The collaboration commands are not available yet", details: {} },
      }),
    );
    logger.warn(NOT_BUILT_EVENT, { extra: { method: req.method ?? "", path_prefix: "/internal" } });
    return;
  }
  if (!authorized(req, handler.deps.token)) {
    logger.warn("internal.unauthorized", { extra: { path_prefix: "/internal" } });
    send(res, envelope("UNAUTHENTICATED", "Not authorized", {}, null));
    return;
  }
  const header_id = req.headers["x-request-id"];
  let request_id: string | null = typeof header_id === "string" && /^[\w-]{1,64}$/.test(header_id) ? header_id : null;
  let lesson_id: string | null = null;
  let command: Command | "unknown" = "unknown";
  try {
    if (req.method !== "POST") throw new z.ZodError([{ code: "custom", path: ["method"], message: "POST only", input: undefined }]);
    const path = (req.url ?? "").split("?")[0] ?? "";
    const m = PATH.exec(path);
    let id: string | null = null;
    try {
      id = m === null ? null : decodeURIComponent(m[1] as string);
    } catch {
      id = null;
    }
    if (m === null || id === null) {
      send(res, envelope("NOT_FOUND", "No such route", {}, request_id));
      return;
    }
    command = m[2] as Command;
    lesson_id = id;
    const raw = await read_body(req);
    if (raw === null) throw new z.ZodError([{ code: "custom", path: ["body"], message: "body too large", input: undefined }]);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new z.ZodError([{ code: "custom", path: ["body"], message: "not JSON", input: undefined }]);
    }
    const schema = command === "apply-edit" ? EditCommandSchema : command === "set-mode" ? ModeCommandSchema : SubmitCommandSchema;
    const cmd = schema.parse(json);
    request_id = cmd.request_id; // the body's value is authoritative
    if (cmd.lesson_id !== id) throw new z.ZodError([{ code: "custom", path: ["lesson_id"], message: "differs from the path", input: undefined }]);
    const result =
      command === "apply-edit"
        ? await handler.apply_edit(cmd as EditCommand)
        : command === "set-mode"
          ? await handler.set_mode(cmd as ModeCommand)
          : await handler.lock_and_snapshot(cmd as SubmitCommand);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    logger.info("collab.command", { request_id, lesson_id, extra: { command, outcome: "ok" } });
  } catch (e) {
    const out = from_unknown(e, request_id);
    if (!(e instanceof z.ZodError) && !(e instanceof Error && e.name === "DomainRefusal")) {
      logger.error("collab.command_failed", { request_id, lesson_id, extra: { command, error: e instanceof Error ? e.name : "unknown" } });
    }
    send(res, out);
    logger.info("collab.command", { request_id, lesson_id, extra: { command, outcome: out.code } });
  }
}
