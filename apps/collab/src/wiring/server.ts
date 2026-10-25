// Server half of the collab composition (NL-80): auth, write guard, frozen set, persistence and acks, mounted as one
// Hocuspocus extension. The command-handler half is wiring/commands.ts (NL-105).
import * as Y from "yjs";
import type { Extension } from "@hocuspocus/server";
import { DomainRefusal } from "@ls/core/errors";
import type { LessonId } from "@ls/core/ports/common";
import type {
  LessonDocReader,
  LessonDocStore,
} from "@ls/core/ports/lesson-docs";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { SessionRepo } from "@ls/core/ports/sessions";
import { PgDatabase } from "@ls/db/pool";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import type { CollabDeps } from "../deps-types.ts";
import {
  AckBroadcaster,
  type ConnectionRegistry,
  type SocketHandle,
} from "../acks.ts";
import { CollabAuthenticator } from "../auth.ts";
import { FrozenDocs } from "../frozen-docs.ts";
import { WriteGuard, type SocketContext } from "../permissions.ts";
import { LessonPersistence, lesson_id_of } from "../persistence.ts";
import {
  SESSION_ENDED_CODE,
  SESSION_ENDED_REASON,
  SessionRecheck,
  type LiveHashes,
} from "../session-recheck.ts";

/** How often open sockets are re-checked against their session. */
const SESSION_RECHECK_MS = 1000;

export type HocuspocusServerRef = { readonly hocuspocus: unknown };

export interface ServerPorts {
  sessions: SessionRepo;
  states: LessonStateRepo;
  doc_store: LessonDocStore;
  doc_reader: LessonDocReader;
  /** Batched session liveness for the S-9 sweep; falls back to one `sessions.resolve` per hash. */
  live_hashes?: LiveHashes;
}
export interface CollabServerWiring {
  frozen: FrozenDocs;
  guard: WriteGuard;
  authenticator: CollabAuthenticator;
  persistence: LessonPersistence;
  acks: AckBroadcaster;
  extension: Extension;
  close(): Promise<void>;
}

// The members of Hocuspocus this wiring reads, so no `any` is needed.
interface LiveConnection {
  socketId: string;
  readOnly: boolean;
  context: { ctx?: SocketContext };
  sendStateless(payload: string): void;
  close(event?: { code: number; reason: string }): void;
}
interface LiveDocument extends Y.Doc {
  getConnections(): LiveConnection[];
}
interface HocuspocusLike {
  configuration: {
    extensions: unknown[];
    debounce: number;
    maxDebounce: number;
  };
  documents: Map<string, LiveDocument>;
}
function is_hocuspocus(x: unknown): x is HocuspocusLike {
  if (typeof x !== "object" || x === null) return false;
  const c = (x as { configuration?: { extensions?: unknown } }).configuration;
  return (
    typeof c === "object" &&
    c !== null &&
    Array.isArray(c.extensions) &&
    (x as { documents?: unknown }).documents instanceof Map
  );
}

function handle_of(c: LiveConnection): SocketHandle {
  return {
    socket_id: c.socketId,
    context: () => c.context.ctx as SocketContext,
    send_stateless: (json) => c.sendStateless(json),
    set_read_only: (v) => void (c.readOnly = v),
  };
}

class HocuspocusRegistry implements ConnectionRegistry {
  constructor(private readonly h: HocuspocusServerRef) {}
  private docs(): Map<string, LiveDocument> {
    return is_hocuspocus(this.h.hocuspocus)
      ? this.h.hocuspocus.documents
      : new Map();
  }
  sockets_of(lesson_id: LessonId): SocketHandle[] {
    return (
      this.docs()
        .get("lesson:" + lesson_id)
        ?.getConnections() ?? []
    )
      .filter((c) => c.context?.ctx !== undefined)
      .map(handle_of);
  }
  find(socket_id: string): SocketHandle | undefined {
    for (const d of this.docs().values()) {
      for (const c of d.getConnections())
        if (c.socketId === socket_id && c.context?.ctx !== undefined)
          return handle_of(c);
    }
    return undefined;
  }
}

function read_var_uint(a: Uint8Array, pos: number): [number, number] {
  let n = 0;
  let mul = 1;
  let p = pos;
  for (;;) {
    const b = a[p++];
    if (b === undefined) return [-1, p];
    n += (b & 127) * mul;
    mul *= 128;
    if (b < 128) return [n, p];
  }
}
/** Raw frame: varString(document name) varUint(type; Sync = 0) varUint(sub; 1 = step2, 2 = update) varUint8Array(payload). */
function classify(
  frame: Uint8Array,
): { sub: 1 | 2; payload: Uint8Array } | null {
  const [name_len, p0] = read_var_uint(frame, 0);
  if (name_len < 0) return null;
  const [type, p1] = read_var_uint(frame, p0 + name_len);
  if (type !== 0) return null;
  const [sub, p2] = read_var_uint(frame, p1);
  if (sub !== 1 && sub !== 2) return null;
  const [len, p3] = read_var_uint(frame, p2);
  if (len < 0) return null;
  return { sub, payload: frame.subarray(p3, p3 + len) };
}

function default_ports(d: CollabDeps): {
  ports: ServerPorts;
  close: () => Promise<void>;
} {
  // CollabDeps.db is a transaction runner (an unbuilt stand-in today), so the server half owns a lazy pool of its own.
  const db = new PgDatabase(
    d.settings.shared,
    d.settings.shared.pg_pool_max,
    2000,
    "collab",
  );
  const deps = { db, ids: d.ids, clock: d.clock };
  const session_repo = new PgSessionRepo(deps);
  const states = new PgLessonRepo(deps);
  const doc_store = new PgLessonDocStore({
    ...deps,
    checks: new PgCheckQueue(deps),
    states,
    audit: new PgAuditLog(deps),
  });
  return {
    ports: {
      sessions: session_repo,
      live_hashes: (hashes, now) => session_repo.live_hashes(hashes, now),
      states,
      doc_store,
      doc_reader: new PgLessonDocReader({ db }),
    },
    close: () => db.close(),
  };
}

export function wire_collab_server(
  d: CollabDeps,
  h: HocuspocusServerRef,
  given?: ServerPorts,
): CollabServerWiring {
  const own = given === undefined ? default_ports(d) : null;
  const ports = given ?? (own as { ports: ServerPorts }).ports;
  const frozen = new FrozenDocs();
  const guard = new WriteGuard(frozen);
  const acks = new AckBroadcaster(new HocuspocusRegistry(h));
  const authenticator = new CollabAuthenticator(
    ports.sessions,
    ports.states,
    guard,
    frozen,
    d.clock,
    d.settings,
  );
  const persistence = new LessonPersistence(
    ports.doc_store,
    ports.doc_reader,
    frozen,
    acks,
    d.logger,
    d.settings,
  );

  const extension: Extension = {
    priority: 1000,
    extensionName: "ls-collab-server",

    async onAuthenticate({
      documentName,
      requestHeaders,
      token,
      socketId,
      connectionConfig,
    }) {
      try {
        const ctx = await authenticator.authenticate({
          document_name: documentName,
          cookie_header: requestHeaders.get("cookie"),
          token_param: token ?? null,
          socket_id: socketId,
        });
        connectionConfig.readOnly = ctx.read_only;
        return { ctx };
      } catch (e) {
        if (e instanceof DomainRefusal)
          d.logger.warn("collab.auth_refused", { extra: { code: e.code } });
        throw e;
      }
    },

    async onLoadDocument({ document, documentName }) {
      const loaded = await persistence.load(documentName);
      Y.applyUpdate(document, loaded.ydoc_bytes);
    },

    async connected({ connection }) {
      const ctx = (connection.context as { ctx: SocketContext }).ctx;
      acks.mode_to(connection.socketId, {
        mode: ctx.read_only ? "read_only" : "editable",
        state: ctx.lesson_state,
      });
    },

    async beforeHandleMessage({ connection, document, update }) {
      const msg = classify(update);
      if (msg === null) return;
      const ctx = (connection.context as { ctx: SocketContext }).ctx;
      if (guard.on_update(ctx, frozen.is_frozen(ctx.lesson_id)).allowed) return;
      // Sync step 2 that carries nothing new is not an edit: nothing is being refused.
      if (
        msg.sub === 1 &&
        Y.snapshotContainsUpdate(Y.snapshot(document), msg.payload)
      )
        return;
      // SP-2 option A: never close the socket. A read-only connection makes Hocuspocus drop the update unapplied.
      connection.readOnly = true;
      ctx.read_only = true;
      const refused_from = Buffer.from(Y.encodeStateVector(document)).toString(
        "base64",
      );
      acks.refused(
        ctx.socket_id,
        "LESSON_LOCKED",
        "This lesson is locked; your last changes were not saved.",
        refused_from,
      );
      d.logger.warn("collab.write_refused", {
        lesson_id: ctx.lesson_id,
        extra: { code: "LESSON_LOCKED", role: ctx.user.role },
      });
    },

    async onStoreDocument({ document, documentName, lastContext }) {
      const editor =
        (lastContext as { ctx?: SocketContext } | undefined)?.ctx?.user
          .user_id ?? null;
      try {
        await persistence.store(
          documentName,
          Y.encodeStateAsUpdate(document),
          editor,
          null,
        );
      } catch (e) {
        d.logger.error("collab.store_failed", {
          lesson_id: lesson_id_of(documentName),
          extra: { error: e instanceof Error ? e.name : "unknown" },
        });
        throw e;
      }
    },

    async afterUnloadDocument({ documentName }) {
      const id = lesson_id_of(documentName);
      frozen.forget(id);
      persistence.forget(id);
    },
  };

  if (is_hocuspocus(h.hocuspocus)) {
    h.hocuspocus.configuration.extensions.push(extension);
    h.hocuspocus.configuration.debounce = d.settings.store_debounce_ms;
    h.hocuspocus.configuration.maxDebounce = d.settings.store_max_debounce_ms;
  }

  // S-9: a socket authenticated once is re-checked against its session, so sign-out or expiry closes it.
  let recheck_timer: ReturnType<typeof setInterval> | null = null;
  if (is_hocuspocus(h.hocuspocus)) {
    const live = h.hocuspocus;
    const live_hashes: LiveHashes =
      ports.live_hashes ??
      (async (hashes, now) => {
        const ok = new Set<string>();
        for (const x of hashes)
          if ((await ports.sessions.resolve(x, now)) !== null) ok.add(x);
        return ok;
      });
    const recheck = new SessionRecheck(live_hashes, d.clock, d.logger);
    recheck_timer = setInterval(() => {
      void recheck.tick(() =>
        [...live.documents.values()].flatMap((doc) =>
          doc.getConnections().map((c) => ({
            ctx: c.context?.ctx,
            close: () =>
              c.close({ code: SESSION_ENDED_CODE, reason: SESSION_ENDED_REASON }),
          })),
        ),
      );
    }, SESSION_RECHECK_MS);
    recheck_timer.unref();
  }

  return {
    frozen,
    guard,
    authenticator,
    persistence,
    acks,
    extension,
    close: async () => {
      if (recheck_timer !== null) clearInterval(recheck_timer);
      await own?.close();
    },
  };
}
