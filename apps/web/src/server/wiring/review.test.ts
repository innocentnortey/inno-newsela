// @vitest-environment node
// NL-53 AC-17 (container half): every review-area service is a real object. Synthetic settings; no DB is touched.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { load_web_settings } from "@ls/config/settings";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { create_logger } from "@ls/obs/logger";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import type { WebDeps } from "../deps.ts";
import { ApproveService } from "../services/approve-service.ts";
import { CandidateService } from "../services/candidate-service.ts";
import { IssueService } from "../services/issue-service.ts";
import { LessonReadService } from "../services/lesson-read-service.ts";
import { SlotService } from "../services/slot-service.ts";
import { TransitionService } from "../services/transition-service.ts";
import { wire_review } from "./review.ts";

const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
};
beforeEach(reset);
afterEach(reset);

const CLASSES = {
  lesson_reads: LessonReadService,
  issues: IssueService,
  slots: SlotService,
  candidates: CandidateService,
  transitions: TransitionService,
  approvals: ApproveService,
} as const;

describe("wire_review (NL-53)", () => {
  it("container_resolves_review_services: wire_review builds all six", () => {
    const throwing_db = new Proxy({}, { get: () => { throw new Error("db touched while wiring"); } });
    const d = {
      settings: load_web_settings(BASE),
      db: throwing_db,
      ids: new PrefixedIdGenerator(),
      clock: { now: () => new Date(), sleep: async () => {} },
      logger: create_logger({ service: "web", build_id: "test", write: () => {} }),
    } as unknown as WebDeps;
    const w = wire_review(d);
    for (const [key, cls] of Object.entries(CLASSES)) expect(w[key as keyof typeof CLASSES]).toBeInstanceOf(cls);
  });

  it("container_resolves_review_services: build_web_services resolves each without NOT BUILT", () => {
    const s = build_web_services(load_web_settings(BASE));
    for (const [key, cls] of Object.entries(CLASSES)) expect(s[key as keyof typeof CLASSES]).toBeInstanceOf(cls);
  });
});
