// NL-103 AC-12: the seven obligations of WF-20, one case per id, against the real stack.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { ERROR_STATUS } from "../../../src/server/http/error-status.generated";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import {
  authorSession, currentNumber, driver, errorOf, getPrompts, LESSON, marker, roleSession, saveApi, startRun, startRunApi, trialBody,
} from "./helpers";
import { seedL4 } from "./seed";

const ROOT = resolve(__dirname, "../../../../..");
const DIR = __dirname;
const LIVE_CANARY = "Zx-7731-canary"; // the canary literal of con-1/secrets-absent.spec.ts

/** Every object key in a JSON value (the locked text is prose that says "minutes"; only keys can carry review minutes). */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [];

test.describe("wf-20-obligations", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await seedL4(browser);
  });

  test("R-54: allow-list sign-in and roles on the API and the screen", async ({ page, browser, request }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Staff email").fill(`nobody-${marker("R54").toLowerCase()}@example.test`);
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("This email is not on the staff list.", { exact: false })).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === "ls_session")).toBeUndefined();

    const { up } = await authorSession(page);
    const p = await getPrompts(page);
    const ok = await saveApi(page, { base_version_id: p.current_prompt_version_id, guidance_text: `${marker("R54")} ok`, reason: "e2e R-54" });
    expect(ok.status()).toBe(201);
    const trial = await trialBody(page, up);
    const cur = (await getPrompts(page)).current_prompt_version_id;
    for (const role of ["reviewer", "approver"] as const) {
      const ctx = await browser.newContext({ baseURL: getStack().baseURL });
      try {
        const rp = await ctx.newPage();
        await roleSession(rp, role);
        const s = await saveApi(rp, { base_version_id: cur, guidance_text: "nope", reason: "e2e" });
        expect(s.status()).toBe(ERROR_STATUS.ROLE_FORBIDDEN);
        expect((await errorOf(s)).code).toBe("ROLE_FORBIDDEN");
        const r = await startRunApi(rp, trial);
        expect(r.status()).toBe(ERROR_STATUS.ROLE_FORBIDDEN);
        await rp.goto("/prompt-guidance");
        await expect(rp.getByText("Only authors edit guidance.")).toBeVisible();
      } finally {
        await ctx.close();
      }
    }
    const anon = await request.get("/api/prompt-versions");
    expect(anon.status()).toBe(ERROR_STATUS.UNAUTHENTICATED);
    expect((await errorOf(anon)).code).toBe("UNAUTHENTICATED");
  });

  test("GR-9: nothing from the restricted folder reaches git, prompts, logs or fixtures", async ({ page }) => {
    const { up } = await authorSession(page);
    await saveApi(page, { base_version_id: (await getPrompts(page)).current_prompt_version_id, guidance_text: `${marker("GR9")} plain`, reason: "e2e GR-9" });
    const runId = await startRun(page, await trialBody(page, up));
    await driver(["trial-pinned", runId]);
    const rows = await db().query<{ t: string }>(
      "select rendered_prompt || coalesce(raw_output,'') as t from model_call union all select guidance_text from prompt_version",
    );
    const fixtures = readdirSync(resolve(DIR, "fixtures")).map((f) => readFileSync(resolve(DIR, "fixtures", f), "utf8"));
    const hay = [...rows.map((r) => r.t), ...fixtures, ...getStack().logs()].join("\n");
    expect(hay).not.toContain(LIVE_CANARY);
    expect(hay).not.toContain("docs/source/restricted");
    const ignored = spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x.txt"], { cwd: ROOT });
    expect(ignored.status).toBe(0);
    expect(execFileSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).trim()).toBe("");
  });

  test("GR-13: staff identities only, synthetic and example.test", async ({ page }) => {
    await authorSession(page);
    expect(await db().count("app_user", "synthetic is not true")).toBe(0);
    expect(await db().count("app_user", "email not like '%@example.test'")).toBe(0);
    expect(await db().count("audit_event", "actor_id is not null and actor_id !~ '^usr_'")).toBe(0);
    expect(await db().count("run", "started_by !~ '^usr_'")).toBe(0);
    expect(await db().count("prompt_version", "author_id is not null and author_id !~ '^usr_'")).toBe(0);
  });

  test("CON-G8: no route here returns review minutes with a person's name", async ({ page }) => {
    await authorSession(page);
    const res = await page.request.get("/api/prompt-versions");
    expect(res.status()).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(["current_prompt_version_id", "guidance_versions", "locked_layer"]);
    expect(keysOf(await res.json()).filter((k) => /minutes/i.test(k))).toEqual([]);
    const hist = await page.request.get(`/api/lessons/${LESSON}/history`);
    expect(hist.status()).toBe(200);
    expect(keysOf(await hist.json()).filter((k) => /minutes/i.test(k))).toEqual([]);
  });

  test("SCR-5: the Start run dialog shows the current guidance version and the run pins it", async ({ page }) => {
    const { user, up } = await authorSession(page);
    const p = await getPrompts(page);
    const saved = await saveApi(page, { base_version_id: p.current_prompt_version_id, guidance_text: `${marker("SCR5")} text`, reason: "e2e SCR-5" });
    expect(saved.status()).toBe(201);
    const now = await getPrompts(page);
    const n = currentNumber(now);
    await page.goto(`/units/g6-u4/outlines/${up.version_number}`);
    await page.getByRole("button", { name: "Generate 47 lessons" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a run" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(new RegExp(`v${n}\\b`)).first()).toBeVisible();
    await dialog.getByText("Chosen rows").click();
    await dialog.getByRole("textbox", { name: "Rows" }).fill("8");
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect.poll(() => db().count("run", "started_by=$1", [user.user_id])).toBe(1);
    const [run] = await db().query<{ id: string; prompt_version_id: string }>("select id, prompt_version_id from run where started_by=$1", [user.user_id]);
    expect(run!.prompt_version_id).toBe(now.current_prompt_version_id);
    await driver(["parent", run!.id]);
  });

  test("OBS-7: no key, password or session token is recorded anywhere", async ({ page, context }) => {
    const { user, up } = await authorSession(page);
    const token = (await context.cookies()).find((c) => c.name === "ls_session")!.value;
    const runId = await startRun(page, await trialBody(page, up));
    await driver(["trial-pinned", runId]);
    const rows = await db().query<{ t: string }>(
      "select coalesce(details_json::text,'') || coalesce(reason,'') as t from audit_event union all select rendered_prompt || coalesce(raw_output,'') from model_call",
    );
    const hay = [...rows.map((r) => r.t), ...getStack().logs()].join("\n");
    expect(hay).not.toContain(user.password);
    expect(hay).not.toContain(token);
    expect(hay).not.toMatch(/(ANTHROPIC|OPENROUTER)_API_KEY["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/);
    expect(hay).not.toMatch(/sk-(ant|or)-[A-Za-z0-9_-]{10,}/);
  });

  test("OBS-11: WF-20 is registered and its capture test exists", async () => {
    const obs = readFileSync(resolve(ROOT, "docs/design/observability.md"), "utf8");
    const row = obs.split("\n").find((l) => l.startsWith("| WF-20"));
    expect(row).toBeTruthy();
    for (const name of ["prompt_version", "lesson_job", "model_call", "audit_event", "test_prompt_version_capture"]) expect(row).toContain(name);
    expect(readFileSync(resolve(DIR, "capture.spec.ts"), "utf8")).toContain('test("test_prompt_version_capture"');
  });
});
