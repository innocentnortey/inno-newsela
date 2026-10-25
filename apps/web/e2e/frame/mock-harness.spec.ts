import { expect, test } from "@playwright/test";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";

const PRISM = "http://127.0.0.1:4010";
const COOKIE = { cookie: "ls_session=mock-session" };

test("prism serves the contract example for GET /session", async ({ request }) => {
  const res = await request.get(`${PRISM}/session`, { headers: COOKIE });
  expect(res.status()).toBe(200);
  expect((await res.json()).user).toBeTruthy();
});

test("mockOperation asks prism for a 404", async ({ page }) => {
  await page.goto("/gallery");
  await mockOperation(page, "getUnitBoard", { code: 404 });
  const out = await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:4010/units/G6.U4/board");
    return { status: r.status, body: await r.json() };
  });
  expect(out.status).toBe(404);
  expect(typeof out.body.error.code).toBe("string");
});

test("respondWithError returns the typed envelope", async ({ page }) => {
  await page.goto("/gallery");
  await respondWithError(page, "transitionLesson", "STALE_PIN");
  const out = await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:4010/lessons/G6.U4.L4/transitions", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return { status: r.status, body: await r.json(), id: r.headers.get("x-request-id") };
  });
  expect(out.status).toBe(409);
  expect(out.body.error.code).toBe("STALE_PIN");
  expect(out.id).toBe("req-test");
});

// Compile-time only: an unknown error code is a type error.
export async function neverRun(page: import("@playwright/test").Page) {
  // @ts-expect-error unknown code
  await respondWithError(page, "transitionLesson", "NOT_A_CODE");
}
