// NL-115 support: API-level calls against the CON-18 route on web2, as a signed-in account, and small helpers.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import * as Y from "yjs";
import { connectRaw, type RawClient } from "../con-12/socket";
import { cookieHeader, sessionToken } from "../con-12/helpers";
import type { SeededLesson } from "./seed";
import { expect, request, type APIRequestContext, type APIResponse, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../support/db";
import type { TestUser } from "../support/users";
import type { Con18Stack } from "./stack";

export interface Reply {
  status: number;
  requestId: string | null;
  body: Record<string, unknown>;
  text: string;
}

export async function reply(r: APIResponse): Promise<Reply> {
  const text = await r.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* not json */
  }
  return { status: r.status(), requestId: r.headers()["x-request-id"] ?? null, body, text };
}

export const errCode = (r: Reply): string | undefined => (r.body["error"] as { code?: string } | undefined)?.code;
export const errDetails = (r: Reply): Record<string, unknown> => ((r.body["error"] as { details?: Record<string, unknown> } | undefined)?.details ?? {});

/** A signed-in API client for `user` on web2 (own cookie jar; the password never leaves this call). */
export async function apiAs(stack: Con18Stack, user: TestUser): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: stack.baseURL, extraHTTPHeaders: { Origin: stack.baseURL } });
  const login = await api.post("/api/session", { data: { email: user.email, password: user.password } });
  expect(login.status(), "sign-in for the API client").toBe(200);
  return api;
}

export async function transition(api: APIRequestContext, lesson_id: string, data: unknown): Promise<Reply> {
  return reply(await api.post(`/api/lessons/${lesson_id}/transitions`, { data }));
}

export interface Pin {
  snapshot_hash: string;
  snapshot_state_vector: string;
}

/** The newest submit snapshot of a lesson as stored. */
export async function latestSubmit(lesson_id: string): Promise<{ version_id: string; content_hash: string; state_vector: string; number: number }> {
  const [v] = await db().query<{ version_id: string; content_hash: string; state_vector: string; number: number }>(
    "select id as version_id, content_hash, replace(encode(state_vector, 'base64'), E'\\n', '') as state_vector, number from lesson_version where lesson_id = $1 and kind = 'submit' order by number desc limit 1",
    [lesson_id],
  );
  if (!v) throw new Error(`no submit snapshot for ${lesson_id}`);
  return v;
}

/** rating null leaves the field out (the server must answer RATING_REQUIRED). */
export const approveBody = (pin: Pin, rating: string | null = "usable_with_edits") => ({
  action: "approve",
  snapshot_hash: pin.snapshot_hash,
  snapshot_state_vector: pin.snapshot_state_vector,
  ...(rating === null ? {} : { rating }),
});

export async function signedInPage(context: BrowserContext, user: TestUser, stack: Con18Stack): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${stack.baseURL}/sign-in`);
  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  return page;
}


export const lessonPath = (l: { unit_key: string; lesson_key: string }, approve = false): string =>
  `/units/${l.unit_key}/lessons/${l.lesson_key}${approve ? "/approve" : ""}`;

/** The base64 state vector of the newest stored lesson_doc (what a client that has everything stored would send). */
export async function storedVector(lesson_id: string): Promise<string> {
  const [r] = await db().query<{ sv: string }>("select replace(encode(state_vector, 'base64'), E'\\n', '') as sv from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lesson_id]);
  if (!r) throw new Error(`no lesson_doc for ${lesson_id}`);
  return r.sv;
}

export async function latestDocHash(lesson_id: string): Promise<string> {
  const [r] = await db().query<{ content_hash: string }>("select content_hash from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lesson_id]);
  return r!.content_hash;
}

/** A raw collaboration socket authenticated as the context's account (the cookie value is never printed). */
export async function rawSocket(stack: Con18Stack, context: BrowserContext, lesson_id: string): Promise<RawClient> {
  const client = connectRaw(stack.collabPort, lesson_id, cookieHeader(await sessionToken(context)));
  await client.until(() => client.synced() || client.authFailed(), 10_000, "socket sync");
  return client;
}

export const vectorOf = (c: RawClient): string => Buffer.from(Y.encodeStateVector(c.doc)).toString("base64");

/** The reviewer changes the stored text through the collaboration socket and waits for the store ack; returns the vector to submit. */
export async function reviewerEdits(stack: Con18Stack, context: BrowserContext, lesson_id: string, text: string): Promise<string> {
  const c = await rawSocket(stack, context, lesson_id);
  try {
    const before = c.ofType("stored").length;
    c.edit(text);
    await c.until(() => c.ofType("stored").length > before, 12_000, "store ack after the edit");
    return vectorOf(c);
  } finally {
    c.destroy();
  }
}

/** Every row the flow wrote for the given lessons, as one text blob (review_event, audit_event, lesson_metrics). */
export async function flowRowsText(lesson_ids: string[]): Promise<string> {
  const d = db();
  const parts: string[] = [];
  parts.push(...(await d.query<{ t: string }>("select r::text as t from review_event r where lesson_id = any($1)", [lesson_ids])).map((x) => x.t));
  parts.push(...(await d.query<{ t: string }>("select a::text as t from audit_event a where target_id = any($1) or details_json ->> 'lesson_id' = any($1)", [lesson_ids])).map((x) => x.t));
  return parts.join("\n");
}

/** The number of operation lines the contract holds for the transitions path (AC-9). */
export function transitionPaths(): { paths: string[]; grepCount: number } {
  const file = resolve(__dirname, "../../../../../docs/contracts/interface.openapi.yaml");
  const run = (args: string[]) => {
    try {
      return execFileSync("grep", args, { encoding: "utf8" });
    } catch (e) {
      return (e as { stdout?: string }).stdout ?? "";
    }
  };
  return {
    paths: run(["-nE", "^  /[^ ]*transitions[^ ]*:", file]).split("\n").filter(Boolean),
    grepCount: Number(run(["-c", "transitions", file]).trim()),
  };
}

export type { SeededLesson };
