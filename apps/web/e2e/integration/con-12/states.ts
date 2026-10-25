// NL-101 support (implementer): drive the SCR-9 editor into a named client state, for the axe and visual specs.
import { expect, type Browser, type Page } from "@playwright/test";
import { bridgeCollab } from "./bridge";
import { firstTextbox, savedState, signedInContext, startCollab, type Collab } from "./helpers";
import { gatedBridge, newGate } from "./outage";
import { seedLesson } from "./seed";

export type State = "connecting" | "synced" | "saving" | "stored" | "disconnected" | "read-only" | "refused-edit";

export interface Reached {
  page: Page;
  close(): Promise<void>;
}

export async function reach(browser: Browser, state: State): Promise<Reached> {
  const lesson = await seedLesson("in_review");
  const collab: Collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  const close = async () => {
    await context.close();
    await collab.close();
  };
  const gate = newGate();
  try {
    if (state === "connecting") {
      await bridgeCollab(page, collab.port, { delayMs: 60_000 });
      await page.goto(lesson.url);
      await expect(page.getByTestId("lesson-editor")).toHaveAttribute("data-client-state", "connecting", { timeout: 15_000 });
      return { page, close };
    }
    await gatedBridge(page, collab.port, gate);
    // A freeze that arrives before the first connect wins (FrozenDocs.seed): the lesson opens read-only, as after Submit.
    // (A truly submitted lesson makes the page's own lesson read fail on this seed, so the freeze models it.)
    if (state === "read-only") collab.wiring.frozen.freeze(lesson.lessonId);
    await page.goto(lesson.url);
    if (state === "read-only") {
      await expect(savedState(page, "read_only")).toBeVisible({ timeout: 20_000 });
      return { page, close };
    }
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    if (state === "synced") return { page, close };
    if (state === "stored") {
      await firstTextbox(page).click();
      await page.keyboard.type("Visible edit. ");
      await expect(savedState(page, "stored")).toBeVisible({ timeout: 15_000 });
    } else if (state === "saving") {
      gate.dropUp = true; // edits never reach the server, so the state holds at saving
      await firstTextbox(page).click();
      await page.keyboard.type("Unsaved edit. ");
      await expect(savedState(page, "saving")).toBeVisible({ timeout: 10_000 });
    } else if (state === "disconnected") {
      gate.blocked = true;
      gate.closeAll();
      await expect(savedState(page, "DISCONNECTED")).toBeVisible({ timeout: 10_000 });
    } else {
      await firstTextbox(page).click();
      collab.wiring.frozen.freeze(lesson.lessonId);
      await page.keyboard.type("Refused text");
      await expect(page.getByText(/Your last edits were not saved because/)).toBeVisible({ timeout: 10_000 });
    }
    return { page, close };
  } catch (e) {
    await close();
    throw e;
  }
}
