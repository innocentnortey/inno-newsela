// NL-101 support (test-writer, frozen with the specs): in-process collab server, session cookie access, row counts.
// Never log or print a cookie value or token hash.
import { createHash } from "node:crypto";
import { Server } from "@hocuspocus/server";
import type { BrowserContext, Page } from "@playwright/test";
import { load_collab_settings, type CollabSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { create_logger } from "@ls/obs/logger";
import { wire_collab_server, type CollabServerWiring } from "../../../../collab/src/wiring/server";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";

export const COLLAB_TOKEN = "e2e-token-00000000000000000";
export const COOKIE_NAME = "ls_session";

export function collabSettings(): CollabSettings {
  return load_collab_settings({
    DATABASE_URL: getStack().databaseUrl,
    COLLAB_INTERNAL_TOKEN: COLLAB_TOKEN,
    SESSION_COOKIE_NAME: COOKIE_NAME,
    STORE_DEBOUNCE_MS: "500",
    STORE_MAX_DEBOUNCE_MS: "1000",
  });
}

export interface Collab {
  port: number;
  wiring: CollabServerWiring;
  /** Application log lines (JSON strings) written by the collab server since start. */
  log: string[];
  close(): Promise<void>;
}

/** Real Hocuspocus + wire_collab_server inside the spec worker, so FrozenDocs is reachable (plan section 4). */
export async function startCollab(): Promise<Collab> {
  const log: string[] = [];
  const logger = create_logger({ service: "collab", build_id: "e2e", write: (l: string) => void log.push(l) });
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const wiring = wire_collab_server(
    { settings: collabSettings(), logger, db: undefined as never, ids: new PrefixedIdGenerator(), clock: new SystemClock() },
    { hocuspocus: server.hocuspocus },
  );
  await server.listen();
  return {
    port: server.address.port,
    wiring,
    log,
    async close() {
      await server.destroy();
      await wiring.close();
    },
  };
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** The raw ls_session value of a signed-in context. Callers must not print it. */
export async function sessionToken(context: BrowserContext): Promise<string> {
  const c = (await context.cookies()).find((x) => x.name === COOKIE_NAME);
  if (!c) throw new Error("no session cookie: sign in first");
  return c.value;
}

export const cookieHeader = (token: string): string => `${COOKIE_NAME}=${token}`;

export async function docCount(lessonId: string): Promise<number> {
  return db().count("lesson_doc", "lesson_id = $1", [lessonId]);
}
export async function auditCount(): Promise<number> {
  return db().count("audit_event");
}
export async function latestDoc(lessonId: string): Promise<{ seq: number; content_hash: string; derived_json: unknown } | undefined> {
  const rows = await db().query<{ seq: number; content_hash: string; derived_json: unknown }>(
    "select seq, content_hash, derived_json from lesson_doc where lesson_id = $1 order by seq desc limit 1",
    [lessonId],
  );
  return rows[0];
}
export function refusalLines(c: Collab): string[] {
  return c.log.filter((l) => l.includes("collab.write_refused"));
}

export const clientState = (page: Page) => page.getByTestId("lesson-editor");
/** First section text box of the SCR-9 editor. */
export const firstTextbox = (page: Page) => page.locator('[data-testid^="section-"] [role="textbox"]').first();

import type { Browser } from "@playwright/test";
import { createUser, signInAs, type Role, type TestUser } from "../support/users";

/** A fresh browser context signed in as a fresh user of `role`. */
export async function signedInContext(browser: Browser, role: Role): Promise<{ context: BrowserContext; page: Page; user: TestUser }> {
  const context = await browser.newContext({ baseURL: getStack().baseURL });
  const page = await context.newPage();
  const user = await signInAs(page, await createUser(role));
  return { context, page, user };
}

export const savedState = (page: Page, state: string) =>
  page.locator(`[data-testid="lesson-editor"][data-client-state="${state}"]`);
