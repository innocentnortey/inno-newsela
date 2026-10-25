// NL-100 AC-7 (R-35, GR-8, CON-19, SCR-16): five version kinds field by field on real data, the human-made inheritance, and the Missing case.
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../support/users";
import { getHistory, scr16, type LessonHistory } from "./helpers";
import { seed } from "./seed";

const KIND: Record<string, string> = {
  generated: "Generated",
  candidate: "Candidate (not adopted)",
  submit: "Submit snapshot",
  approval: "Approval",
  reopen: "Reopen",
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " UTC";
const short = (h: string) => `${h.slice(0, 4)}…${h.slice(-4)}`;
const word = (s: string) => s.replace(/_/g, " ");

async function open(page: Page, id: string): Promise<LessonHistory> {
  await signInAs(page, "reviewer");
  const { body } = await getHistory(page, id);
  await page.goto(scr16(id));
  await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
  return body;
}

test("history: five versions, field by field, with inherited provenance on the human-made ones", async ({
  page,
}) => {
  const s = await seed();
  const h = await open(page, s.lessons.reopened);
  expect(h.versions.map((v) => v.kind)).toEqual([
    "generated",
    "candidate",
    "submit",
    "approval",
    "reopen",
  ]);
  const gen = h.versions[0]!;
  const list = page.getByRole("list", { name: "Versions" });
  const moves: Record<string, string> = {
    submit: "in review → submitted",
    approval: "submitted → approved",
    reopen: "approved → reopened",
  };

  for (const v of h.versions) {
    const n = v.version_number;
    const item = list
      .getByRole("listitem")
      .filter({
        has: page.getByRole("button", {
          name: new RegExp(
            `^v${n} · ${KIND[v.kind]!.replace(/[()]/g, "\\$&")}$`,
          ),
        }),
      });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(
      `By ${v.created_by} · ${when(v.created_at)}`,
    );
    await expect(item).toContainText(short(v.content_hash));
    await expect(item.getByRole("button", { name: "Copy hash" })).toBeVisible();
    await expect(item).toContainText(moves[v.kind] ?? "No state change");

    // Select it: the provenance rail shows the object.
    await item.getByRole("button", { name: new RegExp(`^v${n} · `) }).click();
    const rail = page.getByRole("complementary");
    await expect(rail).toContainText(`v${n} · ${KIND[v.kind]}`);
    await expect(rail).toContainText(v.provenance.outline_row_hash);
    await expect(rail).toContainText(v.provenance.prompt_version_id);
    await expect(rail).toContainText(v.provenance.run_id!);
    await expect(rail).toContainText(String(v.provenance.schema_version));
    await expect(rail).not.toContainText("Missing");

    if (v.kind === "generated" || v.kind === "candidate") {
      expect(v.provenance.model).toBe("stub-model-1");
      await expect(rail).toContainText("stub-model-1");
      await expect(rail).toContainText("$0.42");
      expect(v.adopted).toBe(v.kind === "candidate" ? false : null);
    } else {
      // Human-made: inherits the four fields, names its parent, no model, cost 0.
      for (const f of [
        "outline_row_hash",
        "prompt_version_id",
        "schema_version",
        "run_id",
      ] as const)
        expect(v.provenance[f], f).toEqual(gen.provenance[f]);
      expect(v.provenance.derived_from_version_id).toBe(gen.version_id);
      expect(v.provenance.model).toBeNull();
      expect(v.provenance.parameters).toBeNull();
      expect(v.provenance.cost_usd).toBe(0);
      await expect(rail).toContainText(`Made from ${gen.version_id}`);
      await expect(rail).toContainText("Not applicable (made by a person)");
      await expect(rail).toContainText("$0.00");
    }
  }

  // Audit rows of the lesson come from the real audit view: who, when, from → to.
  expect(h.audit.map((a) => [a.action, a.from_state, a.to_state])).toEqual([
    ["lesson.store", null, null],
    ["lesson.transition", "draft", "in_review"],
    ["lesson.transition", "in_review", "submitted"],
    ["lesson.transition", "submitted", "approved"],
    ["lesson.transition", "approved", "reopened"],
  ]);
  void word;
});

test("history: a version whose provenance lacks a field shows Missing in the danger colour", async ({
  page,
}) => {
  const s = await seed();
  const h = await open(page, s.lessons.missing);
  expect(h.versions).toHaveLength(1);
  expect(h.versions[0]!.provenance.prompt_version_id).toBe("");
  const rail = page.getByRole("complementary");
  const missing = rail.getByText("Missing", { exact: true });
  await expect(missing).toHaveCount(1);
  await expect(
    rail.getByText("Prompt version").locator("xpath=following-sibling::dd"),
  ).toHaveText("Missing");
  const colours = await page.evaluate(
    (el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--color-danger)";
      document.body.appendChild(probe);
      const danger = getComputedStyle(probe).color;
      probe.remove();
      return { danger, actual: getComputedStyle(el as Element).color };
    },
    await missing.elementHandle(),
  );
  expect(colours.actual).toBe(colours.danger);
  expect(colours.danger).not.toBe("rgba(0, 0, 0, 0)");
});
