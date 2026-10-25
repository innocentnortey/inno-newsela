import type { SpendLedger } from "../ports/spend.ts";
import { Script } from "./scripted.ts";

export class FakeSpendLedger implements SpendLedger {
  readonly script = new Script<SpendLedger>();

  async reserve(...args: Parameters<SpendLedger["reserve"]>): Promise<Awaited<ReturnType<SpendLedger["reserve"]>>> {
    return this.script.take("reserve", args) as Awaited<ReturnType<SpendLedger["reserve"]>>;
  }
  async settle(...args: Parameters<SpendLedger["settle"]>): Promise<Awaited<ReturnType<SpendLedger["settle"]>>> {
    return this.script.take("settle", args) as Awaited<ReturnType<SpendLedger["settle"]>>;
  }
  async release(...args: Parameters<SpendLedger["release"]>): Promise<Awaited<ReturnType<SpendLedger["release"]>>> {
    return this.script.take("release", args) as Awaited<ReturnType<SpendLedger["release"]>>;
  }
  async release_for_jobs(...args: Parameters<SpendLedger["release_for_jobs"]>): Promise<Awaited<ReturnType<SpendLedger["release_for_jobs"]>>> {
    return this.script.take("release_for_jobs", args) as Awaited<ReturnType<SpendLedger["release_for_jobs"]>>;
  }
  async run_totals(...args: Parameters<SpendLedger["run_totals"]>): Promise<Awaited<ReturnType<SpendLedger["run_totals"]>>> {
    return this.script.take("run_totals", args) as Awaited<ReturnType<SpendLedger["run_totals"]>>;
  }
  async check_day_cap(...args: Parameters<SpendLedger["check_day_cap"]>): Promise<Awaited<ReturnType<SpendLedger["check_day_cap"]>>> {
    return this.script.take("check_day_cap", args) as Awaited<ReturnType<SpendLedger["check_day_cap"]>>;
  }
}
