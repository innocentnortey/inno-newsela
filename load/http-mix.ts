// NL-118: the 200-user HTTP mix (capacity doc, Workload assumptions). A pure seeded schedule plus an open-loop runner.
import { error_rate, percentile, type Sample } from "./stats.ts";
import type { SpikeOptions } from "./types.ts";

export type VuRole = "reviewer" | "poller" | "actor";
export type EventKind = "open" | "heartbeat" | "poll" | "act" | "page";
export interface ScheduleEvent {
  t_ms: number;
  vu: string;
  role: VuRole;
  kind: EventKind;
  n: number;
}
export interface MixShape {
  users: number;
  ramp_s: number;
  plateau_s: number;
  ramp_down_s: number;
}
export const SHARES = { reviewer: 0.7, poller: 0.2 } as const;
export const PERIOD_S = { heartbeat: 15, poll: 2, act: 10, page: 30 } as const;
const DEFAULT_SEED = 118;

export function vu_id(i: number): string {
  return `vu-${String(i + 1).padStart(3, "0")}`;
}

export function split_roles(users: number): { reviewers: number; pollers: number; actors: number } {
  const reviewers = Math.round(SHARES.reviewer * users);
  const pollers = Math.round(SHARES.poller * users);
  return { reviewers, pollers, actors: users - reviewers - pollers };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roles interleaved by largest deficit, so every ramp prefix already has the 70/20/10 mix. */
export function roles_in_order(users: number): VuRole[] {
  const { reviewers, pollers, actors } = split_roles(users);
  const target: [VuRole, number][] = [["reviewer", reviewers], ["poller", pollers], ["actor", actors]];
  const given: Record<VuRole, number> = { reviewer: 0, poller: 0, actor: 0 };
  const out: VuRole[] = [];
  for (let i = 0; i < users; i++) {
    let best: VuRole = "reviewer";
    let best_gap = -Infinity;
    for (const [role, count] of target) {
      if (given[role] >= count) continue;
      const gap = (count / users) * (i + 1) - given[role];
      if (gap > best_gap) {
        best_gap = gap;
        best = role;
      }
    }
    given[best] += 1;
    out.push(best);
  }
  return out;
}

export function build_schedule(shape: MixShape, seed: number = DEFAULT_SEED): ScheduleEvent[] {
  const rnd = mulberry32(seed);
  const roles = roles_in_order(shape.users);
  const events: ScheduleEvent[] = [];
  for (let i = 0; i < shape.users; i++) {
    const vu = vu_id(i);
    const role = roles[i]!;
    const start = (shape.ramp_s * 1000 * i) / shape.users;
    const stop = (shape.ramp_s + shape.plateau_s + shape.ramp_down_s * (i / shape.users)) * 1000;
    let n = 0;
    if (role === "reviewer") events.push({ t_ms: start, vu, role, kind: "open", n: n++ });
    const kinds: [EventKind, number][] = [["page", PERIOD_S.page]];
    if (role === "reviewer") kinds.push(["heartbeat", PERIOD_S.heartbeat]);
    if (role === "poller") kinds.push(["poll", PERIOD_S.poll]);
    if (role === "actor") kinds.push(["act", PERIOD_S.act]);
    for (const [kind, period] of kinds) {
      let t = start + rnd() * period * 1000;
      while (t < stop) {
        events.push({ t_ms: Math.round(t), vu, role, kind, n: n++ });
        t += period * 1000 * (1 + (rnd() * 0.1 - 0.05));
      }
    }
  }
  return events.sort((a, b) => a.t_ms - b.t_ms || (a.vu < b.vu ? -1 : a.vu > b.vu ? 1 : 0));
}

export function rate_in_window(events: ScheduleEvent[], kind: EventKind, from_s: number, to_s: number): number {
  const n = events.filter((e) => e.kind === kind && e.t_ms >= from_s * 1000 && e.t_ms < to_s * 1000).length;
  return n / (to_s - from_s);
}

// ---- runner ----------------------------------------------------------------------------------------------------

export type RequestClass = "lesson_open" | "heartbeat" | "board" | "progress" | "poll" | "act_read" | "act_write" | "page";
export type Account = "author" | "reviewer" | "approver";

export interface Discovery {
  unit_id: string;
  unit_key: string;
  lesson_ids: string[];
  run_id: string | null;
  version_id: string;
}
export interface RequestLogLine {
  t_ms: number;
  vu: string;
  class: RequestClass;
  method: string;
  path: string;
  status: number;
  ms: number;
}
export interface MixDeps {
  base_url: string;
  cookies: Record<Account, string>;
  discovery: Discovery;
  run_id: string;
  ramp_down_s: number;
  fetch?: typeof fetch;
  log?: (line: RequestLogLine) => void;
  now?: () => number;
  seed?: number;
  timeout_ms?: number;
}
export interface HttpMixResult {
  p95_ms: Record<string, number | null>;
  error_rate: number;
  lost_updates: number;
  n: number;
  samples: Record<string, Sample[]>;
  failed: number;
  busy_count: number;
  client_errors: number;
  elapsed_ms: number;
  notes: string[];
}

const CLASSES: RequestClass[] = ["lesson_open", "heartbeat", "board", "progress", "poll", "act_read", "act_write", "page"];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface Planned {
  cls: RequestClass[];
  method: "GET" | "POST";
  path: string;
  account: Account;
  body?: unknown;
}

export function plan_request(e: ScheduleEvent, index: number, users: number, d: Discovery, now: () => number): Planned | null {
  const lesson = d.lesson_ids[index % d.lesson_ids.length]!;
  const l = encodeURIComponent(lesson);
  const board = `/api/units/${encodeURIComponent(d.unit_id)}/board`;
  if (e.role === "actor") {
    const approver = index >= Math.floor(users / 2);
    const account: Account = approver ? "approver" : "author";
    if (e.kind === "page") return { cls: ["page"], method: "GET", path: `/units/${d.unit_key}/board`, account };
    if (e.kind !== "act") return null;
    if (approver && e.n % 4 === 3) {
      const sent = now();
      return {
        cls: ["act_write"], method: "POST", path: `/api/lessons/${l}/heartbeats`, account,
        body: { tab_id: e.vu, focused: true, visible: true, last_input_at: new Date(sent - 5000).toISOString(), sent_at: new Date(sent).toISOString(), version_id: d.version_id },
      };
    }
    const reads = ["/api/units", "/api/prompt-versions", board];
    return { cls: ["act_read"], method: "GET", path: reads[e.n % reads.length]!, account };
  }
  if (e.role === "poller") {
    if (e.kind === "page") return { cls: ["page"], method: "GET", path: `/units/${d.unit_key}/board`, account: "reviewer" };
    if (e.kind !== "poll") return null;
    if (index % 2 === 1 && d.run_id !== null) {
      return { cls: ["progress", "poll"], method: "GET", path: `/api/runs/${encodeURIComponent(d.run_id)}/progress`, account: "reviewer" };
    }
    return { cls: ["board", "poll"], method: "GET", path: board, account: "reviewer" };
  }
  if (e.kind === "open" || e.kind === "page") return { cls: ["lesson_open"], method: "GET", path: `/api/lessons/${l}`, account: "reviewer" };
  if (e.kind === "heartbeat") {
    const sent = now();
    return {
      cls: ["heartbeat"], method: "POST", path: `/api/lessons/${l}/heartbeats`, account: "reviewer",
      body: { tab_id: e.vu, focused: true, visible: true, last_input_at: new Date(sent - 5000).toISOString(), sent_at: new Date(sent).toISOString(), version_id: d.version_id },
    };
  }
  return null;
}

export async function run_http_mix(opts: SpikeOptions, deps: MixDeps): Promise<HttpMixResult> {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const origin = new URL(deps.base_url).origin;
  const schedule = build_schedule(
    { users: opts.users, ramp_s: opts.ramp_s, plateau_s: opts.plateau_s, ramp_down_s: deps.ramp_down_s },
    deps.seed,
  );
  const samples: Record<string, Sample[]> = Object.fromEntries(CLASSES.map((c) => [c, [] as Sample[]]));
  let failed = 0;
  let busy = 0;
  let client_errors = 0;
  let completed = 0;
  const pending = new Set<Promise<void>>();
  const t0 = now();
  let last_done = t0;

  const send = async (e: ScheduleEvent, p: Planned): Promise<void> => {
    const started = now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeout_ms ?? 30_000);
    let status: number;
    try {
      const headers: Record<string, string> = {
        cookie: deps.cookies[p.account], "x-probe-run-id": deps.run_id, "x-probe-vu": e.vu, origin,
      };
      if (p.body !== undefined) headers["content-type"] = "application/json";
      const res = await f(`${deps.base_url}${p.path}`, {
        method: p.method, headers, body: p.body === undefined ? undefined : JSON.stringify(p.body), signal: ctl.signal,
      });
      status = res.status;
      const text = await res.text();
      if (status === 503 && text.includes("SERVICE_BUSY")) busy += 1;
    } catch {
      status = 0;
    } finally {
      clearTimeout(timer);
    }
    const ms = now() - started;
    const ok = status >= 200 && status < 400;
    last_done = now();
    completed += 1;
    if (status === 0 || status >= 500) failed += 1;
    else if (status >= 400) client_errors += 1;
    const point: Sample = { t_ms: started - t0, ms, ok };
    for (const c of p.cls) samples[c]!.push(point);
    deps.log?.({ t_ms: started - t0, vu: e.vu, class: p.cls[0]!, method: p.method, path: p.path, status, ms });
  };

  for (const e of schedule) {
    const wait = t0 + e.t_ms - now();
    if (wait > 2) await sleep(wait);
    const index = Number(e.vu.slice(3)) - 1;
    const p = plan_request(e, index, opts.users, deps.discovery, now);
    if (p === null) continue;
    const job = send(e, p).finally(() => pending.delete(job));
    pending.add(job);
  }
  await Promise.all([...pending]);

  const p95: Record<string, number | null> = {};
  for (const c of CLASSES) {
    const ok = samples[c]!.filter((s) => s.ok).map((s) => s.ms);
    p95[c] = ok.length === 0 ? null : percentile(ok, 95);
  }
  const notes: string[] = [];
  if (deps.discovery.run_id === null) notes.push("progress poll skipped: no run (board polled instead)");
  return {
    p95_ms: p95,
    error_rate: error_rate(failed, completed),
    lost_updates: 0,
    n: completed,
    samples,
    failed,
    busy_count: busy,
    client_errors,
    elapsed_ms: last_done - t0,
    notes,
  };
}

// ---- discovery and sign-in ------------------------------------------------------------------------------------

export class NothingToProbe extends Error {
  constructor() {
    super("nothing to probe: seed lessons first");
    this.name = "NothingToProbe";
  }
}

export async function sign_in(base_url: string, email: string, password: string, f: typeof fetch = fetch): Promise<string> {
  const res = await f(`${base_url}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(base_url).origin },
    body: JSON.stringify({ email, password }),
  });
  await res.text();
  if (res.status !== 200) throw new Error(`sign-in failed for ${email.split("@")[0]} (status ${res.status})`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]!).find((c) => c.startsWith("ls_session="));
  if (cookie === undefined) throw new Error("sign-in set no ls_session cookie");
  return cookie;
}

export async function discover(base_url: string, cookie: string, unit: string | null, f: typeof fetch = fetch): Promise<Discovery> {
  const get = async (path: string): Promise<unknown> => {
    const r = await f(`${base_url}${path}`, { headers: { cookie } });
    if (r.status !== 200) throw new Error(`discovery ${path} returned ${r.status}`);
    return r.json();
  };
  const raw = (await get("/api/units")) as unknown;
  const units = (Array.isArray(raw) ? raw : ((raw as { units?: unknown[] }).units ?? [])) as {
    unit_id: string; unit_key: string; latest_run?: { run_id?: string } | null;
  }[];
  const wanted = unit === null ? units : units.filter((u) => u.unit_id === unit || u.unit_key === unit);
  for (const u of wanted) {
    const board = (await get(`/api/units/${encodeURIComponent(u.unit_id)}/board`)) as { rows?: { lesson_id: string }[] };
    const lesson_ids = (board.rows ?? []).map((r) => r.lesson_id).slice(0, 50);
    if (lesson_ids.length === 0) continue;
    const lesson = (await get(`/api/lessons/${encodeURIComponent(lesson_ids[0]!)}`)) as { snapshot?: { version_id?: string } };
    return {
      unit_id: u.unit_id, unit_key: u.unit_key, lesson_ids,
      run_id: u.latest_run?.run_id ?? null, version_id: lesson.snapshot?.version_id ?? "lv_probe",
    };
  }
  throw new NothingToProbe();
}
