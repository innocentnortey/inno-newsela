// NL-101 AC-4 (frozen, risk::security). Guards: negative. Do not edit.
// Four sockets that must be refused (no cookie, forged, expired, signed out) and a live socket closed by sign-out.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { auditCount, cookieHeader, docCount, sessionToken, sha256, signedInContext, startCollab, type Collab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";
import { connectRaw } from "./socket";

test.afterAll(closeSeedPool);

async function expectRefused(collab: Collab, lessonId: string, cookie: string | null) {
  const docs = await docCount(lessonId);
  const audits = await auditCount();
  const c = connectRaw(collab.port, lessonId, cookie);
  try {
    await c.until(() => c.authFailed() || c.closed(), 8000, "authentication refusal");
    await new Promise((r) => setTimeout(r, 1500)); // longer than the store debounce
    expect(c.synced()).toBe(false); // no document state delivered
    expect(c.doc.getMap("front_matter").size).toBe(0);
    c.edit("MUST-NOT-LAND");
    await new Promise((r) => setTimeout(r, 1500));
    expect(collab.log.some((l) => l.includes("collab.auth_refused") && l.includes("UNAUTHENTICATED"))).toBe(true);
    expect(await docCount(lessonId)).toBe(docs);
    expect(await auditCount()).toBe(audits);
  } finally {
    c.destroy();
  }
}

test.describe("unauthenticated-refused", () => {
  test("unauthenticated-refused: no cookie gets UNAUTHENTICATED, no state, nothing written [negative]", async () => {
    const lesson = await seedLesson();
    const collab = await startCollab();
    try {
      await expectRefused(collab, lesson.lessonId, null);
    } finally {
      await collab.close();
    }
  });

  test("unauthenticated-refused: forged cookie gets UNAUTHENTICATED, no state, nothing written [negative]", async () => {
    const lesson = await seedLesson();
    const collab = await startCollab();
    try {
      await expectRefused(collab, lesson.lessonId, cookieHeader("f0".repeat(16)));
    } finally {
      await collab.close();
    }
  });

  test("unauthenticated-refused: expired session gets UNAUTHENTICATED, no state, nothing written [negative]", async ({ browser }) => {
    const lesson = await seedLesson();
    const collab = await startCollab();
    const { context, user } = await signedInContext(browser, "reviewer");
    try {
      const token = await sessionToken(context);
      const upd = await db().query("update app_session set expires_at = now() - interval '1 hour' where token_hash = $1 returning user_id", [sha256(token)]);
      expect(upd.length).toBe(1);
      expect(user.user_id).toBeTruthy();
      await expectRefused(collab, lesson.lessonId, cookieHeader(token));
    } finally {
      await context.close();
      await collab.close();
    }
  });

  test("unauthenticated-refused: signed-out session gets UNAUTHENTICATED, no state, nothing written [negative]", async ({ browser }) => {
    const lesson = await seedLesson();
    const collab = await startCollab();
    const { context, page } = await signedInContext(browser, "reviewer");
    try {
      const token = await sessionToken(context);
      const status = await page.evaluate(async () => (await fetch("/api/session", { method: "DELETE" })).status);
      expect(status).toBe(204);
      await expectRefused(collab, lesson.lessonId, cookieHeader(token));
    } finally {
      await context.close();
      await collab.close();
    }
  });

  test("unauthenticated-refused: signing out closes that session's open socket and its later writes persist nothing [negative]", async ({ browser }) => {
    const lesson = await seedLesson();
    const collab = await startCollab();
    const { context, page } = await signedInContext(browser, "reviewer");
    const live = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(context)));
    try {
      await live.until(() => live.synced(), 8000, "live socket sync");
      expect(live.ofType("mode")[0]).toMatchObject({ mode: "editable" });
      const docs = await docCount(lesson.lessonId);
      const status = await page.evaluate(async () => (await fetch("/api/session", { method: "DELETE" })).status);
      expect(status).toBe(204);
      await live.until(() => live.closed(), 5000, "socket closed after sign-out"); // ticket > seam S-9 (plan 8.3)
      live.edit("AFTER-SIGN-OUT");
      await new Promise((r) => setTimeout(r, 1800));
      expect(await docCount(lesson.lessonId)).toBe(docs);
    } finally {
      live.destroy();
      await context.close();
      await collab.close();
    }
  });
});
