import type { RunId, Sha256, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface PromptVersionRow {
  prompt_version_id: string;
  number: number;
  locked_hash: Sha256;
  guidance_text: string;
  author_id: UserId | null;
  reason: string | null;
  diff: string | null;
  created_at: Date;
}

export interface NewGuidanceVersion {
  base_version_id: string;
  guidance_text: string;
  reason: string;
  author_id: UserId;
}

// sync_locked_layer is repository-level, not on the port.
export interface PromptRepo {
  current(): Promise<PromptVersionRow>;
  get(prompt_version_id: string): Promise<PromptVersionRow | null>;
  all(): Promise<PromptVersionRow[]>;
  // STALE_BASE unless base is current (row lock)
  insert_guidance(v: NewGuidanceVersion, diff: string, tx: Tx): Promise<PromptVersionRow>;
  pinned_by_runs(prompt_version_id: string): Promise<RunId[]>;
}
