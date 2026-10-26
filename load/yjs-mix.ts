// NL-119 (WF-30, R-56 as amended): simulated Hocuspocus editors against a real collaboration server.
// Measures remote-edit p95, stored p95, lost updates, socket error rate and reconnect p95, then writes one probe_run row
// (kind "yjs"). A collaboration defect found by a run is a finding, never patched here.
// Logs only counts and ids: never a cookie, token, lesson text or provider key.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpus, hostname } from "node:os";
import { read_secret_url } from "@ls/config/env";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { EvidenceRepo, ProbeRunRecord } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator, type IdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import * as Y from "yjs";
import type { MixResult, SpikeOptions } from "./types.ts";
import { count_duplicates, count_lost, error_rate, is_clean_sample, is_clean_stored, make_token, percentile } from "./yjs-stats.ts";
import {
  append_token,
  connect_client,
  create_reviewers,
  delete_sessions,
  seed_load_lessons,
  section_addresses,
  section_text,
  stored_text,
  type Reviewer,
  type SocketClient,
} from "./yjs-support.ts";

export interface YjsTuning {
  typing_share: number; // 0.25 of editors type at any moment (min 1 typer per lesson)
  interval_ms: number; // 2000: one update per 2 s
  editors_per_lesson: number; // 3 (at most 3)
  drop_share: number; // 0.05 of sockets forcibly dropped once during the plateau (min 1 when > 0)
  drain_ms: number; // wait for outstanding stored acks before the final check
  reconnect_timeout_ms: number; // a drop or outage longer than this is an error / incomplete
}
export const DEFAULT_TUNING: YjsTuning = {
  typing_share: 0.25,
  interval_ms: 2000,
  editors_per_lesson: 3,
  drop_share: 0.05,
  drain_ms: 15000,
  reconnect_timeout_ms: 30000,
};

export interface YjsMixDetail {
  result: MixResult;
  incomplete: boolean;
  sent: number;
  acknowledged: number;
  unacknowledged: number;
  duplicates: number;
  socket_errors: number;
  sockets_opened: number;
  duration_s: number;
  incomplete_reason: string | null;
  remote_samples_total: number;
}
export interface YjsDeps {
  db: PgDatabase;
  evidence: EvidenceRepo;
  ids: IdGenerator;
  clock: Clock;
  log: (line: string) => void;
  git_sha: string;
  machine: string;
}
export interface YjsOutcome {
  record: ProbeRunRecord;
  incomplete: boolean;
  exit_code: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => performance.now();

interface Sent {
  t0: number;
  clock: number;
  acked: boolean;
  up_at_send: boolean;
  epoch_at_send: number;
}
interface Unseen {
  t0: number;
  sender: Editor;
  sender_epoch: number;
  peer_epoch: number;
  clean_at_send: boolean;
}
interface Editor {
  index: number;
  id: string;
  lesson_id: string;
  peers: number; // editors on the same lesson, itself included
  typer: boolean;
  reviewer: Reviewer;
  client: SocketClient | null;
  state: "connecting" | "up" | "down";
  connect_at: number; // ms from run start
  connect_started: number;
  ever_synced: boolean;
  down_since: number | null;
  seq: number;
  timer: ReturnType<typeof setInterval> | null;
  sent: Map<string, Sent>;
  epoch: number; // bumped whenever this editor's socket goes down or is dropped on purpose
  unseen: Map<string, Unseen>; // remote tokens not yet seen here
  drop: { at: number; closed: boolean; resynced: boolean; done: boolean } | null;
}

export async function run_yjs_mix_detailed(opts: SpikeOptions, tuning: YjsTuning, deps: YjsDeps): Promise<YjsMixDetail> {
  const n = opts.socket_editors;
  const empty: YjsMixDetail = {
    result: { p95_ms: {}, error_rate: 0, lost_updates: 0, n: 0 },
    incomplete: false, sent: 0, acknowledged: 0, unacknowledged: 0, duplicates: 0, socket_errors: 0, sockets_opened: 0, duration_s: 0,
    incomplete_reason: null, remote_samples_total: 0,
  };
  if (n <= 0) return empty;

  const per = Math.max(1, Math.min(3, Math.floor(tuning.editors_per_lesson)));
  const lessons = Math.ceil(n / per);
  const run_tag = randomBytes(4).toString("hex");
  const support = { db: deps.db, ids: deps.ids, clock: deps.clock };
  const lesson_ids = await seed_load_lessons(support, lessons);
  const reviewers = await create_reviewers(support, run_tag, n);

  const remote_samples: number[] = [];
  const remote_drop_samples: number[] = [];
  const stored_samples: number[] = [];
  const stored_drop_samples: number[] = [];
  const reconnect_samples: number[] = [];
  let socket_errors = 0;
  let sockets_opened = 0;
  let incomplete = false;
  let incomplete_reason: string | null = null;
  const mark_incomplete = (reason: string) => {
    incomplete = true;
    incomplete_reason ??= reason;
  };
  let stop_typing = false;

  const editors: Editor[] = Array.from({ length: n }, (_, i) => {
    const lesson_index = Math.floor(i / per);
    const on_lesson = Math.min(per, n - lesson_index * per);
    const typers = Math.max(1, Math.ceil(tuning.typing_share * on_lesson));
    return {
      index: i, id: `${run_tag}-e${i}`, lesson_id: lesson_ids[lesson_index]!, peers: on_lesson, typer: i - lesson_index * per < typers,
      reviewer: reviewers[i]!, client: null, state: "connecting", connect_at: (i * opts.ramp_s * 1000) / n, connect_started: 0,
      ever_synced: false, down_since: null, seq: 0, timer: null, sent: new Map(), epoch: 0, unseen: new Map(), drop: null,
    };
  });
  const by_lesson = new Map<string, Editor[]>();
  for (const e of editors) by_lesson.set(e.lesson_id, [...(by_lesson.get(e.lesson_id) ?? []), e]);

  const type_once = (e: Editor) => {
    if (stop_typing || e.client === null) return;
    // wait until every editor of the lesson has synced once: a token typed before a peer joined is not a clean latency sample
    if ((by_lesson.get(e.lesson_id) ?? []).some((p) => !p.ever_synced)) return;
    const token = make_token(e.id, e.seq);
    if (!append_token(e.client.doc, token)) return;
    e.seq += 1;
    const t0 = now();
    const clock = Y.decodeStateVector(Y.encodeStateVector(e.client.doc)).get(e.client.doc.clientID) ?? 0;
    e.sent.set(token, { t0, clock, acked: false, up_at_send: e.state === "up", epoch_at_send: e.epoch });
    for (const peer of by_lesson.get(e.lesson_id) ?? []) {
      if (peer === e) continue;
      peer.unseen.set(token, { t0, sender: e, sender_epoch: e.epoch, peer_epoch: peer.epoch, clean_at_send: e.state === "up" && peer.state === "up" });
    }
  };

  const start = (e: Editor) => {
    e.connect_started = now();
    const client = connect_client(opts.collab_url, e.lesson_id, e.reviewer.cookie, {
      onSocketCreated: () => void (sockets_opened += 1),
      onSynced: () => {
        e.state = "up";
        e.down_since = null;
        if (!e.ever_synced) {
          e.ever_synced = true;
          if (e.typer && e.timer === null) e.timer = setInterval(() => type_once(e), tuning.interval_ms);
        }
        if (e.drop?.closed) e.drop.resynced = true;
      },
      onDown: () => {
        if (e.state !== "up") return;
        e.state = "down";
        e.epoch += 1;
        if (e.drop !== null && !e.drop.closed) e.drop.closed = true; // the planned drop, not an error
        else {
          socket_errors += 1;
          e.down_since = now();
        }
      },
      onStateless: (m) => {
        if (m["type"] === "refused") {
          socket_errors += 1;
        } else if (m["type"] === "stored" && typeof m["state_vector"] === "string") {
          const sv = Y.decodeStateVector(Buffer.from(m["state_vector"], "base64"));
          const upto = sv.get(client.doc.clientID) ?? 0;
          const t = now();
          for (const s of e.sent.values()) {
            if (!s.acked && s.clock <= upto) {
              s.acked = true;
              const clean = is_clean_stored({ up: s.up_at_send, epoch: s.epoch_at_send }, { up: e.state === "up", epoch: e.epoch });
              (clean ? stored_samples : stored_drop_samples).push(t - s.t0);
            }
          }
        }
      },
    });
    e.client = client;
    // remote-edit-visible: the first time a remote token shows up in this editor's copy
    const watch = () => {
      const address = section_addresses(client.doc)[0];
      if (address === undefined) return;
      client.doc.getXmlFragment("section:" + address).observeDeep(() => {
        if (e.unseen.size === 0) return;
        const text = client.doc.getXmlFragment("section:" + address).toString();
        const t1 = now();
        for (const [token, u] of e.unseen) {
          if (text.includes(token)) {
            // a sample taken across an outage measures the outage, not the latency: keep it apart, never drop it silently
            const clean = u.clean_at_send && is_clean_sample(
              { sender_up: true, peer_up: true, sender_epoch: u.sender_epoch, peer_epoch: u.peer_epoch },
              { sender_up: u.sender.state === "up", peer_up: e.state === "up", sender_epoch: u.sender.epoch, peer_epoch: e.epoch },
            );
            (clean ? remote_samples : remote_drop_samples).push(t1 - u.t0);
            e.unseen.delete(token);
          }
        }
      });
    };
    let watching = false;
    client.provider.on("synced", () => {
      if (!watching) {
        watching = true;
        watch();
      }
    });
  };

  const run_start = now();
  const timers = editors.map((e) => setTimeout(() => start(e), e.connect_at));
  const acknowledged_by_lesson = new Map<string, string[]>();
  let all_sent: string[] = [];
  const texts = new Map<string, string>();
  let reload_mismatch = false;
  try {
    // ramp, then wait until every editor has synced
    const connect_deadline = opts.ramp_s * 1000 + tuning.reconnect_timeout_ms;
    while (editors.some((e) => !e.ever_synced) && !incomplete) {
      if (now() - run_start > connect_deadline) {
        socket_errors += editors.filter((e) => !e.ever_synced).length;
        mark_incomplete("connect_timeout");
        break;
      }
      await sleep(50);
    }
    const plateau_start = now();
    const drop_count = tuning.drop_share > 0 ? Math.max(1, Math.ceil(tuning.drop_share * n)) : 0;
    let dropped = false;
    const plateau_end = plateau_start + opts.plateau_s * 1000;
    while (now() < plateau_end && !incomplete) {
      const t = now();
      if (!dropped && drop_count > 0 && t - plateau_start >= (opts.plateau_s * 1000) / 2) {
        dropped = true;
        for (const e of editors.slice(0, drop_count)) {
          const ws = e.client?.sockets.at(-1);
          if (e.state !== "up" || ws === undefined) continue;
          e.drop = { at: t, closed: false, resynced: false, done: false };
          e.epoch += 1; // a token typed between close() and the close event is excluded too
          ws.close(4000);
        }
      }
      for (const e of editors) {
        const d = e.drop;
        if (d !== null && !d.done) {
          if (d.resynced && e.client !== null && e.client.provider.awareness !== null && e.client.provider.awareness.getStates().size >= e.peers) {
            reconnect_samples.push((t - d.at) / 1000);
            d.done = true;
          } else if (t - d.at > tuning.reconnect_timeout_ms) {
            d.done = true;
            socket_errors += 1;
            if (e.state === "down") mark_incomplete("socket_down");
          }
        }
        if (e.down_since !== null && t - e.down_since > tuning.reconnect_timeout_ms) mark_incomplete("socket_down");
      }
      await sleep(50);
    }

    // finish: stop typing, wait for the stored acks, then disconnect
    stop_typing = true;
    for (const e of editors) if (e.timer !== null) clearInterval(e.timer);
    const outstanding = () => editors.reduce((a, e) => a + [...e.sent.values()].filter((s) => !s.acked).length, 0);
    const drain_end = now() + tuning.drain_ms;
    while (!incomplete && outstanding() > 0 && now() < drain_end) {
      // a late reconnect may still complete here
      for (const e of editors) {
        const d = e.drop;
        if (d !== null && !d.done && d.resynced && e.client!.provider.awareness!.getStates().size >= e.peers) {
          reconnect_samples.push((now() - d.at) / 1000);
          d.done = true;
        }
        if (e.down_since !== null && now() - e.down_since > tuning.reconnect_timeout_ms) mark_incomplete("socket_down");
      }
      await sleep(100);
    }
    if (outstanding() > 0) mark_incomplete("unacknowledged_after_drain");

    // lost updates: acknowledged tokens against the latest stored document, read over SQL
    for (const [lesson_id, group] of by_lesson) {
      const text = await stored_text(deps.db, lesson_id);
      texts.set(lesson_id, text);
      acknowledged_by_lesson.set(lesson_id, group.flatMap((e) => [...e.sent].filter(([, s]) => s.acked).map(([k]) => k)));
    }
    all_sent = editors.flatMap((e) => [...e.sent.keys()]);

    // reload check (logged, not counted): a fresh client sees the same tokens
    if (!incomplete) {
      for (const [lesson_id, group] of by_lesson) {
        const text = texts.get(lesson_id) ?? "";
        const acked = acknowledged_by_lesson.get(lesson_id) ?? [];
        const fresh = await reload_text(opts.collab_url, lesson_id, group[0]!.reviewer.cookie);
        if (fresh === null) continue;
        const db_lost = count_lost(acked, text).lost_updates;
        const fresh_lost = count_lost(acked, fresh).lost_updates;
        if (db_lost !== fresh_lost) reload_mismatch = true;
      }
    }
  } catch {
    mark_incomplete("error"); // never throw once editors exist: the caller still writes its row
  } finally {
    for (const t of timers) clearTimeout(t);
    for (const e of editors) {
      if (e.timer !== null) clearInterval(e.timer);
      try {
        e.client?.destroy();
      } catch {
        /* already gone */
      }
    }
    await delete_sessions(support, reviewers).catch(() => undefined);
  }

  let lost_updates = 0;
  for (const [lesson_id, acked] of acknowledged_by_lesson) lost_updates += count_lost(acked, texts.get(lesson_id) ?? "").lost_updates;
  const full_text = [...texts.values()].join("");
  const duplicates = count_duplicates(all_sent, full_text);
  const acknowledged = editors.reduce((a, e) => a + [...e.sent.values()].filter((s) => s.acked).length, 0);
  const unacknowledged = all_sent.length - acknowledged;
  const rate = error_rate(socket_errors, sockets_opened);
  const duration_s = (now() - run_start) / 1000;
  if (reload_mismatch) deps.log("wf=WF-30 reload_mismatch=true");
  return {
    result: {
      p95_ms: {
        remote_edit: percentile(remote_samples, 95),
        remote_edit_n: remote_samples.length,
        remote_edit_during_drop: percentile(remote_drop_samples, 95),
        remote_edit_during_drop_n: remote_drop_samples.length,
        stored: percentile(stored_samples, 95),
        stored_n: stored_samples.length,
        stored_p50: percentile(stored_samples, 50),
        stored_during_drop: percentile(stored_drop_samples, 95),
        stored_during_drop_n: stored_drop_samples.length,
        reconnect_p95_s: percentile(reconnect_samples, 95),
        duplicate_tokens: duplicates,
        unacknowledged,
        socket_errors,
        editors: n,
        lessons,
        incomplete,
        incomplete_reason,
      },
      error_rate: rate,
      lost_updates,
      n: all_sent.length,
    },
    incomplete, sent: all_sent.length, acknowledged, unacknowledged, duplicates, socket_errors, sockets_opened, duration_s,
    incomplete_reason, remote_samples_total: remote_samples.length + remote_drop_samples.length,
  };
}

async function reload_text(collab_url: string, lesson_id: string, cookie: string): Promise<string | null> {
  let ok!: () => void;
  const synced = new Promise<void>((r) => (ok = r));
  const c = connect_client(collab_url, lesson_id, cookie, { onSynced: () => ok() });
  try {
    const got = await Promise.race([synced.then(() => true), sleep(10000).then(() => false)]);
    return got ? section_text(c.doc) : null;
  } finally {
    c.destroy();
  }
}

export async function run_yjs_probe(opts: SpikeOptions, deps: YjsDeps, tuning: Partial<YjsTuning> = {}): Promise<YjsOutcome> {
  const detail = await run_yjs_mix_detailed(opts, { ...DEFAULT_TUNING, ...tuning }, deps);
  // event_loop_lag_p95_ms and max_db_connections belong to the HTTP half; 0 here (see the NL-119 devlog).
  const record: ProbeRunRecord = {
    probe_run_id: deps.ids.new_id("pr"),
    kind: "yjs",
    users: opts.users,
    duration_s: Math.round(detail.duration_s),
    machine: deps.machine,
    provider_mode: "stub",
    p95_ms: {
      ...(detail.result.p95_ms as Record<string, never>),
      evidence: { git_sha: deps.git_sha, prompt_version: null, models: [], provider_mode: "stub" },
    },
    error_rate: detail.result.error_rate,
    lost_updates: detail.result.lost_updates,
    event_loop_lag_p95_ms: 0,
    max_db_connections: 0,
    n: detail.result.n,
  };
  const id = await deps.evidence.insert_probe_run(record);
  deps.log(
    `wf=WF-30 probe_run_id=${id} kind=yjs users=${opts.users} lost_updates=${record.lost_updates} incomplete=${detail.incomplete}`,
  );
  return { record, incomplete: detail.incomplete, exit_code: detail.incomplete || record.lost_updates > 0 ? 1 : 0 };
}

export async function build_yjs_deps(env: NodeJS.ProcessEnv = process.env): Promise<{ deps: YjsDeps; close(): Promise<void> }> {
  const settings = {
    database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
    pg_pool_max: 4,
    build_id: env["BUILD_ID"] ?? "load",
    log_level: "info" as const,
  };
  const db = new PgDatabase(settings, 4, 5000);
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();
  let git_sha = env["GIT_SHA"] ?? "";
  if (git_sha === "") {
    try {
      git_sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      git_sha = "unknown";
    }
  }
  const deps: YjsDeps = {
    db, evidence: new PgEvidenceRepo({ db, ids, clock }), ids, clock,
    log: (line) => void process.stdout.write(`${line}\n`),
    git_sha: git_sha || "unknown",
    machine: `${hostname()} ${cpus().length}cpu`,
  };
  return { deps, close: () => db.close() };
}

export async function run_yjs_mix(opts: SpikeOptions, tuning: Partial<YjsTuning> = {}, deps?: YjsDeps): Promise<MixResult> {
  if (deps !== undefined) return (await run_yjs_mix_detailed(opts, { ...DEFAULT_TUNING, ...tuning }, deps)).result;
  const built = await build_yjs_deps(process.env);
  try {
    return (await run_yjs_mix_detailed(opts, { ...DEFAULT_TUNING, ...tuning }, built.deps)).result;
  } finally {
    await built.close();
  }
}
