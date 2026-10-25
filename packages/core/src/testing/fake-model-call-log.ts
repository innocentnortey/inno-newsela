import type { ModelCallLog } from "../ports/model-call-log.ts";
import { Script } from "./scripted.ts";

export class FakeModelCallLog implements ModelCallLog {
  readonly script = new Script<ModelCallLog>();

  async insert_sent(...args: Parameters<ModelCallLog["insert_sent"]>): Promise<Awaited<ReturnType<ModelCallLog["insert_sent"]>>> {
    return this.script.take("insert_sent", args) as Awaited<ReturnType<ModelCallLog["insert_sent"]>>;
  }
  async complete(...args: Parameters<ModelCallLog["complete"]>): Promise<Awaited<ReturnType<ModelCallLog["complete"]>>> {
    return this.script.take("complete", args) as Awaited<ReturnType<ModelCallLog["complete"]>>;
  }
  async fail(...args: Parameters<ModelCallLog["fail"]>): Promise<Awaited<ReturnType<ModelCallLog["fail"]>>> {
    return this.script.take("fail", args) as Awaited<ReturnType<ModelCallLog["fail"]>>;
  }
  async mark_lost(...args: Parameters<ModelCallLog["mark_lost"]>): Promise<Awaited<ReturnType<ModelCallLog["mark_lost"]>>> {
    return this.script.take("mark_lost", args) as Awaited<ReturnType<ModelCallLog["mark_lost"]>>;
  }
  async completed_for(...args: Parameters<ModelCallLog["completed_for"]>): Promise<Awaited<ReturnType<ModelCallLog["completed_for"]>>> {
    return this.script.take("completed_for", args) as Awaited<ReturnType<ModelCallLog["completed_for"]>>;
  }
  async totals_for_run(...args: Parameters<ModelCallLog["totals_for_run"]>): Promise<Awaited<ReturnType<ModelCallLog["totals_for_run"]>>> {
    return this.script.take("totals_for_run", args) as Awaited<ReturnType<ModelCallLog["totals_for_run"]>>;
  }
}
