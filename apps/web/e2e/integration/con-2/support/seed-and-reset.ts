// NL-93 support: known intake state per spec. audit_event is append-only and is never touched.
import { db } from "../../support/db";
import { getStack } from "../../support/real-stack";

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if ((await db().count("standard")) === 0) await getStack().seed();
  seeded = true;
}

export async function resetIntake(): Promise<void> {
  for (const t of [
    "outline_row",
    "outline_version",
    "lesson_link",
    "intake_choice",
    "run", // no FKs; a leftover run of G6.U4 would show on SCR-2 as the latest run
    "unit",
  ]) {
    await db().query(`delete from ${t}`);
  }
}
