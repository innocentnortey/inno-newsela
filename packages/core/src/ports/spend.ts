import type { CallPurpose, CapName, DayCapScope, JobId, ModelCallId, ReservationId, RunId, UserId, Usd } from "./common.ts";

export interface ReservationRequest {
  run_id: RunId | null; // null for AI assist: only day and project caps apply
  job_id: JobId | null;
  user_id: UserId;
  purpose: CallPurpose;
  amount_usd: Usd;
}

export interface SpendSnapshot {
  run_cap_usd: Usd | null;
  run_settled_usd: Usd;
  run_reserved_usd: Usd;
  user_day_cap_usd: Usd;
  user_day_settled_usd: Usd;
  user_day_reserved_usd: Usd;
  project_ceiling_usd: Usd;
  project_settled_usd: Usd;
  project_reserved_usd: Usd;
}

export interface ReservationDecision {
  allowed: boolean;
  reservation_id: ReservationId | null;
  refused_by: CapName | null; // the first failing cap in the order run_cap, day_cap, project_cap
  scope: DayCapScope | null;
  remaining_usd: Usd | null;
  snapshot: SpendSnapshot;
}

export type SpendReservationStatus = "reserved" | "settled" | "released";

export interface SpendReservationRow {
  reservation_id: ReservationId;
  run_id: RunId | null;
  job_id: JobId | null;
  user_id: UserId;
  purpose: CallPurpose;
  model_call_id: ModelCallId | null;
  reserved_usd: Usd;
  settled_usd: Usd;
  overshoot_usd: Usd;
  status: SpendReservationStatus;
  day: string; // UTC calendar date "YYYY-MM-DD"
  created_at: Date;
  closed_at: Date | null;
}

export interface SettledReservation {
  reservation_id: ReservationId;
  status: SpendReservationStatus;
  reserved_usd: Usd;
  settled_usd: Usd;
  released_usd: Usd;
  overshoot_usd: Usd;
}

export interface RunSpend {
  run_id: RunId;
  cap_usd: Usd;
  settled_usd: Usd;
  reserved_usd: Usd;
}

export interface SpendLedger {
  // a refusal writes nothing
  reserve(req: ReservationRequest): Promise<ReservationDecision>;
  // actual > reserved is recorded as overshoot, never refused; idempotent per model_call_id
  settle(reservation_id: ReservationId, actual_usd: Usd, model_call_id: ModelCallId): Promise<SettledReservation>;
  // no-op on a settled or released row, so callers can release in `finally`
  release(reservation_id: ReservationId): Promise<SettledReservation>;
  release_for_jobs(job_ids: readonly JobId[]): Promise<number>;
  run_totals(run_id: RunId): Promise<RunSpend>;
  // dry run, writes nothing: day_cap then project_cap
  check_day_cap(user_id: UserId, amount_usd: Usd): Promise<ReservationDecision>;
}
