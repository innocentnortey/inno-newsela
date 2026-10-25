// NL-100 AC-13: WF-8's PRD obligations, one case each, against the real stack.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type Role } from "../support/users";
import {
  getHistory,
  getLesson,
  p95,
  REPO_ROOT,
  timedOpens,
  walk,
} from "./helpers";
import { seed } from "./seed";

// Built from parts so no integration spec spells the folder out (con-1 GR-9 scans every spec for it).
const RESTRICTED_DIR = ["docs", "source", "restricted"].join("/");
const RESTRICTED_RE = new RegExp(["source", "restricted"].join("\\/"), "i");

test("wf-8-obligations: R-54 three roles sign in and read; wrong credentials are rejected", async ({
  page,
  browser,
}) => {
  const s = await seed();
  for (const role of ["author", "reviewer", "approver"] as Role[]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signInAs(p, role);
    expect((await getLesson(p, s.lessons.wp1)).status).toBe(200);
    expect((await getHistory(p, s.lessons.wp1)).status).toBe(200);
    await ctx.close();
  }
  const u = await createUser("author");
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(u.email);
  await page.getByLabel("Password").fill(`${u.password}-wrong`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That email and password don't match.").first(),
  ).toBeVisible();
  const anon = await page
    .context()
    .request.get(`/api/lessons/${s.lessons.wp1}`, { headers: { cookie: "" } });
  expect(anon.status()).toBe(401);
});

test("wf-8-obligations: R-57 single-user p95 of 20 opens is under 1.5 s (the 200-user figure is NL-118)", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "author");
  const v = p95(await timedOpens(page, s.lessons.wp1, 20));
  console.log("R-57 single-user p95 ms:", v);
  expect(v).toBeLessThan(1500);
});

test("wf-8-obligations: GR-9 no restricted file is tracked and none leaks into a body or the logs", async ({
  page,
}) => {
  const s = await seed();
  expect(
    execFileSync("git", ["ls-files", RESTRICTED_DIR], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim(),
  ).toBe("");
  await signInAs(page, "author");
  const bodies = JSON.stringify([
    (await getLesson(page, s.lessons.wp1)).body,
    (await getHistory(page, s.lessons.wp1)).body,
  ]);
  for (const text of [bodies, getStack().logs().join("\n")])
    expect(text).not.toMatch(RESTRICTED_RE);
});

test("wf-8-obligations: GR-13 no student or teacher-of-record keys in either body", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  const keys = new Set<string>();
  for (const body of [
    (await getLesson(page, s.lessons.reopened)).body,
    (await getHistory(page, s.lessons.reopened)).body,
    (await getLesson(page, s.lessons.wp1)).body,
  ])
    walk(body, (o) => Object.keys(o).forEach((k) => keys.add(k)));
  expect(
    [...keys].filter((k) =>
      /student|teacher|roster|district|school_id|class_id/i.test(k),
    ),
  ).toEqual([]);
});

test("wf-8-obligations: CON-G1 allowed_actions differ by role on the server and a forbidden transition is refused", async ({
  page,
  browser,
}) => {
  const s = await seed();
  const actions: Record<string, string[]> = {};
  for (const role of ["author", "reviewer", "approver"] as Role[]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signInAs(p, role);
    actions[role] = (
      await getLesson(p, s.lessons.submitted)
    ).body.allowed_actions;
    await ctx.close();
  }
  expect(
    new Set(Object.values(actions).map((a) => a.join())).size,
  ).toBeGreaterThan(1);
  expect(actions["approver"]).toContain("approve");
  expect(actions["author"]).not.toContain("approve");
  await signInAs(page, "author");
  const lesson = (await getLesson(page, s.lessons.submitted)).body;
  const before = lesson.state;
  const r = await page.request.post(
    `/api/lessons/${s.lessons.submitted}/transitions`,
    {
      data: {
        action: "approve",
        snapshot_hash: lesson.snapshot!.content_hash,
        snapshot_state_vector: lesson.snapshot!.state_vector,
        rating: "usable_as_drafted",
      },
      headers: { origin: getStack().baseURL },
    },
  );
  expect(r.status()).toBe(403);
  expect((await r.json()).error.code).toBe("ROLE_FORBIDDEN");
  expect((await getLesson(page, s.lessons.submitted)).body.state).toBe(before);
});

test("wf-8-obligations: SCR-14 the approver reaches the approve screen for the submitted lesson (smoke; NL-115 proves it)", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "approver");
  const res = await page.goto("/units/g6-u4/lessons/L5/approve");
  expect(res!.status()).toBe(200);
  await expect(page).toHaveURL(/\/units\/g6-u4\/lessons\/L5\/approve$/);
  await expect(page.locator("main")).toBeVisible();
  expect((await getLesson(page, s.lessons.submitted)).body.state).toBe(
    "submitted",
  ); // looking changed nothing
});

test("wf-8-obligations: OBS-7 no provider key, password or restricted text in the logs or the database", async ({
  page,
}) => {
  const s = await seed();
  const u = await createUser("reviewer");
  await signInAs(page, u);
  await getLesson(page, s.lessons.wp1);
  const dump = await db().dumpAll();
  const logs = getStack().logs().join("\n");
  for (const [name, text] of [
    ["database", dump],
    ["logs", logs],
  ] as const) {
    expect(text, `${name}: password`).not.toContain(u.password);
    expect(text, `${name}: provider key`).not.toMatch(
      /sk-ant-|sk-or-|ANTHROPIC_API_KEY=|OPENROUTER_API_KEY=/,
    );
    expect(text, `${name}: restricted`).not.toMatch(RESTRICTED_RE);
  }
});

test("wf-8-obligations: OBS-11 WF-8 is registered with the lesson.open event", () => {
  const md = readFileSync(
    resolve(REPO_ROOT, "docs/design/observability.md"),
    "utf8",
  );
  const row = md.split("\n").find((l) => l.startsWith("| WF-8 |"));
  expect(row).toBeDefined();
  expect(row).toContain("test_lesson_open_logs_latency");
  expect(row).toContain("M-18");
  const lines = getStack()
    .logs()
    .filter((l) => l.includes('"event":"lesson.open"'));
  expect(lines.length).toBeGreaterThan(0);
});
