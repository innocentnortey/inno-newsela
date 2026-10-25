// NL-94 AC-7: WP-5 (SYN-3 row 10 reads clean) and the "A run started" banner with a later choice applying to the next run only.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithUpload, confirmAll, getReport, insertRunFromVersion, screenUrl } from "./helpers";

test("wp5-and-banner: row 10 of SYN-3 is OK with nothing flagged; the sheet's own errors still block Generate", async ({ page }) => {
  const { up } = await authorWithUpload(page, "syn3-clean-control-row10.csv");
  const rep = await getReport(page, up.outline_version_id);
  const row = rep.rows.find((r) => r.row_number === 10)!;
  // WP-5 "Required output (intake, exact)", line by line (the report exposes findings, segments and ELD verdicts)
  expect(row.level, "report line: OK").toBe("ok");
  expect(row.findings, "focus, supporting, vocabulary, homework: no finding of any kind").toEqual([]);
  expect(row.lesson_id).toBe("G6.U4.L6");
  expect(row.segments.filter((s) => s.kind === "writer_task" || s.kind === "editor_note"), "cell split: no writer tasks, no editor notes").toEqual([]);
  expect(row.eld.map((e) => e.code).sort(), "eld: the three codes").toEqual(["ELD.PI.6.6b", "ELD.PI.6.7", "ELD.PII.6.2b"].sort());
  for (const e of row.eld) expect(e.verdict, `eld ${e.code} labels match strands`).toBe("fits");
  const focus = row.segments.filter((s) => /focus/i.test(s.column)).map((s) => s.text).join(" ");
  if (focus) expect(focus).toContain("RL.6.1");

  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: /^Show \d+ OK rows$/ }).click();
  await expect(page.getByText("Row 10 · Lesson 6 · OK · 0 warnings")).toBeVisible();
  // Generate is enabled for the row (it has no finding); the whole sheet keeps the issued errors, so the button stays off
  expect(rep.counts.errors_unconfirmed).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Generate 47 lessons" })).toHaveAttribute("aria-disabled", "true");
});

test("wp5-and-banner: a run's banner shows from runs_from_this_version; a later choice leaves the run's choices alone", async ({ page }) => {
  const { user, up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  await confirmAll(page, up);
  const hash = "a".repeat(64);
  const runId = await insertRunFromVersion(vid, user.user_id, hash);
  await page.reload();
  await expect(page.getByText(/A run started from these choices at \d\d:\d\d\. Changes apply to the next run\./)).toBeVisible();
  expect((await getReport(page, vid)).runs_from_this_version[0]!.choices_hash).toBe(hash);
  const runBefore = await db().query("select choices_hash, choices_json from run where id=$1", [runId]);

  const w = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await page.getByRole("group", { name: /^Action for row \d+, column / }).first().getByText("Ignore").click();
  expect((await w).status()).toBe(200);
  expect(await db().query("select choices_hash, choices_json from run where id=$1", [runId])).toEqual(runBefore);
  await expect(page.getByText(/A run started from these choices at/)).toBeVisible();
  const note = (await getReport(page, vid)).rows.flatMap((r) => r.segments).filter((s) => s.source === "confirmed");
  expect(note.length).toBeGreaterThan(0);
});
