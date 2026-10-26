import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import { FILL_BLOCKING, FILL_OK, LESSON4_QUOTE, LESSON5_EXCERPT, NINE_WORDS, THIRTEEN_WORDS } from "./fixtures";

type Lesson = components["schemas"]["Lesson"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });
const SHOTS = path.join(__dirname, "..", "__screenshots__", "insert-quote");
const Q4 = "/harness/insert-quote?lesson=G6.U4.L4&slot=slot-L4-PartA-quote&open=1";
const E5 = "/harness/insert-quote?lesson=G6.U4.L5&slot=slot-L5-PartA-excerpt&open=1";
const cors = { "access-control-allow-origin": "*", "x-request-id": "req-test" };

/** Serves the lesson and counts the fill POST bodies. Register respondWithError after this. */
async function serve(page: Page, lesson: Lesson = LESSON4_QUOTE, opts: { delayMs?: number; blocking?: boolean } = {}) {
  const fills: unknown[] = [];
  await page.route(apiGlob("/lessons/*"), (route: Route) => {
    if (route.request().resourceType() === "document") return route.continue();
    return route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(lesson) })
      : route.fallback();
  });
  await page.route(apiGlob("/lessons/*/slots/*/fill"), async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    fills.push(route.request().postDataJSON());
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(opts.blocking ? FILL_BLOCKING : FILL_OK) });
  });
  return fills;
}

async function open(page: Page, url = Q4) {
  await signInAs(page, "reviewer");
  await page.goto(url);
  await expect(page.getByRole("dialog")).toBeVisible();
}
const describedText = (loc: Locator) =>
  loc.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(" ").map((i) => document.getElementById(i)?.textContent ?? "").join(" "));
const insert = (page: Page) => page.getByRole("button", { name: "Insert", exact: true });
const text = (page: Page) => page.getByLabel("Text", { exact: true });
const bookField = (page: Page) => page.getByLabel("Book or title");

test("states: quote slot shows well, fields, counter, focus, stable Insert width", async ({ page }) => {
  await serve(page, LESSON4_QUOTE, { delayMs: 600 });
  await open(page);
  await expect(page.getByRole("dialog").getByText("Reviewer to insert: one sentence from Ch. 1")).toBeVisible();
  await expect(text(page)).toBeFocused();
  await text(page).fill(NINE_WORDS);
  await expect(page.getByText("9 of 12 words")).toBeVisible();
  await expect(page.getByText("Source", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Rights status")).toBeVisible();
  await bookField(page).fill("Synthetic Reader");
  const before = (await insert(page).boundingBox())!.width;
  await insert(page).click();
  const during = (await page.getByRole("button", { name: /Insert/ }).boundingBox())!.width;
  console.log(`insert width before ${before} during ${during}`);
  expect(during).toBe(before);
});

test("states: excerpt slot has a URL field", async ({ page }) => {
  await serve(page, LESSON5_EXCERPT);
  await open(page, E5);
  await expect(page.getByRole("dialog", { name: "Fill excerpt slot" })).toBeVisible();
  await expect(page.getByLabel("URL")).toBeVisible();
});

test("states: a frozen lesson offers no Insert", async ({ page }) => {
  await serve(page, { ...LESSON4_QUOTE, state: "submitted" });
  await open(page);
  await expect(page.getByText("This lesson is locked. Withdraw it first to insert a quote.")).toBeVisible();
  await expect(insert(page)).toHaveCount(0);
});

test("errors: SOURCE_REQUIRED sits on Source, QUOTE_TOO_LONG on Text, text kept", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "fillSlot", "SOURCE_REQUIRED");
  await open(page);
  await text(page).fill(NINE_WORDS);
  await insert(page).click();
  const msg = page.getByText("A quote needs a source: add the book and page, or the URL.");
  await expect(msg).toBeVisible();
  expect(await describedText(bookField(page))).toContain("A quote needs a source");
  await expect(text(page)).toHaveValue(NINE_WORDS);
});

test("errors: QUOTE_TOO_LONG sits on Text", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "fillSlot", "QUOTE_TOO_LONG", { word_count: 13 });
  await open(page);
  await text(page).fill(THIRTEEN_WORDS);
  await bookField(page).fill("Synthetic Reader");
  await insert(page).click();
  const msg = page.getByText(/13 of 12 words: a short-quote-commentary quote/);
  await expect(msg).toBeVisible();
  expect(await describedText(text(page))).toContain("13 of 12 words");
  await expect(text(page)).toHaveValue(THIRTEEN_WORDS);
});

test("server-authority: 13 words are sent once and the server decides", async ({ page }) => {
  await serve(page);
  let posts = 0;
  await page.route(apiGlob("/lessons/*/slots/*/fill"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    posts += 1;
    return route.fulfill({
      status: 422,
      contentType: "application/json",
      headers: { ...cors, "access-control-expose-headers": "x-request-id" },
      body: JSON.stringify({ error: { code: "QUOTE_TOO_LONG", message: "too long", details: { word_count: 13 } } }),
    });
  });
  await open(page);
  await text(page).fill(THIRTEEN_WORDS);
  await bookField(page).fill("Synthetic Reader");
  await insert(page).click();
  await expect(page.getByText(/13 of 12 words: a short-quote-commentary/)).toBeVisible();
  expect(posts).toBe(1);
});

test("to-clear: excerpt closes with the still-blocking toast, one POST", async ({ page }) => {
  const fills = await serve(page, LESSON5_EXCERPT, { blocking: true });
  await open(page, E5);
  await text(page).fill(NINE_WORDS);
  await bookField(page).fill("Synthetic Reader");
  await insert(page).click();
  await expect(page.getByText("Inserted. Still blocking: rights to clear.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fills.length).toBe(1);
});

for (const [name, sentence] of [
  ["network", "Couldn't insert. Your text is kept. Try again."],
  ["ROLE_FORBIDDEN", "Only reviewers insert quotes."],
  ["LESSON_LOCKED", "This lesson is locked. Withdraw it first to insert a quote."],
] as const) {
  test(`failures: ${name} shows the sentence and keeps the text`, async ({ page }) => {
    await serve(page);
    if (name === "network") await page.route(apiGlob("/lessons/*/slots/*/fill"), (r) => (r.request().method() === "OPTIONS" ? r.fallback() : r.abort()));
    else await respondWithError(page, "fillSlot", name);
    await open(page);
    await text(page).fill(NINE_WORDS);
    await bookField(page).fill("Synthetic Reader");
    await insert(page).click();
    await expect(page.getByText(sentence)).toBeVisible();
    await expect(text(page)).toHaveValue(NINE_WORDS);
  });
}

const VIEWS = [
  { w: 1280, h: 900 },
  { w: 390, h: 844 },
];
const STATES: { name: string; shot: boolean; run: (p: Page) => Promise<void> }[] = [
  {
    name: "main",
    shot: true,
    run: async (p) => {
      await serve(p);
      await open(p);
      await expect(text(p)).toBeVisible();
    },
  },
  {
    name: "source-error",
    shot: true,
    run: async (p) => {
      await serve(p);
      await respondWithError(p, "fillSlot", "SOURCE_REQUIRED");
      await open(p);
      await text(p).fill(NINE_WORDS);
      await insert(p).click();
      await expect(p.getByText("A quote needs a source")).toBeVisible();
    },
  },
  {
    name: "text-error",
    shot: false,
    run: async (p) => {
      await serve(p);
      await respondWithError(p, "fillSlot", "QUOTE_TOO_LONG", { word_count: 13 });
      await open(p);
      await text(p).fill(THIRTEEN_WORDS);
      await insert(p).click();
      await expect(p.getByText(/13 of 12 words: a short-quote/)).toBeVisible();
    },
  },
  {
    name: "frozen",
    shot: false,
    run: async (p) => {
      await serve(p, { ...LESSON4_QUOTE, state: "submitted" });
      await open(p);
      await expect(p.getByText("This lesson is locked.")).toBeVisible();
    },
  },
];

for (const st of STATES) {
  for (const v of VIEWS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${st.name} ${v.w}x${v.h} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: v.w, height: v.h });
        await st.run(page);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        if (st.shot) await page.screenshot({ path: path.join(SHOTS, `insert-quote-${st.name}-${v.w}-${theme}.png`), fullPage: true });
        const results = await axe(page).withTags(TAGS).analyze();
        const bad = results.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
        expect(bad.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        console.log(`axe ${st.name} ${v.w} ${theme}: 0 serious/critical`);
      });
    }
  }
}

test("empty insert shows field messages", async ({ page }) => {
  const fills = await serve(page);
  await open(page);
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(page.getByText("Add the quote text.")).toBeVisible();
  await expect(page.getByText("The request is not valid.")).toHaveCount(0);
  await page.getByLabel("Text").fill(NINE_WORDS);
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(page.getByText("A quote needs a source: add the book and page, or the URL.")).toBeVisible();
  await expect(page.getByLabel("Book or title")).toBeFocused();
  expect(fills).toHaveLength(0);
});
