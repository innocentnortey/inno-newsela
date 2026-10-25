// NL-95 AC-7: a run pins the prompt version and the intake choices current at start; later changes leave it alone.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { authorWithConfirmedUpload, currentPrompt, getReport, openDialog, revertOne, runBody, startRunApi, uniqueKey } from "./helpers";

test("pins: a later guidance version and a later choice change leave the first run untouched", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const vid = up.outline_version_id;
  const first = await currentPrompt(page);
  const dialog = await openDialog(page, up);
  await dialog.getByRole("button", { name: "Start run" }).click();
  await page.waitForURL(`**/units/${up.unit_key}/runs/*`);
  const runs = () => db().query<{ id: string; prompt_version_id: string; choices_hash: string; choices_json: unknown }>("select id, prompt_version_id, choices_hash, choices_json from run where started_by=$1 order by created_at", [user.user_id]);
  const [a] = await runs();
  expect(a!.prompt_version_id).toBe(first.current_prompt_version_id);

  const saved = await page.request.post("/api/prompt-versions", {
    data: { base_version_id: first.current_prompt_version_id, guidance_text: "Prefer plain verbs.", reason: "e2e second version" },
    headers: { Origin: getStack().baseURL },
  });
  expect(saved.status(), await saved.text()).toBe(201);
  const second = await currentPrompt(page);
  expect(second.current_prompt_version_id).not.toBe(first.current_prompt_version_id);

  const res = await startRunApi(page, await runBody(page, vid, { kind: "rows", rows: [8] }), uniqueKey());
  expect(res.status(), await res.text()).toBe(201);
  const after = await runs();
  expect(after).toHaveLength(2);
  expect(after[0]!.prompt_version_id).toBe(first.current_prompt_version_id);
  expect(after[1]!.prompt_version_id).toBe(second.current_prompt_version_id);

  await revertOne(page, vid);
  expect((await getReport(page, vid)).counts.errors_unconfirmed).toBe(1);
  const [a2] = await runs();
  expect(a2!.choices_hash).toBe(a!.choices_hash);
  expect(a2!.choices_json).toEqual(a!.choices_json);
});
