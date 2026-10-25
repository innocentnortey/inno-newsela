// NL-100 AC-2: the WP-1 lesson (Lesson 4) opens on the real stack with its sections, citation card, evidence rail and who-asserted-what.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import {
  getLesson,
  scr9,
  waitForLesson,
  wp1RequiredAddresses,
} from "./helpers";
import { seed } from "./seed";

test("wp1-read-view: Lesson 4 opens with sections, text card, standards, outline row and asserted_by", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "author"); // read view (a reviewer on a draft gets the live editor, which is NL-101's)
  const { status, body } = await getLesson(page, s.lessons.wp1);
  expect(status).toBe(200);

  await page.goto(scr9(s.lessons.wp1));
  await waitForLesson(page);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Lesson 4: The Lightning Thief, Chapter 1",
    }),
  ).toBeVisible();

  // Front matter.
  await page.getByText("Lesson details").click();
  const details = page.getByTestId("lesson-details");
  await expect(details).toContainText("minutes total");
  await expect(details).toContainText("vocabulary");

  // WP-1 "Required output" section addresses, read from the doc.
  const required = wp1RequiredAddresses();
  expect(required.length).toBeGreaterThanOrEqual(6);
  const onPage = await page
    .locator("[data-address]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-address")));
  const apiAddresses = body.sections.map((x) => x.address);
  for (const addr of required) {
    const parent = addr.replace(/\.Part[AB]$/, "");
    expect(
      onPage.includes(addr) || onPage.includes(parent),
      `address ${addr} on the page`,
    ).toBe(true);
    expect(
      apiAddresses.includes(addr) || apiAddresses.includes(parent),
      `address ${addr} in the API`,
    ).toBe(true);
  }
  await expect(page.getByText("Part A").first()).toBeVisible();

  // Text card: a citation card, no novel passage.
  const card = page.getByTestId("text-card");
  await expect(card).toContainText(s.isbn);
  await expect(card).toContainText("off-platform-text");
  const cards = await db().query<{
    cards: { title: string; content_available: boolean }[];
  }>(
    "select derived_json->'text_cards' as cards from lesson_doc where lesson_id=$1 order by seq desc limit 1",
    [s.lessons.wp1],
  );
  expect(cards[0]!.cards[0]!.content_available).toBe(false);
  const text = (await page.getByTestId("lesson-text").innerText()).replace(
    /\s+/g,
    " ",
  );
  const longQuotes = text.match(/["“][^"”]{200,}["”]/g) ?? [];
  expect(longQuotes, "no quoted block over the quote limit").toEqual([]);

  // Evidence rail: tabs, official standard text, who asserted each alignment link.
  const rail = page.getByRole("complementary", { name: "Evidence" });
  await expect(rail.getByRole("tab", { name: /Standards/ })).toBeVisible();
  await expect(rail.getByRole("tab", { name: /Outline row/ })).toBeVisible();
  await rail.getByRole("tab", { name: /Standards/ }).click();
  for (const std of s.standards) {
    await rail
      .getByRole("button", {
        name: new RegExp(`^${std.code.replaceAll(".", "\\.")}`),
      })
      .click();
    await expect(rail.locator("blockquote")).toHaveText(std.text); // the CDE row seeded in `standard`
    expect(
      body.front_matter.standards.find((x) => x.code === std.code)!
        .official_text,
    ).toBe(std.text);
  }
  expect(body.alignment_map.length).toBeGreaterThanOrEqual(3);
  for (const link of body.alignment_map) {
    expect(
      link.asserted_by,
      `alignment ${link.code} says who asserted it`,
    ).toBeTruthy();
    await expect(
      rail.getByText(`asserted by ${link.asserted_by}`).first(),
    ).toBeVisible();
  }
  await expect(rail).not.toContainText(/\baligned\b/i);

  await rail.getByRole("tab", { name: /Outline row/ }).click();
  await expect(
    rail.getByRole("heading", { name: `Row ${body.outline_row.row_number}` }),
  ).toBeVisible();
  expect(body.outline_row.segments.length).toBe(3);
  for (const seg of body.outline_row.segments)
    await expect(rail.getByText(seg.text)).toBeVisible();
});
