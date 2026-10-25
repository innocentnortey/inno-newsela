// NL-100 AC-10: axe (WCAG 2.2 AA tags) on every SCR-9 and SCR-16 state reached with real data, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { signInAs, type Role } from "../support/users";
import { scr16, scr9, waitForLesson } from "./helpers";
import { seed } from "./seed";

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(
      `axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`,
    );
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

/** Holds the first read of `pattern` until release() is called, so a loading frame is on screen. */
async function hold(page: Page, pattern: string): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(pattern, async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

async function scr9State(
  page: Page,
  role: Role,
  lessonKey: "wp1" | "submitted" | "schema99",
  state: string,
  ready: () => Promise<void>,
) {
  const s = await seed();
  await signInAs(page, role);
  await page.goto(scr9(s.lessons[lessonKey]));
  await ready();
  await check(page, state);
}

test("SCR-9 loading state @axe", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "author");
  const release = await hold(page, "**/api/lessons/G6.U4.L4");
  await page.goto(scr9(s.lessons.wp1));
  await expect(page.getByTestId("workspace-skeleton")).toBeVisible();
  await check(page, "scr9-loading");
  release();
  await waitForLesson(page);
});

test("SCR-9 content state @axe", async ({ page }) => {
  await scr9State(page, "approver", "wp1", "scr9-content", () =>
    waitForLesson(page),
  );
});

test("SCR-9 frozen state @axe", async ({ page }) => {
  await scr9State(page, "author", "submitted", "scr9-frozen", () =>
    waitForLesson(page),
  );
});

test("SCR-9 unknown-schema state @axe", async ({ page }) => {
  await scr9State(page, "author", "schema99", "scr9-unknown-schema", () =>
    expect(
      page.getByRole("alert").filter({ hasText: "won't open" }),
    ).toBeVisible(),
  );
});

test("SCR-9 role-forbidden actions state @axe", async ({ page }) => {
  // An author on a draft: the read view with the actions the role may not use.
  await scr9State(page, "author", "wp1", "scr9-role-forbidden", () =>
    waitForLesson(page),
  );
});

test("SCR-16 loading state @axe", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  const release = await hold(page, "**/api/lessons/*/history");
  await page.goto(scr16(s.lessons.reopened));
  await expect(
    page.getByRole("status", { name: "Loading history" }),
  ).toBeVisible();
  await check(page, "scr16-loading");
  release();
  await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
});

test("SCR-16 versions state @axe", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  await page.goto(scr16(s.lessons.reopened));
  await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
  await check(page, "scr16-versions");
});

test("SCR-16 missing-provenance state @axe", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  await page.goto(scr16(s.lessons.missing));
  await expect(
    page.getByRole("complementary").getByText("Missing", { exact: true }),
  ).toBeVisible();
  await check(page, "scr16-missing-provenance");
});

test("SCR-16 cannot-load state @axe", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  await page.route("**/api/lessons/*/history", (route) => route.abort());
  await page.goto(scr16(s.lessons.reopened));
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't load the history" }),
  ).toBeVisible();
  await check(page, "scr16-cannot-load");
});
