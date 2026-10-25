// NL-09 AC-1 [invariant|negative]
import { describe, expect, it } from "vitest";
import { AuditEventId, IssueId, JobId, LessonId, ModelCallId, OutlineVersionId, RequestId, ReservationId, RunId, Sha256, StateVector, StoreId, SuggestionId, UnitId, UserId, VersionId } from "./ids.ts";

const U = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const h64 = "a".repeat(64);
const ok: [string, { safeParse: (x: unknown) => { success: boolean } }, string][] = [
  ["unit", UnitId, "G6.U4"], ["lesson", LessonId, "G6.U4.L4"], ["lesson flex", LessonId, "G6.U4.FLEX-1a"],
  ["lesson flex2", LessonId, "G12.U10.FLEX-12"], ["ov", OutlineVersionId, "G6.U4.ov1"],
  ["usr", UserId, `usr_${U}`], ["run", RunId, `run_${U}`], ["job", JobId, `job_${U}`],
  ["mc", ModelCallId, `mc_${U}`], ["lv", VersionId, `lv_${U}`], ["st", StoreId, `st_${U}`],
  ["iss", IssueId, `iss_${U}`], ["sug", SuggestionId, `sug_${U}`], ["sr", ReservationId, `sr_${U}`],
  ["ae", AuditEventId, `ae_${U}`], ["req ulid", RequestId, `req_${U}`], ["req free", RequestId, "abc-123_x.y"],
  ["sha", Sha256, h64], ["sv", StateVector, "AQID+/8="], ["sv empty", StateVector, ""],
];
const bad: [string, { safeParse: (x: unknown) => { success: boolean } }, string][] = [
  ["lower unit", UnitId, "g6.u4"], ["unit as lesson", LessonId, "G6.U4"], ["no number", LessonId, "G6.U4.L"],
  ["trailing space", LessonId, "G6.U4.L4 "], ["flex empty", LessonId, "G6.U4.FLEX-"], ["grade 3 digits", UnitId, "G123.U1"],
  ["L4 digits", LessonId, "G6.U4.L1234"], ["ov no num", OutlineVersionId, "G6.U4.ov"], ["mc short", ModelCallId, "mc_xyz"],
  ["lower ulid", UserId, `usr_${U.toLowerCase()}`], ["wrong prefix", UserId, `run_${U}`], ["63 hash", Sha256, "a".repeat(63)],
  ["upper hash", Sha256, "A".repeat(64)], ["req bad chars", RequestId, "req id!"], ["req long", RequestId, "x".repeat(65)],
  ["sv bad", StateVector, "not base64!"],
];
describe("ids", () => {
  it.each(ok)("accepts %s", (_n, s, v) => expect(s.safeParse(v).success).toBe(true));
  it.each(bad)("rejects %s", (_n, s, v) => expect(s.safeParse(v).success).toBe(false));
});
