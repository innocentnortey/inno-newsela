// NL-101 AC-8 (frozen, risk::security). Guards: negative / invariant (R-58, CON-G3). Do not edit.
// Pasted HTML is stored as allow-listed nodes only, and no HTTP route accepts lesson content.
import { expect, test } from "@playwright/test";
import { NODE_NAMES, SCHEMA_VERSION, assert_known_nodes } from "@ls/editor-schema/schema";
import { bridgeCollab } from "./bridge";
import { docCount, firstTextbox, latestDoc, savedState, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";

test.afterAll(closeSeedPool);

const HOSTILE =
  '<script>window.__pwned=1</script><iframe src="https://example.invalid/x"></iframe><blink-x data-x="1">UNKNOWN-TAG-TEXT</blink-x><p>PASTED-SAFE-TEXT</p>';

type PmNode = { type: string; content?: PmNode[]; marks?: { type: string }[] };
function docRoots(v: unknown, out: PmNode[] = []): PmNode[] {
  if (Array.isArray(v)) v.forEach((x) => docRoots(x, out));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.type === "doc") out.push(o as unknown as PmNode);
    else Object.values(o).forEach((x) => docRoots(x, out));
  }
  return out;
}
function nodeTypes(n: PmNode, acc = new Set<string>()): Set<string> {
  acc.add(n.type);
  (n.content ?? []).forEach((c) => nodeTypes(c, acc));
  return acc;
}

test("paste-and-http-writes: pasted script/iframe/unknown tag is stored as allow-listed nodes only and assert_known_nodes accepts it [negative]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  try {
    await bridgeCollab(page, collab.port);
    await page.goto(lesson.url);
    const box = firstTextbox(page);
    await expect(box).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    const before = await docCount(lesson.lessonId);
    await box.click();
    await box.evaluate((el, html) => {
      const dt = new DataTransfer();
      dt.setData("text/html", html);
      dt.setData("text/plain", "PASTED-PLAIN-FALLBACK");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, HOSTILE);
    await expect(savedState(page, "stored")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => docCount(lesson.lessonId), { timeout: 10_000 }).toBeGreaterThan(before); // the paste was stored

    // Nothing executed or embedded in the page.
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(await page.locator('[data-testid^="section-"] script, [data-testid^="section-"] iframe').count()).toBe(0);

    const stored = (await latestDoc(lesson.lessonId))!;
    const roots = docRoots(stored.derived_json);
    expect(roots.length).toBeGreaterThan(0);
    const allowed = new Set(NODE_NAMES);
    for (const root of roots) {
      for (const t of nodeTypes(root)) expect(allowed.has(t), `node type ${t} is not allow-listed`).toBe(true);
      expect(() => assert_known_nodes(root as never, SCHEMA_VERSION)).not.toThrow();
    }
    const json = JSON.stringify(stored.derived_json);
    expect(json).not.toMatch(/"type":"(script|iframe)"/);
    expect(json).not.toContain("<script");
  } finally {
    await context.close();
    await collab.close();
  }
});

test("paste-and-http-writes: PUT/POST/PATCH of lesson content to the lesson routes is 404/405 and writes nothing [negative]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const { context, page } = await signedInContext(browser, "reviewer");
  try {
    await page.goto("/");
    const before = await docCount(lesson.lessonId);
    const body = { content: { type: "doc", content: [] }, title: "HTTP-WRITE", derived_json: {}, ydoc: "AA==" };
    const results = await page.evaluate(
      async ({ id, body }) => {
        const out: { m: string; p: string; s: number }[] = [];
        for (const p of [`/api/lessons/${id}`, `/api/lessons/${id}/content`, `/api/lessons/${id}/doc`]) {
          for (const m of ["PUT", "POST", "PATCH"]) {
            const r = await fetch(p, { method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
            out.push({ m, p, s: r.status });
          }
        }
        return out;
      },
      { id: lesson.lessonId, body },
    );
    for (const r of results) expect([404, 405], `${r.m} ${r.p} -> ${r.s}`).toContain(r.s);
    expect(await docCount(lesson.lessonId)).toBe(before);
  } finally {
    await context.close();
  }
});
