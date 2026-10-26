// NL-103: the WP-1 lesson G6.U4.L4 as a `draft` v1, made by a real author POST /api/runs and the worker driver. Idempotent.
import type { Browser } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { ensureL4 } from "./helpers";

export async function seedL4(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({ baseURL: getStack().baseURL });
  try {
    await ensureL4(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}
