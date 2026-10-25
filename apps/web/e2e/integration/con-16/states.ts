// NL-114: reaches each SCR-12 / SCR-9 state this ticket can produce on the real backend, for the axe and visual specs.
import { expect, type Browser } from "@playwright/test";
import { bridgeCollab, ensureInReview, ensureLesson, LESSON, makeCandidate, regenerate, scr12, scr9, session, settleCandidates, stack16, type Session } from "./helpers";

export type State = "scr12-drafting" | "scr12-ready" | "scr12-failed" | "scr12-section-adopted" | "scr12-collab-down" | "scr9-dialog" | "scr9-status";
export const STATES: State[] = ["scr12-drafting", "scr12-ready", "scr12-failed", "scr12-section-adopted", "scr12-collab-down", "scr9-dialog", "scr9-status"];

const heading = (s: Session) => s.page.getByRole("heading", { level: 1 });

export async function reach(browser: Browser, state: State): Promise<{ s: Session; close(): Promise<void> }> {
  await ensureLesson(browser);
  const st = await stack16();
  const s = await session(browser, "reviewer");
  await bridgeCollab(s, st.collabPort);
  await ensureInReview(s);
  const edit = `Synthetic look-and-axe sentence ${Date.now().toString(36)}.`;
  let restart = false;
  const { page } = s;
  switch (state) {
    case "scr12-drafting": {
      const r = await regenerate(s);
      await page.goto(scr12(r.body["candidate_id"]));
      await expect(page.getByTestId("candidate-drafting")).toBeVisible({ timeout: 30_000 });
      break;
    }
    case "scr12-ready":
    case "scr12-section-adopted":
    case "scr12-collab-down": {
      const c = await makeCandidate(s, "edit", { editText: edit });
      await page.goto(scr12(c.candidate_id));
      await expect(page.getByTestId("hp5-note")).toBeVisible({ timeout: 30_000 });
      if (state === "scr12-section-adopted") {
        await page.getByRole("button", { name: /^Adopt this section:/ }).first().click();
        await expect(page.getByText(/^Adopted by /).first()).toBeVisible({ timeout: 30_000 });
      }
      if (state === "scr12-collab-down") {
        await st.stopCollab();
        restart = true;
        await page.getByRole("button", { name: "Adopt whole candidate" }).click();
        await expect(page.getByText("Nothing changed. Try again.")).toBeVisible({ timeout: 30_000 });
      }
      break;
    }
    case "scr12-failed": {
      const c = await makeCandidate(s, "fail");
      await page.goto(scr12(c.candidate_id));
      await expect(page.getByText(/Candidate failed:/)).toBeVisible({ timeout: 30_000 });
      break;
    }
    case "scr9-dialog":
    case "scr9-status": {
      await page.goto(scr9);
      await expect(heading(s)).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Regenerate…" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      if (state === "scr9-status") {
        await page.getByRole("dialog").getByRole("button", { name: "Regenerate", exact: true }).click();
        await expect(page.getByTestId("regen-status")).toContainText("Drafting a candidate");
      }
      break;
    }
  }
  return {
    s,
    async close() {
      if (restart) await st.startCollab();
      await settleCandidates();
      await s.context.close();
    },
  };
}
export { LESSON };
