// Synthetic. Builds on the NL-62 Lesson 4 fixture; the candidate changes text in Launch and Look Back only.
import type { components } from "../../src/lib/api-types";
import { LESSON4 } from "../workspace-read/fixtures";

type Candidate = components["schemas"]["Candidate"];
type AdoptResult = components["schemas"]["AdoptResult"];
type Section = Candidate["sections"][number];

const para = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }) as unknown as Section["content"];
const NEW_TEXT: Record<string, string> = {
  "G6.U4.L4.Launch": "Say: Today we read the first chapter aloud together.",
  "G6.U4.L4.LookBack": "Write two sentences about how Percy sounds.",
};

export const CAND_ID = "cand-4-4";
export const SECTION_LOOK_BACK = "G6.U4.L4.LookBack";

const changed: Section[] = LESSON4.sections.map((s) => (NEW_TEXT[s.address] ? { ...s, content: para(NEW_TEXT[s.address] as string) } : s));

export const CAND_READY: Candidate = {
  candidate_id: CAND_ID, version_number: 4, status: "ready", adopted: false, failure_reasons: [], cost_usd: 0.12,
  current_content_hash: LESSON4.content_hash, sections: changed,
};
export const CAND_DRAFTING: Candidate = { ...CAND_READY, status: "drafting", sections: [] };
export const CAND_FAILED: Candidate = {
  ...CAND_READY, status: "failed", sections: [],
  failure_reasons: [{ check: "check_failed", check_kind: "section_minutes", message: "Look Back is 3 minutes (needs 5)" }],
};
export const ADOPT_RESULT: AdoptResult = {
  candidate_id: CAND_ID, audit_id: "aud-0301", last_editor: "J. Rivera", content_hash: "a1".repeat(32),
};
