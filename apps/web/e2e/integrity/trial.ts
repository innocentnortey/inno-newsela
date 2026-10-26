// NL-125: the trial driver. One trial = a fresh WP-3 flex-day clone (the compiled draft whose blocking findings are all resolved,
// so Submit and Approve can pass the gates; WP-1 is flawed on purpose and can never be approved, see con-18/seed.ts), three fresh
// users and three signed-in browser contexts: A (reviewer, editing), B (second reviewer, co-editing), C (approver).
// Every trial appends one line to trials.jsonl in a `finally`, so a thrown assertion is recorded as failed, then re-thrown.
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { bridgeCollab } from "../integration/con-12/bridge";
import { signedInPage } from "../integration/con-18/flow";
import { SOURCE, ensureSeeded, freshUnit, seedFlex, type SeededLesson } from "../integration/con-18/seed";
import { startCon18Stack, type Con18Stack } from "../integration/con-18/stack";
import { createRealIdUser } from "../integration/con-17/helpers";
import type { TestUser } from "../integration/support/users";
import { bridgeHeld, type Hold } from "./hold-bridge";
import { appendTrial, TRIALS } from "./results";

export interface Seat {
  user: TestUser;
  context: BrowserContext;
  page: Page;
}

/** What a trial writes down. Ids and counts only. */
export interface Rec {
  detail: Record<string, unknown>;
  request_ids: string[];
  store_ms: number | null;
  store_id: string | null;
}

export interface World {
  stack: Con18Stack;
  trial: number;
  unit: { unit_id: string; unit_key: string };
  lesson: SeededLesson;
  A: Seat;
  B: Seat;
  C: Seat;
  /** Set when A's socket is bridged through bridgeHeld (zero_edits_after_lock). */
  hold: Hold | null;
}

export interface WorldOpts {
  heldA?: boolean;
}

async function seat(browser: Browser, stack: Con18Stack, user: TestUser): Promise<Seat> {
  const context = await browser.newContext();
  const page = await signedInPage(context, user, stack);
  return { user, context, page };
}

export async function buildWorld(browser: Browser, stack: Con18Stack, trial: number, opts: WorldOpts = {}): Promise<World> {
  await ensureSeeded();
  const unit = await freshUnit();
  const [ua, ub, uc] = [await createRealIdUser("reviewer"), await createRealIdUser("reviewer"), await createRealIdUser("approver")];
  const lesson = await seedFlex({ unit, number: SOURCE, state: "in_review", reviewer_id: ua.user_id, last_editor_id: null });
  const A = await seat(browser, stack, ua);
  const B = await seat(browser, stack, ub);
  const C = await seat(browser, stack, uc);
  let hold: Hold | null = null;
  if (opts.heldA) hold = await bridgeHeld(A.page, stack.collabPort);
  else await bridgeCollab(A.page, stack.collabPort);
  await bridgeCollab(B.page, stack.collabPort);
  return { stack, trial, unit, lesson, A, B, C, hold };
}

export async function closeWorld(w: World | undefined): Promise<void> {
  if (!w) return;
  for (const s of [w.A, w.B, w.C]) await s.context.close().catch(() => {});
}

const ANSI = /\u001b\[[0-9;]*m/g;
const firstLine = (e: unknown): string => String(e instanceof Error ? e.message : e).replace(ANSI, "").split("\n")[0]!.slice(0, 300);

export async function runTrial(browser: Browser, stack: Con18Stack, token: string, trial: number, opts: WorldOpts, body: (w: World, rec: Rec) => Promise<void>): Promise<void> {
  const started = Date.now();
  const rec: Rec = { detail: {}, request_ids: [], store_ms: null, store_id: null };
  let world: World | undefined;
  let error: string | undefined;
  try {
    world = await buildWorld(browser, stack, trial, opts);
    await body(world, rec);
  } catch (e) {
    error = firstLine(e);
    throw e;
  } finally {
    appendTrial({
      token, trial, passed: error === undefined, detail: error === undefined ? rec.detail : { ...rec.detail, error }, ms: Date.now() - started,
      store_ms: rec.store_ms, request_ids: rec.request_ids.filter(Boolean), store_id: rec.store_id, ...(error === undefined ? {} : { error }),
    });
    await closeWorld(world);
  }
}

/** One spec file per assertion: TRIALS tests titled `<token> trial <t>` so `--grep <token>` selects exactly that assertion's trials. */
export function defineAssertion(token: string, opts: WorldOpts, body: (w: World, rec: Rec) => Promise<void>, count: number = TRIALS): void {
  let stack: Con18Stack;
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    stack = await startCon18Stack();
  });
  test.afterAll(async () => {
    await stack?.stop();
  });
  for (let t = 1; t <= count; t++) {
    test(`${token} trial ${t}`, async ({ browser }) => {
      await runTrial(browser, stack, token, t, opts, body);
    });
  }
}

export { expect };
