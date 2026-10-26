import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";
import {
  LOCKED_SENTINEL,
  PG_URL,
  serveBoard,
  servePromptVersions,
  serveTrial,
  serveUnits,
  versionsV2,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
// Playwright loads specs as CommonJS, so __dirname is the folder of this file.
const shotDir = () =>
  path.join(__dirname, "..", "__screenshots__", "prompt-guidance");
const h1 = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Prompt guidance" });
const guidance = (page: Page) => page.getByLabel("Guidance text");
const reasonField = (page: Page) => page.getByLabel("Reason");
const saveBtn = (page: Page) =>
  page.getByRole("button", { name: "Save as new version" });
const trialBtn = (page: Page) =>
  page.getByRole("button", { name: "Try on one lesson" });

async function open(
  page: Page,
  role: Role = "author",
  list = servePromptVersions,
) {
  await signInAs(page, role);
  const state = await list(page);
  await serveBoard(page);
  await serveUnits(page);
  await page.goto(PG_URL);
  await expect(h1(page)).toBeVisible();
  return state;
}

test("states: versions list, selected version with diff, locked layer, reason and save render", async ({
  page,
}) => {
  await open(page);
  const list = page.getByRole("list", { name: "Guidance versions" });
  await expect(list).toContainText("v1");
  await expect(list).toContainText("First guidance");
  await expect(
    page.getByRole("heading", { name: "Locked rules (read-only)" }),
  ).toBeVisible();
  await expect(page.getByText("First version.")).toBeVisible();
  await expect(reasonField(page)).toBeVisible();
  await expect(saveBtn(page)).toBeVisible();
});

test("states: ?version= selects that version and shows its diff", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePromptVersions(page, { list: versionsV2() });
  await serveBoard(page);
  await serveUnits(page);
  await page.goto("/prompt-guidance?version=guidance-1");
  const list = page.getByRole("list", { name: "Guidance versions" });
  await expect(list.locator("[aria-current='true']")).toContainText("v1");
  await page.goto("/prompt-guidance?version=guidance-2");
  await expect(
    page.getByRole("heading", { name: "Guidance v2" }),
  ).toBeVisible();
  await expect(list.locator("[aria-current='true']")).toContainText("v2");
  const diff = page.getByRole("group", { name: "Changes from v1" });
  await expect(diff.locator("[data-diff='add']")).toHaveCount(1);
  await expect(diff.locator("[data-diff='remove']")).toHaveCount(1);
  await expect(diff.locator("[data-diff='same']")).toHaveCount(1);
  // newest first
  await expect(list.getByRole("link").first()).toContainText("v2");
  await page.goto("/prompt-guidance?version=nope");
  await expect(list.locator("[aria-current='true']")).toContainText("v2");
});

test("save: posts saveGuidance once with reason and base_version_id", async ({
  page,
}) => {
  const state = await open(page);
  await guidance(page).fill("Prefer Think-Pair-Share in Launch.");
  await reasonField(page).fill("Steadier routine.");
  await saveBtn(page).dblclick();
  await expect(
    page.getByText("Guidance v2 saved. Runs already going keep v1."),
  ).toBeVisible();
  expect(state.saves).toEqual([
    {
      base_version_id: "guidance-1",
      guidance_text: "Prefer Think-Pair-Share in Launch.",
      reason: "Steadier routine.",
    },
  ]);
  await expect(
    page.getByRole("list", { name: "Guidance versions" }),
  ).toContainText("v2");
});

test("trial: starts one-lesson trial and links to SCR-12", async ({ page }) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  const calls = await serveTrial(page);
  await page.goto(PG_URL);
  await expect(h1(page)).toBeVisible();
  await page.getByLabel("Lesson", { exact: true }).selectOption("G6.U4.L4");
  await trialBtn(page).dblclick();
  await expect(
    page.getByText("Candidate made on Lesson 4, not adopted."),
  ).toBeVisible({ timeout: 15_000 });
  expect(calls.runs).toHaveLength(1);
  const run = calls.runs[0]!;
  expect(run.key).toBeTruthy();
  expect(run.body).toMatchObject({
    mode: "trial",
    lesson_id: "G6.U4.L4",
    scope: { kind: "rows", rows: [4] },
    prompt_version_id: "pv-locked1-guidance1",
    outline_version_id: "G6.U4.ov2",
  });
  await expect(
    page.getByRole("link", { name: "Compare the candidate" }),
  ).toHaveAttribute(
    "href",
    /\/units\/g6-u4\/lessons\/L4\/candidates\/run-trial-1$/,
  );
});

test("trial: only the latest version can be tried", async ({ page }) => {
  await signInAs(page, "author");
  await servePromptVersions(page, { list: versionsV2() });
  await serveBoard(page);
  await serveUnits(page);
  await page.goto("/prompt-guidance?version=guidance-1");
  await expect(
    page.getByText("Select the latest version to try it."),
  ).toBeVisible();
  await expect(trialBtn(page)).toBeDisabled();
});

test("errors: REASON_REQUIRED shows 'A version needs a reason.'", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await respondWithError(page, "saveGuidance", "REASON_REQUIRED");
  await page.goto(PG_URL);
  await guidance(page).fill("Some guidance.");
  await saveBtn(page).click();
  await expect(page.getByText("A version needs a reason.")).toBeVisible();
  await expect(guidance(page)).toHaveValue("Some guidance.");
});

test("errors: STALE_BASE shows the newer version and keeps the typed text", async ({
  page,
}) => {
  const state = await open(page, "author", (p) =>
    servePromptVersions(p, { first409: true }),
  );
  await guidance(page).fill("My text.");
  await reasonField(page).fill("My reason.");
  await saveBtn(page).click();
  await expect(
    page.getByText(
      "Someone saved a newer version first. Review it below, then save again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Guidance v2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Changes from v1" }),
  ).toBeVisible();
  await expect(guidance(page)).toHaveValue("My text.");
  await expect(reasonField(page)).toHaveValue("My reason.");
  await saveBtn(page).click();
  await expect(page.getByText(/Guidance v3 saved/)).toBeVisible();
  expect(state.saves[1]).toMatchObject({ base_version_id: "guidance-2" });
});

test("errors: network failure keeps the text", async ({ page }) => {
  await open(page, "author", (p) => servePromptVersions(p, { abort: true }));
  await guidance(page).fill("Keep me.");
  await reasonField(page).fill("Why.");
  await saveBtn(page).click();
  await expect(page.getByText("Nothing was saved. Try again.")).toBeVisible();
  await expect(guidance(page)).toHaveValue("Keep me.");
  await expect(reasonField(page)).toHaveValue("Why.");
});

test("errors: can't load shows Retry", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "listPromptVersions", "SERVICE_BUSY");
  await page.goto(PG_URL);
  await expect(page.getByText(/Couldn't load prompt guidance/)).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(h1(page)).toBeVisible();
  await expect(saveBtn(page)).toBeVisible();
  await expect(page.getByLabel("Lesson", { exact: true })).toBeEnabled();
});

test("errors: DAY_CAP_REACHED on trial keeps the selection", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await serveTrial(page, {
    fail: {
      status: 409,
      code: "DAY_CAP_REACHED",
      details: { remaining_usd: 0.2 },
    },
  });
  await page.goto(PG_URL);
  await page.getByLabel("Lesson", { exact: true }).selectOption("G6.U4.L4");
  await trialBtn(page).click();
  await expect(
    page.getByText("The day's spend cap would be passed. Remaining: $0.2."),
  ).toBeVisible();
  await expect(page.getByLabel("Lesson", { exact: true })).toHaveValue("G6.U4.L4");
});

test("errors: lessons failing to load leaves the rest of the page working", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await respondWithError(page, "getUnitBoard", "SERVICE_BUSY");
  await serveUnits(page);
  await page.goto(PG_URL);
  await expect(page.getByText("Couldn't load lessons.")).toBeVisible();
  await expect(saveBtn(page)).toBeVisible();
});

test("locked: the locked layer is never editable and never sent", async ({
  page,
}) => {
  await signInAs(page, "author");
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") sent.push(r.postData() ?? "");
  });
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await serveTrial(page);
  await page.goto(PG_URL);
  const locked = page.locator("section[aria-labelledby='pg-locked']");
  await expect(locked).toContainText(LOCKED_SENTINEL);
  await expect(
    locked.locator("input, textarea, [contenteditable]"),
  ).toHaveCount(0);
  await expect(locked.getByRole("button")).toHaveCount(0);
  await guidance(page).fill("Fine.");
  await reasonField(page).fill("Why.");
  await saveBtn(page).click();
  await expect(page.getByText(/Guidance v2 saved/)).toBeVisible();
  await page.getByLabel("Lesson", { exact: true }).selectOption("G6.U4.L4");
  await trialBtn(page).click();
  await expect(page.getByText(/Candidate made on Lesson 4/)).toBeVisible({
    timeout: 15_000,
  });
  expect(sent.length).toBeGreaterThanOrEqual(2);
  for (const b of sent) expect(b).not.toContain(LOCKED_SENTINEL);
});

for (const role of ["reviewer", "approver"] as const) {
  test(`roles: ${role} sees guidance read-only`, async ({ page }) => {
    await open(page, role);
    await expect(page.getByText("Only authors edit guidance.")).toBeVisible();
    await expect(saveBtn(page)).toHaveCount(0);
    await expect(trialBtn(page)).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Guidance versions" }),
    ).toBeVisible();
    await expect(page.getByText(LOCKED_SENTINEL)).toBeVisible();
  });
}

test("roles: ROLE_FORBIDDEN on save flips the page to read-only", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await respondWithError(page, "saveGuidance", "ROLE_FORBIDDEN");
  await page.goto(PG_URL);
  await guidance(page).fill("x");
  await reasonField(page).fill("y");
  await saveBtn(page).click();
  await expect(page.getByText("Only authors edit guidance.")).toBeVisible();
  await expect(saveBtn(page)).toHaveCount(0);
});

test("cut-flag: reachable while cut 7 stands", async ({ page }) => {
  await signInAs(page, "author");
  await servePromptVersions(page);
  await serveBoard(page);
  await serveUnits(page);
  await page.goto("/units");
  const nav = page.getByRole("navigation").getByRole("link", {
    name: "Prompt guidance",
  });
  await expect(nav.first()).toBeVisible();
  await nav.first().click();
  await expect(h1(page)).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "reviewer");
  await serveBoard(page);
  await serveUnits(page);
  await page.goto("/units");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Prompt guidance" }),
  ).toHaveCount(0);
});

type State = "main" | "stale" | "cantload" | "reviewer";

async function arrange(page: Page, state: State) {
  await signInAs(page, state === "reviewer" ? "reviewer" : "author");
  if (state === "cantload") {
    await respondWithError(page, "listPromptVersions", "SERVICE_BUSY");
    await page.goto(PG_URL);
    await expect(page.getByText(/Couldn't load prompt guidance/)).toBeVisible();
    return;
  }
  await servePromptVersions(page, { first409: state === "stale" });
  await serveBoard(page);
  await serveUnits(page);
  await page.goto(PG_URL);
  await expect(h1(page)).toBeVisible();
  if (state === "stale") {
    await guidance(page).fill("Prefer Think-Pair-Share in Launch.");
    await reasonField(page).fill("Steadier routine.");
    await saveBtn(page).click();
    await expect(
      page.getByText(/Someone saved a newer version first/),
    ).toBeVisible();
  }
}

for (const state of ["main", "stale", "cantload", "reviewer"] as const) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`prompt-guidance ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await arrange(page, state);
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as AxePage })
          .withTags(TAGS)
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        console.log(
          `axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`,
        );
        if (state === "main" || state === "stale") {
          await page.screenshot({
            path: path.join(
              shotDir(),
              `prompt-guidance-${state}-${w}-${theme}.png`,
            ),
            fullPage: true,
          });
        }
        expect(
          bad,
          JSON.stringify(
            bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ),
        ).toEqual([]);
      });
    }
  }
}
