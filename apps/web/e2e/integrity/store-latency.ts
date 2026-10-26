// NL-125: store latency of a typing burst (SP-2: store p95 <= 500 ms [A]). store_ms is the time from the last keystroke
// of the burst to the first new lesson_doc row for the lesson, polled every 25 ms with a 10 s cap. The collab server
// debounces writes by 500 ms (STORE_DEBOUNCE_MS in con-18/stack.ts), so the verdict uses the figure net of that debounce.
import { docCount } from "../integration/con-12/helpers";

export async function typeAndMeasure(lesson_id: string, type: () => Promise<void>): Promise<number> {
  const before = await docCount(lesson_id);
  await type();
  const last_key = Date.now();
  while (Date.now() - last_key < 10_000) {
    if ((await docCount(lesson_id)) > before) return Date.now() - last_key;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("no lesson_doc row within 10 s of the last keystroke");
}
