// One external system (Hocuspocus) behind one class. No React, no DOM. The only document state is the Y.Doc.
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { covers, derive_client_state, type EditorClientState, type StoredAck } from "./client-state";
import { b64_to_bytes, bytes_to_b64, parse_collab_message, type RefusedMessage } from "./messages";
import { apply_refusal } from "./refusals";

export interface PresenceUser { user_id: string; name: string; initials: string; slot: 1 | 2 | 3 | 4 }

export interface CollabSessionOptions {
  url: string;
  lesson_id: string;
  user: PresenceUser;
  read_only: boolean;
}

export interface SessionSnapshot {
  state: EditorClientState;
  state_vector: string | null;
  stored: StoredAck | null;
  read_only: boolean;
  refusal: { message: string; text: string[]; dropped: number } | null;
  signed_out: boolean;
  mode_state: string | null;
}

// A placeholder: the server reads only the HttpOnly ls_session cookie, but Hocuspocus needs a non-empty token to authenticate.
const TOKEN = "session-cookie";
const SIGNED_OUT_CODES = new Set([4401, 4403]);

interface Link {
  ws: HocuspocusProviderWebsocket;
  provider: HocuspocusProvider;
}

export class CollabSession {
  private readonly opts: CollabSessionOptions;
  private _doc = new Y.Doc();
  private _awareness: Awareness | null = null;
  private link: Link | null = null;
  private generation = 0;
  private listeners = new Set<() => void>();
  private cached: SessionSnapshot | null = null;
  private destroyed = false;

  private ever_connected = false;
  private ever_synced = false;
  private connected = false;
  private dirty = false;
  private stored_since_edit = false;
  private pending_sv: Uint8Array | null = null;
  private last_stored: StoredAck | null = null;
  private prop_read_only: boolean;
  private mode_read_only = false;
  private scope_read_only = false;
  private refused = false;
  private refusal: SessionSnapshot["refusal"] = null;
  private signed_out = false;
  private mode_state: string | null = null;
  private detach_doc: (() => void) | null = null;

  constructor(opts: CollabSessionOptions) {
    this.opts = opts;
    this.prop_read_only = opts.read_only;
    this.connect();
  }

  get doc(): Y.Doc {
    return this._doc;
  }

  get awareness(): Awareness {
    return this._awareness!;
  }

  private connect(): void {
    const gen = ++this.generation;
    const doc = this._doc;
    const live = () => gen === this.generation && !this.destroyed;
    const ws = new HocuspocusProviderWebsocket({
      url: this.opts.url,
      delay: 1000,
      factor: 2,
      minDelay: 500,
      maxDelay: 8000,
      jitter: true,
      maxAttempts: 0,
    });
    const provider = new HocuspocusProvider({
      websocketProvider: ws,
      name: `lesson:${this.opts.lesson_id}`,
      document: doc,
      token: TOKEN,
      onStatus: ({ status }) => {
        if (!live()) return;
        this.connected = status === "connected";
        if (this.connected) this.ever_connected = true;
        this.emit();
      },
      onSynced: () => {
        if (!live()) return;
        this.ever_synced = true;
        this.emit();
      },
      onAuthenticated: ({ scope }) => {
        if (!live()) return;
        this.scope_read_only = scope === "readonly";
        this.emit();
      },
      onAuthenticationFailed: () => {
        if (live()) this.sign_out();
      },
      onClose: ({ event }) => {
        if (!live()) return;
        if (SIGNED_OUT_CODES.has((event as { code?: number }).code ?? 0)) {
          this.sign_out();
          return;
        }
        // The server can end the document connection while the socket stays up (CLOSE message): the
        // provider would wait for its ping timeout, so drop the socket and reconnect ourselves.
        if (this.connected && !this.refused) {
          this.connected = false;
          ws.disconnect();
          setTimeout(() => {
            if (live()) void ws.connect();
          }, 1000);
        }
        this.emit();
      },
      onStateless: ({ payload }) => {
        if (live()) this.on_stateless(payload);
      },
    });
    provider.attach();
    this.link = { ws, provider };
    this._awareness = provider.awareness;
    provider.awareness?.setLocalStateField("user", {
      name: this.opts.user.name,
      initials: this.opts.user.initials,
      slot: this.opts.user.slot,
    });

    const on_update = (_u: Uint8Array, origin: unknown) => {
      if (origin !== provider && !this.refused) {
        this.dirty = true;
        this.stored_since_edit = false;
        this.pending_sv = Y.encodeStateVector(doc);
      }
      this.emit();
    };
    doc.on("update", on_update);
    this.detach_doc = () => doc.off("update", on_update);
  }

  private teardown_link(): void {
    this.detach_doc?.();
    this.detach_doc = null;
    const l = this.link;
    this.link = null;
    if (l) {
      l.provider.destroy();
      l.ws.destroy();
    }
  }

  private sign_out(): void {
    if (this.signed_out) return;
    this.signed_out = true;
    this.generation++; // ignore any late callbacks; stop retrying
    this.teardown_link();
    this.emit();
  }

  private on_stateless(payload: string): void {
    const msg = parse_collab_message(payload);
    if (msg === null) return;
    if (msg.type === "stored") {
      this.last_stored = { content_hash: msg.content_hash, state_vector: msg.state_vector, stored_at: msg.stored_at };
      try {
        if (this.dirty && this.pending_sv !== null && covers(b64_to_bytes(msg.state_vector), this.pending_sv)) {
          this.dirty = false;
          this.stored_since_edit = true;
        }
      } catch {
        // malformed ack: stay dirty
      }
    } else if (msg.type === "mode") {
      this.mode_state = msg.state;
      this.mode_read_only = msg.mode === "read_only";
    } else if (!this.refused) {
      this.handle_refused(msg);
    }
    this.emit();
  }

  private handle_refused(msg: RefusedMessage): void {
    const outcome = apply_refusal(
      {
        doc: this._doc,
        discard_local_state: () => this.discard_local_state(),
        set_read_only: () => {
          this.refused = true;
        },
      },
      msg,
    );
    this.refusal = {
      message: "Your last edits were not saved.",
      text: outcome.refused_text,
      dropped: outcome.dropped_updates,
    };
  }

  /** The refused operations live only in the destroyed doc; the fresh one only receives server state. */
  private discard_local_state(): void {
    this.refused = true; // latch before the fresh link starts talking
    const old = this._doc;
    this.generation++;
    this.teardown_link();
    old.destroy();
    this._doc = new Y.Doc();
    this.dirty = false;
    this.pending_sv = null;
    this.stored_since_edit = false;
    this.connect();
  }

  private compute(): SessionSnapshot {
    const read_only = this.prop_read_only || this.mode_read_only || this.scope_read_only || this.refused;
    let state = derive_client_state({
      ever_connected: this.ever_connected,
      connected: this.connected,
      synced: this.link?.provider.isSynced ?? false,
      read_only,
      dirty: this.dirty,
    });
    if (state === "synced" && this.stored_since_edit) state = "stored";
    return {
      state,
      state_vector: this.ever_synced ? bytes_to_b64(Y.encodeStateVector(this._doc)) : null,
      stored: this.last_stored,
      read_only,
      refusal: this.refusal,
      signed_out: this.signed_out,
      mode_state: this.mode_state,
    };
  }

  /** Same reference while nothing changed (useSyncExternalStore). */
  snapshot(): SessionSnapshot {
    const next = this.compute();
    const prev = this.cached;
    if (
      prev &&
      prev.state === next.state &&
      prev.state_vector === next.state_vector &&
      prev.stored === next.stored &&
      prev.read_only === next.read_only &&
      prev.refusal === next.refusal &&
      prev.signed_out === next.signed_out &&
      prev.mode_state === next.mode_state
    ) {
      return prev;
    }
    this.cached = next;
    return next;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set_read_only(v: boolean): void {
    this.prop_read_only = v;
    this.emit();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.teardown_link();
    this._doc.destroy();
    this.listeners.clear();
  }

  private emit(): void {
    if (this.destroyed) return;
    for (const l of [...this.listeners]) l();
  }
}
