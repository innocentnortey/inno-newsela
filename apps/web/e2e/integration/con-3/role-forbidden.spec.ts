// NL-94 AC-6: reviewers and approvers read the report with no controls; a direct choice call is ROLE_FORBIDDEN and writes nothing.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser, signInAs, type Role } from "../support/users";
import { authorWithUpload, errorFindings, getReportText, postChoice, screenUrl } from "./helpers";

for (const [role, article] of [["reviewer", "a"], ["approver", "an"]] as [Role, string][]) {
  test(`role-forbidden: ${role} sees the report read-only and cannot write`, async ({ page, browser }) => {
    const { up } = await authorWithUpload(page);
    const vid = up.outline_version_id;
    const target = errorFindings(JSON.parse(await getReportText(page, vid)))[0]!.finding_id;

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signInAs(p2, await createUser(role));
    await p2.goto(screenUrl(up));
    await expect(p2.getByText(`You're viewing as ${article} ${role}.`)).toBeVisible();
    expect(await p2.getByRole("button", { name: /Confirm|Edit|Undo|Generate/ }).count()).toBe(0);
    expect(await p2.locator("input[type=radio]").count()).toBe(0);

    const choices0 = await db().count("intake_choice");
    const audit0 = await db().count("audit_event");
    const refused = await postChoice(p2, vid, { target_id: target, kind: "confirm_fix", value: null });
    expect(refused.status()).toBe(403);
    const refusedText = await refused.text();
    expect(JSON.parse(refusedText).error.code).toBe("ROLE_FORBIDDEN");
    expect(await db().count("intake_choice")).toBe(choices0);
    expect(await db().count("audit_event")).toBe(audit0);

    const reportText = await (await p2.request.get(`/api/outline-versions/${vid}/report`)).text();
    for (const t of [reportText, refusedText]) expect(t).not.toMatch(/"[^"]*(minutes|review_time|duration)[^"]*"\s*:/i);
    const walk = (v: unknown, out: { by?: unknown; source?: unknown }[] = []) => {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        if ("by" in o && "source" in o) out.push(o);
        Object.values(o).forEach((x) => walk(x, out));
      }
      return out;
    };
    for (const c of walk(JSON.parse(reportText))) if (c.by !== null) expect(c.source).toBe("confirmed");
    await ctx.close();
  });
}
