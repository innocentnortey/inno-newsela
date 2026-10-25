import type { AuditLog } from "../ports/audit.ts";
import { Script } from "./scripted.ts";

export class FakeAuditLog implements AuditLog {
  readonly script = new Script<AuditLog>();

  async append(...args: Parameters<AuditLog["append"]>): Promise<Awaited<ReturnType<AuditLog["append"]>>> {
    return this.script.take("append", args) as Awaited<ReturnType<AuditLog["append"]>>;
  }
  async history(...args: Parameters<AuditLog["history"]>): Promise<Awaited<ReturnType<AuditLog["history"]>>> {
    return this.script.take("history", args) as Awaited<ReturnType<AuditLog["history"]>>;
  }
  async standard_decisions(...args: Parameters<AuditLog["standard_decisions"]>): Promise<Awaited<ReturnType<AuditLog["standard_decisions"]>>> {
    return this.script.take("standard_decisions", args) as Awaited<ReturnType<AuditLog["standard_decisions"]>>;
  }
}
