// NL-94 AC-2: confirming through the SCR-4 controls records who; confirmed_at is set once, at the last confirmation.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithUpload, COPY, confirmUnitViaApi, ERRORS, getReport, screenUrl, unitConflictId } from "./helpers";

test("confirm-flow: confirmed_at stays null until the last error, then Generate is on", async ({ page }) => {
  const { user, up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  const confirmedAt = async () => (await db().query<{ confirmed_at: string | null }>("select confirmed_at from outline_version where id=$1", [vid]))[0]!.confirmed_at;
  await page.goto(screenUrl(up));
  await expect(page.getByText(`${ERRORS} errors to confirm`).first()).toBeVisible();

  const steps: { name: string; edit?: string }[] = [
    { name: "Confirm fix for row 8" },
    { name: "Confirm fix for row 30, column Focus" },
    { name: "Confirm fix for row 30, column Focus" },
    { name: "Confirm fix for row 34" },
    { name: "Edit fix for row 39", edit: "RL.6.1" },
  ];
  for (const [i, s] of steps.entries()) {
    const wait = page.waitForResponse((r) => r.url().endsWith(`/${vid}/choices`) && r.request().method() === "POST");
    if (s.edit) {
      await page.getByRole("button", { name: s.name }).click();
      await page.getByLabel("Corrected code for row 39").fill(s.edit);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    } else {
      await page.getByRole("button", { name: s.name }).first().click();
    }
    expect((await wait).status()).toBe(200);
    expect(await confirmedAt(), `confirmed_at null after step ${i + 1}`).toBeNull();
    expect((await getReport(page, vid)).counts.errors_unconfirmed).toBe(ERRORS - 1 - i);
  }
  // the sixth error (unit conflict) has no control on the screen: the report now lists it (CHG-5, tested below); this flow confirms it through the API
  expect((await getReport(page, vid)).generate_allowed).toBe(false);
  await confirmUnitViaApi(page, vid);
  const stamp = await confirmedAt();
  expect(stamp, "confirmed_at set at the last error").not.toBeNull();

  const rep = await getReport(page, vid);
  expect(rep.counts.errors_unconfirmed).toBe(0);
  expect(rep.generate_allowed).toBe(true);
  const errs = rep.rows.flatMap((r) => r.findings.filter((f) => f.level === "error"));
  expect(errs).toHaveLength(5);
  for (const f of errs) expect(f.choice).toMatchObject({ source: "confirmed", by: user.name });
  expect(rep.unit.confirmed).toBe(true);
  expect(rep.unit.confirmed_by).toBe(user.name);

  // a further choice leaves confirmed_at alone
  await page.reload();
  const note = rep.rows.flatMap((r) => r.segments).find((s) => s.kind === "editor_note");
  expect(note, "an editor note to change").toBeDefined();
  const wait = page.waitForResponse((r) => r.url().endsWith(`/${vid}/choices`) && r.request().method() === "POST");
  await page.getByRole("group", { name: /^Action for row \d+, column / }).first().getByText("Ignore").click();
  expect((await wait).status()).toBe(200);
  expect(String(await confirmedAt())).toBe(String(stamp));

  const unitId = await unitConflictId(vid);
  const rows = await db().query<{ finding_id: string; status: string; confirmed_by: string | null }>("select finding_id, status, confirmed_by from intake_choice where outline_version_id=$1", [vid]);
  const ids = new Set([...errs.map((f) => f.finding_id), unitId]);
  const errorRows = rows.filter((r) => ids.has(r.finding_id));
  expect(errorRows).toHaveLength(ERRORS);
  for (const r of errorRows) expect(r).toMatchObject({ status: "confirmed", confirmed_by: user.user_id });

  const warn = rep.rows.flatMap((r) => r.findings).find((f) => f.level === "warning");
  expect(warn!.choice.source).toBe("default");
  expect(await db().count("intake_choice", "outline_version_id=$1 and finding_id=$2 and status='confirmed'", [vid, warn!.finding_id])).toBe(0);

  await page.reload();
  await expect(page.getByText(new RegExp(`Confirmed by ${user.name} · \\d\\d:\\d\\d`)).first()).toBeVisible();
  await expect(page.getByText(COPY.allConfirmed)).toBeVisible();
  await expect(page.getByRole("button", { name: COPY.generate })).not.toHaveAttribute("aria-disabled", "true");
});

test("confirm-flow: the unit conflict has a Confirm control on SCR-4", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.goto(screenUrl(up));
  await expect(page.getByRole("button", { name: "Confirm U4 for the unit" })).toBeVisible();
});
