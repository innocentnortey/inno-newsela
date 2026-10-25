// NL-34, DO-4 section 5. Read half of CON-24: list the versions and what each run pinned.
// The locked layer is an output here; no method of this class accepts locked text.
import { readdirSync } from "node:fs";
import { DomainRefusal } from "@ls/core/errors";
import type { AuditLog } from "@ls/core/ports/audit";
import type { RequestUser } from "@ls/core/ports/common";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { TxRunner } from "@ls/core/ports/tx";
import { diff_lines } from "./guidance-diff.ts";
import type { GuidanceVersion, PromptVersions, SaveGuidanceRequest } from "@ls/schema/api/prompts";

export class NotBuiltYet extends Error {
  constructor(readonly ticket: string) {
    super("NOT BUILT: " + ticket);
    this.name = "NotBuiltYet";
  }
}

export interface AuthorNames {
  author_names(ids: string[]): Promise<Map<string, string>>;
}

export class PromptService {
  /**
   * `names` is a deliberate 4th argument beyond DO-4's three (author id to display name).
   * `ready` settles when the boot-time v1 sync has finished; `list` waits for it so a request
   * that arrives during boot does not see an empty table. It must never reject.
   */
  constructor(
    private readonly prompts: PromptRepo,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly names: AuthorNames,
    private readonly ready: Promise<void> = Promise.resolve(),
  ) {}

  async list(user: RequestUser): Promise<PromptVersions> {
    void user;
    await this.ready;
    const cur = await this.prompts.current();
    const rows = await this.prompts.all();
    const author_ids = [...new Set(rows.flatMap((r) => (r.author_id === null ? [] : [r.author_id as string])))];
    const names = await this.names.author_names(author_ids);
    const guidance_versions: GuidanceVersion[] = [];
    for (const r of rows) {
      guidance_versions.push({
        version_id: r.prompt_version_id,
        number: r.number,
        author: r.author_id === null ? "system" : (names.get(r.author_id) ?? "system"),
        created_at: r.created_at.toISOString(),
        reason: r.reason ?? "",
        diff: r.diff ?? "",
        pinned_by_runs: await this.prompts.pinned_by_runs(r.prompt_version_id),
      });
    }
    // Loaded on demand: the module reads its own file URL at load time, which breaks under jsdom importers.
    const { LOCKED_DIR, read_locked } = await import("@ls/prompts/locked");
    const files = readdirSync(LOCKED_DIR)
      .filter((n) => n.endsWith(".md"))
      .sort();
    return {
      current_prompt_version_id: cur.prompt_version_id,
      locked_layer: { version_id: "locked-" + cur.locked_hash.slice(0, 12), text: read_locked(LOCKED_DIR, files) },
      guidance_versions,
    };
  }

  /** NL-88: save guidance as version n+1. The repo owns staleness; nothing here accepts locked text (R-38, GR-18). */
  async save_guidance(user: RequestUser, req: SaveGuidanceRequest): Promise<GuidanceVersion> {
    if (user.role !== "author") throw new DomainRefusal("ROLE_FORBIDDEN", "Only authors can save guidance.");
    await this.ready;
    if (req.reason.trim() === "") throw new DomainRefusal("REASON_REQUIRED", "Say why you are changing the guidance.");
    if (req.guidance_text.length > 8000) {
      throw new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: ["guidance_text"] });
    }
    const row = await this.tx.with_tx(async (tx) => {
      const base = await this.prompts.get(req.base_version_id);
      if (base === null) {
        const cur = await this.prompts.current();
        throw new DomainRefusal("STALE_BASE", "The guidance changed since you opened it.", { latest_version_id: cur.prompt_version_id });
      }
      const diff = diff_lines(base.guidance_text, req.guidance_text);
      const created = await this.prompts.insert_guidance(
        { base_version_id: req.base_version_id, guidance_text: req.guidance_text, reason: req.reason.trim(), author_id: user.user_id },
        diff,
        tx,
      );
      await this.audit.append(
        {
          actor_id: user.user_id,
          action: "prompt.save_guidance",
          target_kind: "prompt_version",
          target_id: created.prompt_version_id,
          version_hash: null,
          reason: created.reason,
          details: { base_version_id: req.base_version_id, number: created.number },
          request_id: user.request_id,
          store_id: null,
        },
        tx,
      );
      return created;
    });
    return {
      version_id: row.prompt_version_id,
      number: row.number,
      author: user.name,
      created_at: row.created_at.toISOString(),
      reason: row.reason ?? "",
      diff: row.diff ?? "",
      pinned_by_runs: [],
    };
  }
}
