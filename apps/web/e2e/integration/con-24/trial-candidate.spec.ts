// NL-103 AC-4 (WF-20): Try on one lesson makes a candidate (never adopted) and leaves the lesson, its version and its document alone.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorSession, driverBg, getPrompts, lessonRow, LESSON, openGuidance } from "./helpers";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});

const docHash = async () => (await db().query<{ content_hash: string }>("select content_hash from lesson_doc where lesson_id=$1 order by seq desc limit 1", [LESSON]))[0]?.content_hash ?? null;
const versionHash = async (id: string) => (await db().query<{ content_hash: string }>("select content_hash from lesson_version where id=$1", [id]))[0]!.content_hash;

test("trial-candidate: Lesson 4 makes a candidate, not an adoption", async ({ page }) => {
  const { user } = await authorSession(page);
  const lesson0 = await lessonRow();
  const hash0 = await versionHash(lesson0!.current_version_id!);
  const doc0 = await docHash();
  const versions0 = await db().count("lesson_version", "lesson_id=$1", [LESSON]);
  const current = (await getPrompts(page)).current_prompt_version_id;

  await openGuidance(page);
  const option = page.getByLabel("Lesson", { exact: true }).locator("option").filter({ hasText: /^Lesson 4:/ });
  await page.getByLabel("Lesson", { exact: true }).selectOption({ label: (await option.textContent())! });
  const worker = driverBg(["trial", user.user_id]);
  await page.getByRole("button", { name: "Try on one lesson" }).click();
  await expect(page.getByText("Making a candidate on Lesson 4…")).toBeVisible();
  await expect(page.getByText("Candidate made on Lesson 4, not adopted.")).toBeVisible({ timeout: 60_000 });
  await worker;

  const [run] = await db().query<{ id: string; prompt_version_id: string }>("select id, prompt_version_id from run where kind='trial' and started_by=$1", [user.user_id]);
  expect(run!.prompt_version_id).toBe(current);
  const jobs = await db().query<{ kind: string; status: string }>("select kind, status from lesson_job where run_id=$1", [run!.id]);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.kind).toBe("candidate");
  const cands = await db().query<{ id: string; kind: string; adopted: boolean; run_id: string }>(
    "select id, kind, adopted, run_id from lesson_version where lesson_id=$1 and run_id=$2",
    [LESSON, run!.id],
  );
  expect(cands).toHaveLength(1);
  expect(cands[0]).toMatchObject({ kind: "candidate", adopted: false });
  expect(await db().count("lesson_version", "lesson_id=$1", [LESSON])).toBe(versions0 + 1);
  expect(await lessonRow()).toEqual(lesson0);
  expect(await versionHash(lesson0!.current_version_id!)).toBe(hash0);
  expect(await docHash()).toBe(doc0);

  const link = page.getByRole("link", { name: "Compare the candidate" });
  expect(await link.getAttribute("href")).toMatch(new RegExp(`/lessons/L4/candidates/${run!.id}$`));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/units/g6-u4/lessons/L4/candidates/${run!.id}$`));
  // SCR-12 resolves the candidate by its run id (CON-16); a lesson version id here would show "There is no candidate".
  const api = await page.request.get(`/api/lessons/${LESSON}/candidates/${run!.id}`);
  expect(api.status()).toBe(200);
  expect(await api.json()).toMatchObject({ candidate_id: run!.id, status: "ready", adopted: false });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/There is no candidate/)).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
});
