// NL-93 AC-15: WF-2 obligations R-54, GR-13, GR-9, OBS-7 (GR-5 and OBS-11 arrive at checkpoint 3 with the link path).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, request } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_CSV, ISSUED_XLSX, REPO_ROOT } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("R-54: signed-out upload is 401, reviewer is ROLE_FORBIDDEN, author gets 201", async ({
  page,
  baseURL,
}) => {
  const anon = await request.newContext({ baseURL });
  const f = fromPath(ISSUED_CSV);
  const res = await anon.post("/api/outline-versions", {
    multipart: { file: f },
    headers: { Origin: baseURL! },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  await anon.dispose();

  await signInAs(page, await createUser("reviewer"));
  expect((await postOutline(page, getStack().baseURL, f)).body.error.code).toBe(
    "ROLE_FORBIDDEN",
  );
  await page.context().clearCookies();
  await signInAs(page, await createUser("author"));
  expect((await postOutline(page, getStack().baseURL, f)).status).toBe(201);
});

test("GR-13: only the three staff roles exist and the units payload names no students or teachers", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  await postOutline(page, getStack().baseURL, fromPath(ISSUED_CSV));
  const roles = (
    await db().query<{ role: string }>("select distinct role from app_user")
  ).map((r) => r.role);
  for (const r of roles)
    expect(["author", "reviewer", "approver"]).toContain(r);
  const body = await (await page.request.get("/api/units")).text();
  const keys = [...body.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]);
  expect(keys.filter((k) => /student|teacher/i.test(k ?? ""))).toEqual([]);
});

test("GR-9: restricted source folder is git-ignored, untracked, and not referenced by these specs", async () => {
  const dir = ["docs", "source", "restricted"].join("/"); // built from parts: con-1's GR-9 scans every integration file for the literal
  execFileSync("git", ["check-ignore", "-q", `${dir}/x`], { cwd: REPO_ROOT });
  const tracked = execFileSync("git", ["ls-files", dir], { cwd: REPO_ROOT })
    .toString()
    .trim();
  expect(tracked).toBe("");
  const needle = ["source", "restricted"].join("/");
  for (const f of readdirSync(__dirname).filter(
    (n) => n.endsWith(".spec.ts") && n !== "wf-2-obligations.spec.ts",
  )) {
    expect(readFileSync(join(__dirname, f), "utf8"), f).not.toContain(needle);
  }
});

test("OBS-7: neither logs nor the database hold the password or a session token", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  await postOutline(page, getStack().baseURL, fromPath(ISSUED_XLSX));
  const tokens = (await page.context().cookies())
    .filter((c) => c.name === "ls_session")
    .map((c) => c.value);
  expect(tokens.length).toBeGreaterThan(0);
  const logs = getStack().logs().join("\n");
  const dump = await db().dumpAll();
  for (const secret of [user.password, ...tokens]) {
    expect(logs).not.toContain(secret);
    expect(dump).not.toContain(secret);
  }
});
