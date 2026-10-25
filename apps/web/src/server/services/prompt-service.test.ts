// @vitest-environment node
// NL-34 AC-5, AC-9: the service has no locked-layer writer; list over fakes.
import { describe, expect, it } from "vitest";
import type { RequestUser } from "@ls/core/ports/common";
import type { PromptRepo, PromptVersionRow } from "@ls/core/ports/prompts";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { LOCKED_DIR, read_locked } from "@ls/prompts/locked";
import { readdirSync } from "node:fs";
import { diff_lines } from "./guidance-diff.ts";
import { PromptService } from "./prompt-service.ts";

const user = { user_id: "u", name: "n", email: "e", role: "author", synthetic: true, request_id: "r" } as unknown as RequestUser;
const row = (n: number, over: Partial<PromptVersionRow> = {}): PromptVersionRow =>
  ({
    prompt_version_id: "pr_" + n,
    number: n,
    locked_hash: "ab".repeat(32),
    guidance_text: "",
    author_id: null,
    reason: null,
    diff: null,
    created_at: new Date("2026-10-25T10:00:00Z"),
    ...over,
  }) as PromptVersionRow;

function fakes(rows: PromptVersionRow[]) {
  const prompts = {
    current: async () => rows[rows.length - 1]!,
    all: async () => rows,
    pinned_by_runs: async (id: string) => (id === "pr_1" ? ["run_a"] : []),
  } as unknown as PromptRepo;
  const names = { author_names: async () => new Map([["usr_known", "Known Person"]]) };
  return new PromptService(prompts, {} as never, {} as never, names);
}

function save_fakes(base = row(1, { guidance_text: "old" })) {
  const calls = { get: 0, insert: [] as unknown[][], audit: [] as any[] };
  const prompts = {
    current: async () => row(5),
    get: async (id: string) => (calls.get++, id === base.prompt_version_id ? base : null),
    insert_guidance: async (v: any, diff: string) => {
      calls.insert.push([v, diff]);
      return row(2, { guidance_text: v.guidance_text, reason: v.reason, diff, author_id: v.author_id });
    },
  } as unknown as PromptRepo;
  const audit = { append: async (e: unknown) => (calls.audit.push(e), "ae_1") } as never;
  const tx = { with_tx: async (fn: (t: unknown) => unknown) => fn({}) } as never;
  return { svc: new PromptService(prompts, audit, tx, { author_names: async () => new Map() }), calls, base };
}

describe("PromptService.save_guidance (NL-88)", () => {
  const req = (over: Record<string, string> = {}) => ({ base_version_id: "pr_1", guidance_text: "new", reason: "r", ...over });
  it("a reviewer is refused before anything is read or written", async () => {
    const { svc, calls } = save_fakes();
    await expect(svc.save_guidance({ ...user, role: "reviewer" } as never, req())).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(calls.get + calls.insert.length + calls.audit.length).toBe(0);
  });
  it("a blank reason is REASON_REQUIRED", async () => {
    const { svc, calls } = save_fakes();
    await expect(svc.save_guidance(user, req({ reason: "  " }))).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    expect(calls.insert).toHaveLength(0);
  });
  it("8,001 characters is INVALID_REQUEST naming guidance_text", async () => {
    const { svc } = save_fakes();
    await expect(svc.save_guidance(user, req({ guidance_text: "a".repeat(8001) }))).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      details: { fields: ["guidance_text"] },
    });
  });
  it("an unknown base is STALE_BASE carrying the current version", async () => {
    const { svc } = save_fakes();
    await expect(svc.save_guidance(user, req({ base_version_id: "gone" }))).rejects.toMatchObject({
      code: "STALE_BASE",
      details: { latest_version_id: "pr_5" },
    });
  });
  it("the happy path passes the diff, trims the reason and audits once without the text", async () => {
    const { svc, calls, base } = save_fakes();
    const out = await svc.save_guidance(user, req({ reason: "  why  ", guidance_text: "new text" }));
    const [v, diff] = calls.insert[0] as [any, string];
    expect(diff).toBe(diff_lines(base.guidance_text, "new text"));
    expect(v.reason).toBe("why");
    expect(calls.audit).toHaveLength(1);
    expect(JSON.stringify(calls.audit[0].details)).not.toContain("new text");
    expect(out).toMatchObject({ number: 2, author: "n", reason: "why", pinned_by_runs: [] });
  });
});

describe("PromptService (NL-34)", () => {
  it("interface_has_no_locked_writer", async () => {
    expect(Object.getOwnPropertyNames(PromptService.prototype).sort()).toEqual(["constructor", "list", "save_guidance"]);
    const lockish = Object.getOwnPropertyNames(PgPromptRepo.prototype).filter((n) => /lock/i.test(n));
    expect(lockish).toEqual(["sync_locked_layer"]);
    expect(PgPromptRepo.prototype.sync_locked_layer.length).toBe(2);
  });

  it("list maps rows: system author, unknown author, nulls to empty strings, ascending", async () => {
    const svc = fakes([row(1), row(2, { author_id: "usr_known" as never, reason: "r", diff: "+x" }), row(3, { author_id: "usr_gone" as never })]);
    const out = await svc.list(user);
    expect(out.current_prompt_version_id).toBe("pr_3");
    expect(out.locked_layer.version_id).toBe("locked-" + "ab".repeat(6));
    const files = readdirSync(LOCKED_DIR).filter((n) => n.endsWith(".md")).sort();
    expect(out.locked_layer.text).toBe(read_locked(LOCKED_DIR, files));
    expect(out.guidance_versions.map((g) => [g.number, g.author, g.reason, g.diff])).toEqual([
      [1, "system", "", ""],
      [2, "Known Person", "r", "+x"],
      [3, "system", "", ""],
    ]);
    expect(out.guidance_versions[0]!.pinned_by_runs).toEqual(["run_a"]);
  });

  it("list waits for the ready promise", async () => {
    let release!: () => void;
    const ready = new Promise<void>((r) => (release = r));
    let called = false;
    const prompts = {
      current: async () => ((called = true), row(1)),
      all: async () => [row(1)],
      pinned_by_runs: async () => [],
    } as unknown as PromptRepo;
    const svc = new PromptService(prompts, {} as never, {} as never, { author_names: async () => new Map() }, ready);
    const p = svc.list(user);
    await new Promise((r) => setTimeout(r, 20));
    expect(called).toBe(false);
    release();
    await p;
    expect(called).toBe(true);
  });
});
