// NL-35: PgSpendLedger. Every spend write runs in one transaction under the advisory lock "spend",
// so reads of the sums and the insert that follows cannot interleave with another reserve.
import Decimal from "decimal.js";
import type { SpendSettings } from "@ls/config/settings";
import { InvariantViolation } from "@ls/core/errors";
import type { JobId, ModelCallId, ReservationId, RunId, UserId, Usd } from "@ls/core/ports/common";
import type {
  ReservationDecision,
  ReservationRequest,
  RunSpend,
  SettledReservation,
  SpendLedger,
  SpendReservationStatus,
  SpendSnapshot,
} from "@ls/core/ports/spend";
import { decide_reservation, user_day_cap_for } from "@ls/core/spend/reservation";
import type { Logger } from "@ls/obs/logger";
import type { Tx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

export interface PgSpendLedger_ctor extends PgRepoDeps {
  settings: SpendSettings;
  logger?: Logger;
}

const LOCK = "spend";
const ZERO = new Decimal(0);

const usd = (d: Usd): string => d.toDecimalPlaces(6).toString();
const money = (v: unknown): Usd => new Decimal(String(v ?? "0"));

interface Sums {
  settled: Usd;
  reserved: Usd;
}

interface Row {
  id: string;
  run_id: string | null;
  job_id: string | null;
  model_call_id: string | null;
  reserved_usd: unknown;
  settled_usd: unknown;
  overshoot_usd: unknown;
  status: SpendReservationStatus;
}

const AGG = `coalesce(sum(settled_usd), 0) as s,
  coalesce(sum(case when status = 'reserved' then reserved_usd else 0 end), 0) as r
  from spend_reservation`;

export class PgSpendLedger implements SpendLedger {
  readonly #db: PgRepoDeps["db"];
  readonly #ids: PgRepoDeps["ids"];
  readonly #clock: PgRepoDeps["clock"];
  readonly #settings: SpendSettings;
  readonly #logger: Logger | undefined;

  constructor(deps: PgSpendLedger_ctor) {
    this.#db = deps.db;
    this.#ids = deps.ids;
    this.#clock = deps.clock;
    this.#settings = deps.settings;
    this.#logger = deps.logger;
  }

  #today(): string {
    return this.#clock.now().toISOString().slice(0, 10);
  }

  #day_cap(): Usd {
    return user_day_cap_for(this.#settings.run_cap_default_usd, this.#settings.user_day_cap_multiplier);
  }

  async #agg(tx: Tx, where: string, values: unknown[]): Promise<Sums> {
    const { rows } = await tx.query<{ s: unknown; r: unknown }>(`select ${AGG} ${where}`, values);
    return { settled: money(rows[0]?.s), reserved: money(rows[0]?.r) };
  }

  async #sums(tx: Tx, user_id: UserId): Promise<{ day: Sums; project: Sums }> {
    const day = await this.#agg(tx, "where user_id = $1 and day = $2", [user_id, this.#today()]);
    const project = await this.#agg(tx, "", []);
    const spike = await tx.query<{ c: unknown }>(
      "select coalesce(sum(cost_usd), 0) as c from model_call where reservation_id is null",
    );
    return { day, project: { settled: project.settled.plus(money(spike.rows[0]?.c)), reserved: project.reserved } };
  }

  #snapshot(run: { cap: Usd; sums: Sums } | null, day: Sums, project: Sums): SpendSnapshot {
    return {
      run_cap_usd: run === null ? null : run.cap,
      run_settled_usd: run === null ? ZERO : run.sums.settled,
      run_reserved_usd: run === null ? ZERO : run.sums.reserved,
      user_day_cap_usd: this.#day_cap(),
      user_day_settled_usd: day.settled,
      user_day_reserved_usd: day.reserved,
      project_ceiling_usd: this.#settings.build_spend_ceiling_usd,
      project_settled_usd: project.settled,
      project_reserved_usd: project.reserved,
    };
  }

  async #run(tx: Tx, run_id: RunId): Promise<{ cap: Usd; sums: Sums }> {
    const r = await tx.query<{ cap_usd: unknown }>("select cap_usd from run where id = $1", [run_id]);
    if (r.rows.length === 0) throw new InvariantViolation("spend for unknown run", { run_id });
    return { cap: money(r.rows[0]!.cap_usd), sums: await this.#agg(tx, "where run_id = $1", [run_id]) };
  }

  async reserve(req: ReservationRequest): Promise<ReservationDecision> {
    return this.#db.with_tx(async (tx) => {
      if (req.amount_usd.lte(0)) {
        throw new InvariantViolation("reservation amount must be positive", { amount_usd: req.amount_usd.toString() });
      }
      const run = req.run_id === null ? null : await this.#run(tx, req.run_id);
      const { day, project } = await this.#sums(tx, req.user_id);
      const decision = decide_reservation(this.#snapshot(run, day, project), req.amount_usd);
      if (!decision.allowed) return decision;
      const id = this.#ids.new_id("sr");
      await tx.query(
        `insert into spend_reservation (id, run_id, job_id, user_id, purpose, reserved_usd, status, day, created_at)
         values ($1, $2, $3, $4, $5, $6::numeric, 'reserved', $7, $8)`,
        [id, req.run_id, req.job_id, req.user_id, req.purpose, usd(req.amount_usd), this.#today(), this.#clock.now()],
      );
      return { ...decision, reservation_id: id };
    }, LOCK);
  }

  #locked(tx: Tx, id: ReservationId): Promise<Row> {
    return tx
      .query<Row>("select * from spend_reservation where id = $1 for update", [id])
      .then((r) => {
        if (r.rows.length === 0) throw new InvariantViolation("unknown reservation", { reservation_id: id });
        return r.rows[0]!;
      });
  }

  #to_settled(row: Row): SettledReservation {
    const reserved = money(row.reserved_usd);
    const settled = money(row.settled_usd);
    return {
      reservation_id: row.id,
      status: row.status,
      reserved_usd: reserved,
      settled_usd: settled,
      released_usd: Decimal.max(0, reserved.minus(settled)),
      overshoot_usd: money(row.overshoot_usd),
    };
  }

  async settle(reservation_id: ReservationId, actual_usd: Usd, model_call_id: ModelCallId): Promise<SettledReservation> {
    return this.#db.with_tx(async (tx) => {
      const row = await this.#locked(tx, reservation_id);
      if (row.status === "settled") {
        if (row.model_call_id === model_call_id) return this.#to_settled(row);
        throw new InvariantViolation("reservation already settled by another model call", { reservation_id });
      }
      if (actual_usd.lt(0)) {
        throw new InvariantViolation("settled amount must not be negative", { reservation_id });
      }
      const reserved = money(row.reserved_usd);
      const overshoot = Decimal.max(0, actual_usd.minus(reserved));
      const upd = await tx.query<Row>(
        `update spend_reservation
            set status = 'settled', settled_usd = $2::numeric, overshoot_usd = $3::numeric,
                model_call_id = $4, closed_at = $5
          where id = $1 returning *`,
        [reservation_id, usd(actual_usd), usd(overshoot), model_call_id, this.#clock.now()],
      );
      if (overshoot.gt(0)) {
        this.#logger?.warn("spend.overshoot", {
          run_id: row.run_id,
          job_id: row.job_id,
          extra: {
            reservation_id,
            reserved_usd: reserved.toString(),
            actual_usd: actual_usd.toString(),
            overshoot_usd: overshoot.toString(),
          },
        });
      }
      return this.#to_settled(upd.rows[0]!);
    }, LOCK);
  }

  async release(reservation_id: ReservationId): Promise<SettledReservation> {
    return this.#db.with_tx(async (tx) => {
      const row = await this.#locked(tx, reservation_id);
      if (row.status !== "reserved") return this.#to_settled(row);
      const upd = await tx.query<Row>(
        `update spend_reservation set status = 'released', settled_usd = 0, closed_at = $2
          where id = $1 returning *`,
        [reservation_id, this.#clock.now()],
      );
      return this.#to_settled(upd.rows[0]!);
    }, LOCK);
  }

  async release_for_jobs(job_ids: readonly JobId[]): Promise<number> {
    if (job_ids.length === 0) return 0;
    return this.#db.with_tx(async (tx) => {
      const r = await tx.query(
        `update spend_reservation set status = 'released', settled_usd = 0, closed_at = $2
          where job_id = any($1::text[]) and status = 'reserved'`,
        [[...job_ids], this.#clock.now()],
      );
      return r.rowCount;
    }, LOCK);
  }

  async run_totals(run_id: RunId): Promise<RunSpend> {
    return this.#db.with_tx(async (tx) => {
      const run = await this.#run(tx, run_id);
      return { run_id, cap_usd: run.cap, settled_usd: run.sums.settled, reserved_usd: run.sums.reserved };
    });
  }

  async check_day_cap(user_id: UserId, amount_usd: Usd): Promise<ReservationDecision> {
    return this.#db.with_tx(async (tx) => {
      const { day, project } = await this.#sums(tx, user_id);
      return decide_reservation(this.#snapshot(null, day, project), amount_usd);
    });
  }
}
