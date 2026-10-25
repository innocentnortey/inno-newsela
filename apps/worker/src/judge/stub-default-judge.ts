import type { JudgeClient, JudgeRequest, JudgeVerdictResult } from "@ls/core/ports/judge-client";
import { StubJudgeClient } from "@ls/llm/stub";

// NL-110. Stub mode only: the single test hook. Answers "no" for an activity carrying the marker, "yes" otherwise.
export const STUB_JUDGE_NO_MARKER = "[stub-judge:no]";

export class DefaultStubJudge implements JudgeClient {
  readonly #scripted: StubJudgeClient | null;
  #remaining: number;
  #calls = 0;

  constructor(scripted: ConstructorParameters<typeof StubJudgeClient>[0] = []) {
    this.#remaining = scripted.length;
    this.#scripted = scripted.length > 0 ? new StubJudgeClient(scripted) : null;
  }

  async verdict(req: JudgeRequest): Promise<JudgeVerdictResult> {
    if (this.#scripted !== null && this.#remaining > 0) {
      this.#remaining--;
      return this.#scripted.verdict(req);
    }
    this.#calls++;
    const verdict = req.activity_text.includes(STUB_JUDGE_NO_MARKER) ? "no" : "yes";
    const r = await new StubJudgeClient([{ verdict }]).verdict(req);
    return { ...r, provider_request_id: "stub-judge-default-" + this.#calls };
  }
}
