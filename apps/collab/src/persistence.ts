// LessonPersistence: load the latest lesson_doc, store a debounced snapshot in one transaction, then ack.
import type { CollabSettings } from "@ls/config/settings";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type {
  LessonId,
  RequestId,
  StateVector,
  UserId,
  YDocBytes,
} from "@ls/core/ports/common";
import type {
  LessonDocReader,
  LessonDocStore,
} from "@ls/core/ports/lesson-docs";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { Logger } from "@ls/obs/logger";
import { ydoc_to_lesson } from "@ls/ydoc/convert";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import type { AckBroadcaster } from "./acks.ts";
import type { FrozenDocs } from "./frozen-docs.ts";

export interface LoadedDoc {
  lesson_id: LessonId;
  ydoc_bytes: YDocBytes;
  seq: number;
  schema_version: number;
}

export function lesson_id_of(document_name: string): LessonId {
  const m = /^lesson:(.+)$/.exec(document_name);
  if (m === null) throw new Error("not a lesson document");
  return m[1] as string;
}

export class LessonPersistence {
  readonly #first_change = new Map<LessonId, number>();
  readonly #last = new Map<LessonId, { sv: StateVector; hash: string }>();

  constructor(
    private readonly store_port: LessonDocStore,
    private readonly reader: LessonDocReader,
    _frozen: FrozenDocs,
    private readonly acks: AckBroadcaster,
    private readonly logger: Logger,
    _settings: CollabSettings,
  ) {}

  async load(document_name: string): Promise<LoadedDoc> {
    const lesson_id = lesson_id_of(document_name);
    const row = await this.reader.latest(lesson_id);
    if (row === null) throw new Error("no lesson_doc for lesson " + lesson_id);
    if (row.schema_version !== SCHEMA_VERSION) {
      throw new Error(
        "unknown schema_version " +
          String(row.schema_version) +
          " for lesson " +
          lesson_id,
      );
    }
    this.#last.set(lesson_id, { sv: row.state_vector, hash: row.content_hash });
    return {
      lesson_id,
      ydoc_bytes: row.ydoc_bytes,
      seq: row.seq,
      schema_version: row.schema_version,
    };
  }

  /** Returns null when nothing changed since the last store or load. A failure propagates; no ack is sent for it. */
  async store(
    document_name: string,
    ydoc_bytes: YDocBytes,
    last_editor: UserId | null,
    request_id: RequestId | null,
  ): Promise<StoreAck | null> {
    const lesson_id = lesson_id_of(document_name);
    const sv = state_vector_of(ydoc_bytes);
    const started = performance.now();
    const first_change = this.#first_change.get(lesson_id);
    this.#first_change.delete(lesson_id);
    const store_wait_ms = first_change === undefined ? null : Math.max(0, Math.round(started - first_change));
    const derived = ydoc_to_lesson(ydoc_bytes, SCHEMA_VERSION);
    const hash = content_hash(derived);
    const last = this.#last.get(lesson_id);
    if (last !== undefined && last.sv === sv && last.hash === hash) return null;
    const db_started = performance.now();
    const ack = await this.store_port.store({
      lesson_id,
      ydoc_bytes,
      derived,
      content_hash: hash,
      state_vector: sv,
      stored_by: last_editor,
      request_id,
      tag: null,
    });
    const db_write_ms = Math.round(performance.now() - db_started);
    this.#last.set(lesson_id, { sv, hash });
    this.acks.stored(lesson_id, ack);
    this.logger.info("collab.stored", {
      lesson_id,
      store_id: ack.store_id,
      duration_ms: Math.round(performance.now() - started),
      extra: { seq: ack.seq, store_wait_ms, db_write_ms },
    });
    return ack;
  }

  /** Marks the first unsaved change of a lesson (kept until the next store) so the debounce wait can be logged. */
  note_change(lesson_id: LessonId, at_ms: number = performance.now()): void {
    if (!this.#first_change.has(lesson_id)) this.#first_change.set(lesson_id, at_ms);
  }

  forget(lesson_id: LessonId): void {
    this.#last.delete(lesson_id);
    this.#first_change.delete(lesson_id);
  }
}
