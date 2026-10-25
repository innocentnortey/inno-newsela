// NL-94 AC-8: WF-3 capture verification (docs/design/observability.md).
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { authorWithUpload, getReport, postChoice, reportPath, screenUrl } from "./helpers";

test("test_intake_confirm_capture: one error confirmed, one warning back on default, both rows and the audit events", async ({ page, context }) => {
  const { user, up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  const audits = () => db().query<{ actor_id: string; target_id: string; request_id: string | null; details_json: { kind?: string } }>("select actor_id, target_id, request_id, details_json from audit_event where action='outline.choice' and target_id=$1 order by at", [vid]);

  await test.step("reading the report writes nothing", async () => {
    const [a, c] = [await db().count("audit_event"), await db().count("intake_choice")];
    await page.request.get(reportPath(vid));
    await page.request.get(reportPath(vid));
    expect([await db().count("audit_event"), await db().count("intake_choice")]).toEqual([a, c]);
  });
  await test.step("confirm one error with the screen", async () => {
    await page.goto(screenUrl(up));
    const w = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm fix for row 8" }).click();
    expect((await w).status()).toBe(200);
  });
  const note = (await getReport(page, vid)).rows.flatMap((r) => r.segments).find((s) => s.kind === "editor_note")!;
  await test.step("change one warning, then return it to its stored default", async () => {
    const set = await postChoice(page, vid, { target_id: note.segment_id, kind: "set_note_action", value: "ignore" });
    expect(set.status()).toBe(200);
    const back = await postChoice(page, vid, { target_id: note.segment_id, kind: "revert" });
    expect(back.status()).toBe(200);
  });
  await test.step("both intake_choice rows: one confirmed by the author, one default", async () => {
    const rows = await db().query<{ finding_id: string; status: string; confirmed_by: string | null }>("select finding_id, status, confirmed_by from intake_choice where outline_version_id=$1", [vid]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.status === "confirmed")!.confirmed_by).toBe(user.user_id);
    const d = rows.find((r) => r.status === "default")!;
    expect(d.finding_id).toBe(note.segment_id);
    expect(d.confirmed_by).toBeNull();
  });
  await test.step("one outline.choice audit event per write, with the confirmer", async () => {
    const ev = await audits();
    expect(ev).toHaveLength(3);
    for (const e of ev) {
      expect(e.actor_id).toBe(user.user_id);
      expect(e.request_id ?? "").not.toBe("");
    }
    expect(ev.map((e) => e.details_json.kind)).toEqual(["confirm_fix", "set_note_action", "revert"]);
  });
  await test.step("no secret, hash or cell text in the stored rows or the logs", async () => {
    const stored = JSON.stringify([await db().query("select * from intake_choice where outline_version_id=$1", [vid]), await audits()]);
    const cookie = (await context.cookies()).find((c) => c.name === "ls_session")!;
    expect(stored).not.toContain("password_hash");
    expect(stored).not.toContain(cookie.value);
    expect(stored).not.toContain(user.password);
    expect(stored).not.toContain(note.text);
    expect(getStack().logs().filter((l) => l.includes(cookie.value))).toEqual([]);
    expect(await db().count("model_call")).toBe(0);
  });
});
